"""
Predictions API — Mock ML predictions (Module interface for Member 1).

This returns plausible-looking risk scores calculated from complaint density.
Member 1 (AI/ML Developer) will replace the logic inside these endpoints
with their real trained model — the API contract (input/output shapes) stays the same.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
import random

from ..database import get_db
from ..models import Complaint, Ward
from ..schemas import PredictionRequest, PredictionResponse

router = APIRouter(prefix="/predictions", tags=["Predictions (Mock)"])


@router.post("/risk", response_model=PredictionResponse)
def predict_risk(request: PredictionRequest, db: Session = Depends(get_db)):
    """
    ┌─────────────────────────────────────────────────────────┐
    │  🔌 INTEGRATION POINT FOR MEMBER 1 (AI/ML)             │
    │                                                         │
    │  Current: mock risk score from complaint density        │
    │  Future:  call the trained model's predict function     │
    │                                                         │
    │  Contract:                                              │
    │    Input:  PredictionRequest (ward_id, complaint_type)  │
    │    Output: PredictionResponse (risk_score, risk_level,  │
    │            predicted_incidents, contributing_factors,    │
    │            confidence, generated_at)                    │
    └─────────────────────────────────────────────────────────┘
    """
    ward = db.query(Ward).filter(Ward.ward_id == request.ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    # Count complaints for this ward
    total = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == request.ward_id
    ).scalar()

    critical = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == request.ward_id,
        Complaint.severity == "critical",
    ).scalar()

    # Mock risk calculation
    base_score = min(total / 500, 0.8)
    critical_boost = min(critical / 100, 0.2)
    risk_score = round(
        min(base_score + critical_boost + random.uniform(-0.05, 0.05), 1.0), 3
    )
    risk_score = max(risk_score, 0.0)

    if risk_score > 0.7:
        risk_level = "critical"
    elif risk_score > 0.5:
        risk_level = "high"
    elif risk_score > 0.3:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Mock contributing factors
    factors = []
    if total > 200:
        factors.append("High complaint volume in ward")
    if critical > 30:
        factors.append("Elevated critical-severity reports")
    factors.append("Historical pattern analysis")
    factors.append(f"Ward {ward.ward_name} density factor")

    return PredictionResponse(
        ward_id=request.ward_id,
        risk_score=risk_score,
        risk_level=risk_level,
        predicted_incidents=max(1, int(risk_score * 10)),
        contributing_factors=factors,
        confidence=round(0.65 + random.uniform(0, 0.25), 3),
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/risk")
def get_all_predictions(db: Session = Depends(get_db)):
    """
    Get incident risk predictions across all wards.
    Member 1 can replace this with batch model inference.
    """
    wards = db.query(Ward).all()
    results = []

    for ward in wards:
        complaint_count = db.query(func.count(Complaint.complaint_id)).filter(
            Complaint.ward_id == ward.ward_id
        ).scalar()

        # Deterministic but realistic score based on complaints
        base = min(complaint_count / 300, 0.85)
        risk = int(base * 100)
        risk = min(max(risk, 15), 95)

        if risk >= 75:
            sev = "critical"
            action = "Dispatch pressure logging crews & inspect feeder joints."
        elif risk >= 50:
            sev = "high"
            action = "Increase chlorine dosing & survey for minor leakages."
        elif risk >= 30:
            sev = "medium"
            action = "Routine acoustic pipe survey and reservoir level check."
        else:
            sev = "low"
            action = "Standard preventive monitoring cycle."

        results.append({
            "ward_id": ward.ward_id,
            "ward_name": ward.ward_name,
            "risk_score": risk,
            "severity_prediction": sev,
            "confidence": 0.82,
            "recommended_action": action,
        })

    # Sort highest risk first
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results


@router.get("/risk/{ward_id}")
def get_ward_prediction(ward_id: str, db: Session = Depends(get_db)):
    """Get single ward incident risk prediction."""
    ward = db.query(Ward).filter(Ward.ward_id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    complaint_count = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == ward.ward_id
    ).scalar()

    base = min(complaint_count / 300, 0.85)
    risk = int(base * 100)
    risk = min(max(risk, 15), 95)

    if risk >= 75:
        sev = "critical"
        action = "Dispatch pressure logging crews & inspect feeder joints."
    elif risk >= 50:
        sev = "high"
        action = "Increase chlorine dosing & survey for minor leakages."
    elif risk >= 30:
        sev = "medium"
        action = "Routine acoustic pipe survey and reservoir level check."
    else:
        sev = "low"
        action = "Standard preventive monitoring cycle."

    return {
        "ward_id": ward.ward_id,
        "ward_name": ward.ward_name,
        "risk_score": risk,
        "severity_prediction": sev,
        "confidence": 0.84,
        "recommended_action": action,
    }

