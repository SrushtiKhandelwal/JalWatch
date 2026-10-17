"""
Alerts API: Early Warning & Telemetry Notification System.

Alert lifecycle: active -> acknowledged -> resolved / dismissed
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone

from ..database import get_db
from ..models import Alert
from ..schemas import AlertResponse, AlertCreate, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
@router.get("/", response_model=List[AlertResponse])
def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
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
        query.order_by(Alert.triggered_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return alerts


@router.get("/active-count")
def get_active_alert_count(db: Session = Depends(get_db)):
    """Quick count of active alerts for header telemetry indicator."""
    from sqlalchemy import func

    count = db.query(func.count(Alert.id)).filter(Alert.status == "active").scalar()
    return {"active_alerts": count}


@router.post("", response_model=AlertResponse, status_code=201)
@router.post("/", response_model=AlertResponse, status_code=201)
def create_alert(alert_data: AlertCreate, db: Session = Depends(get_db)):
    """
    Create a new alert.
    Typically called by the alert engine when risk thresholds are breached.
    """
    alert = Alert(
        alert_type=alert_data.alert_type,
        severity=alert_data.severity,
        ward_id=alert_data.ward_id,
        locality_id=alert_data.locality_id,
        title=alert_data.title,
        description=alert_data.description,
        risk_score=alert_data.risk_score,
        source=alert_data.source,
        triggered_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """Get a single alert by ID."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/{alert_id}", response_model=AlertResponse)
def update_alert_status(alert_id: int, update: AlertUpdate, db: Session = Depends(get_db)):
    """
    Update an alert's status.
    Valid transitions:
      active → acknowledged → resolved
      active → dismissed
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    now = datetime.now(timezone.utc)
    alert.status = update.status

    if update.status == "acknowledged":
        alert.acknowledged_at = now
    elif update.status in ("resolved", "dismissed"):
        alert.resolved_at = now

    db.commit()
    db.refresh(alert)
    return alert
