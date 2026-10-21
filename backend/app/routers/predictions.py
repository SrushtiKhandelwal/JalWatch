"""Synthetic-label model inference and explicit demo alert scanning."""

import json
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ml.predict import load_model
from ml.train import EVALUATION_PATH

from ..database import get_db
from ..models import Locality, Ward
from ..schemas import (
    PredictionRequest,
    PredictionResponse,
    RiskSignal,
    ScanRequest,
    ScanResponse,
    WardRiskResponse,
)
from ..services.risk import risk_level, ward_risk_snapshots
from .alerts import evaluate_risk_signal


router = APIRouter(prefix="/predictions", tags=["Predictions"])


def _snapshots(db: Session) -> list[WardRiskResponse]:
    try:
        return ward_risk_snapshots(db)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/model")
def get_model_report():
    """Return the saved chronological holdout metrics and label provenance."""
    try:
        return json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Model report is missing; run python -m ml.train") from exc


@router.post("/risk", response_model=PredictionResponse)
def predict_risk(request: PredictionRequest, db: Session = Depends(get_db)):
    """Score one complaint at intake using the exact training feature path."""
    if not db.query(Ward).filter(Ward.ward_id == request.ward_id).first():
        raise HTTPException(status_code=404, detail="Ward not found")
    if request.locality_id:
        locality = db.query(Locality).filter(Locality.locality_id == request.locality_id).first()
        if not locality or locality.ward_id != request.ward_id:
            raise HTTPException(status_code=422, detail="Locality does not belong to the selected ward")
    try:
        model = load_model()
        score = model.predict_score(request.model_dump())
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return PredictionResponse(
        ward_id=request.ward_id,
        risk_score=round(score, 4),
        risk_level=risk_level(score),
        model_version=model.version,
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/risk", response_model=List[WardRiskResponse])
def get_all_predictions(db: Session = Depends(get_db)):
    """Rank wards by mean score of complaints in the latest 30 data days."""
    return _snapshots(db)


@router.get("/anomalies", response_model=List[WardRiskResponse])
def get_complaint_anomalies(db: Session = Depends(get_db)):
    """Show wards whose recent count is unusually high versus four prior weeks."""
    return [snapshot for snapshot in _snapshots(db) if snapshot.is_anomalous]


@router.post("/scan-alerts", response_model=ScanResponse)
def scan_for_alerts(request: ScanRequest, db: Session = Depends(get_db)):
    """Explicitly scan ward scores and create deduplicated demo alerts.

    Stale data requires an explicit demo override. This endpoint never runs
    automatically or claims to dispatch external notifications.
    """
    snapshots = _snapshots(db)
    data_through = snapshots[0].data_through if snapshots else None
    if data_through and datetime.now(timezone.utc) - data_through > timedelta(days=7):
        if not request.allow_stale_demo_data:
            raise HTTPException(
                status_code=409,
                detail="Complaint data is more than seven days old; enable the demo override to scan it",
            )

    created = []
    deduplicated = 0
    below_threshold = 0
    now = datetime.now(timezone.utc)
    for snapshot in snapshots:
        if snapshot.risk_score is None:
            continue
        signal = RiskSignal(
            ward_id=snapshot.ward_id,
            risk_score=snapshot.risk_score,
            severity_prediction=snapshot.risk_level,
            model_version=snapshot.model_version,
            contributing_factors=snapshot.contributing_factors,
            generated_at=now,
            is_demo=True,
        )
        decision = evaluate_risk_signal(signal, db)
        if decision.alert_created and decision.alert:
            created.append(decision.alert)
        elif decision.reason == "Open model alert already exists":
            deduplicated += 1
        else:
            below_threshold += 1

    return ScanResponse(
        processed_wards=len(snapshots),
        anomalous_wards=sum(snapshot.is_anomalous for snapshot in snapshots),
        created_alerts=len(created),
        deduplicated_alerts=deduplicated,
        below_threshold=below_threshold,
        data_through=data_through,
        alerts=created,
    )


@router.get("/risk/{ward_id}", response_model=WardRiskResponse)
def get_ward_prediction(ward_id: str, db: Session = Depends(get_db)):
    for snapshot in _snapshots(db):
        if snapshot.ward_id == ward_id:
            return snapshot
    raise HTTPException(status_code=404, detail="Ward not found")
