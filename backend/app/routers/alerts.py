"""Early warning alerts, model signal ingestion, and response history."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, update as sql_update
from sqlalchemy.orm import Session
from typing import List, Literal, Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models import Alert, AlertEvent, Ward
from ..schemas import (
    AlertCreate, AlertEvaluationResponse, AlertEventResponse, AlertResponse,
    AlertUpdate, RiskSignal,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])
RISK_ALERT_THRESHOLD = 0.70


def _find_alert(db: Session, alert_id: int) -> Alert:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


def _store_alert(db: Session, alert: Alert) -> Alert:
    db.add(alert)
    db.flush()
    db.add(AlertEvent(
        alert_id=alert.id, from_status=None, to_status="active",
        occurred_at=alert.triggered_at,
    ))
    db.commit()
    db.refresh(alert)
    return alert


@router.get("", response_model=List[AlertResponse])
@router.get("/", response_model=List[AlertResponse])
def get_alerts(
    status: Optional[Literal["active", "acknowledged", "resolved", "dismissed"]] = None,
    severity: Optional[Literal["low", "medium", "high", "critical"]] = None,
    ward_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Get alerts with optional filters.
    Default: returns most recent alerts first.
    """
    query = db.query(Alert)

    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)
    if ward_id:
        query = query.filter(Alert.ward_id == ward_id)

    alerts = (
        query.order_by(Alert.triggered_at.desc(), Alert.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return alerts


@router.get("/active-count")
def get_active_alert_count(db: Session = Depends(get_db)):
    """Count every active alert, independent of list pagination."""
    count = db.query(func.count(Alert.id)).filter(Alert.status == "active").scalar()
    return {"active_alerts": count}


@router.post("", response_model=AlertResponse, status_code=201)
@router.post("/", response_model=AlertResponse, status_code=201)
def create_alert(alert_data: AlertCreate, db: Session = Depends(get_db)):
    """Create a manual alert for a known ward."""
    if not db.query(Ward).filter(Ward.ward_id == alert_data.ward_id).first():
        raise HTTPException(status_code=404, detail="Ward not found")
    alert = Alert(
        alert_type=alert_data.alert_type,
        severity=alert_data.severity,
        ward_id=alert_data.ward_id,
        locality_id=alert_data.locality_id,
        title=alert_data.title,
        description=alert_data.description,
        risk_score=alert_data.risk_score,
        source="manual",
        triggered_at=datetime.now(timezone.utc),
    )
    return _store_alert(db, alert)


@router.post("/evaluate", response_model=AlertEvaluationResponse)
def evaluate_risk_signal(signal: RiskSignal, db: Session = Depends(get_db)):
    """Accept Member 1's model output and open one actionable ward alert."""
    ward = db.query(Ward).filter(Ward.ward_id == signal.ward_id).first()
    if ward is None:
        raise HTTPException(status_code=404, detail="Ward not found")
    now = datetime.now(timezone.utc)
    if signal.generated_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="generated_at must include a timezone")
    age_seconds = (now - signal.generated_at).total_seconds()
    if age_seconds > 24 * 3600 or age_seconds < -300:
        raise HTTPException(status_code=422, detail="Model signal is stale or dated in the future")
    if signal.risk_score < RISK_ALERT_THRESHOLD or signal.severity_prediction not in ("high", "critical"):
        return AlertEvaluationResponse(alert_created=False, reason="Below alert threshold")

    existing = db.query(Alert).filter(
        Alert.ward_id == signal.ward_id,
        Alert.alert_type == "high_risk",
        Alert.source == "ml_model",
        Alert.status.in_(["active", "acknowledged"]),
    ).order_by(Alert.id.desc()).first()
    if existing:
        return AlertEvaluationResponse(alert_created=False, reason="Open model alert already exists", alert=existing)

    factors = "; ".join(factor[:200] for factor in signal.contributing_factors[:5])
    alert = Alert(
        alert_type="high_risk",
        severity=signal.severity_prediction,
        ward_id=signal.ward_id,
        title=f"Elevated incident risk in {ward.ward_name}",
        description=f"Model {signal.model_version}: score {signal.risk_score:.2f}. Factors: {factors or 'not provided'}",
        risk_score=signal.risk_score,
        source="ml_model",
        triggered_at=now,
    )
    return AlertEvaluationResponse(alert_created=True, reason="Alert created", alert=_store_alert(db, alert))


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    return _find_alert(db, alert_id)


@router.get("/{alert_id}/events", response_model=List[AlertEventResponse])
def get_alert_events(alert_id: int, db: Session = Depends(get_db)):
    _find_alert(db, alert_id)
    return db.query(AlertEvent).filter(AlertEvent.alert_id == alert_id).order_by(AlertEvent.id).all()


@router.patch("/{alert_id}", response_model=AlertResponse)
def update_alert_status(alert_id: int, update: AlertUpdate, db: Session = Depends(get_db)):
    """Only permit valid transitions; repeated requests are idempotent."""
    alert = _find_alert(db, alert_id)
    if alert.status == update.status:
        return alert
    allowed = {
        "active": {"acknowledged", "resolved", "dismissed"},
        "acknowledged": {"resolved", "dismissed"},
    }
    if update.status not in allowed.get(alert.status, set()):
        raise HTTPException(status_code=409, detail="Invalid alert status transition")

    previous_status = alert.status
    now = datetime.now(timezone.utc)
    values = {"status": update.status}
    if update.status == "acknowledged":
        values["acknowledged_at"] = now
    elif update.status in ("resolved", "dismissed"):
        values["resolved_at"] = now

    result = db.execute(
        sql_update(Alert).where(Alert.id == alert_id, Alert.status == previous_status).values(**values)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Alert changed; reload and try again")
    db.add(AlertEvent(
        alert_id=alert_id, from_status=previous_status, to_status=update.status,
        occurred_at=now,
    ))

    db.commit()
    db.refresh(alert)
    return alert
