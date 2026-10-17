"""
Wards API: Municipal ward infrastructure and spatial records.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from ..database import get_db
from ..models import Ward, Complaint, Alert, Incident
from ..schemas import WardResponse, WardStats

router = APIRouter(prefix="/wards", tags=["Wards"])


@router.get("", response_model=List[WardResponse])
@router.get("/", response_model=List[WardResponse])
def get_wards(db: Session = Depends(get_db)):
    """Get all 38 Nagpur wards ordered by ward number."""
    wards = db.query(Ward).order_by(Ward.ward_number).all()
    return wards


@router.get("/{ward_id}", response_model=WardResponse)
def get_ward(ward_id: str, db: Session = Depends(get_db)):
    """Get a single ward by its ID (e.g. W001)."""
    ward = db.query(Ward).filter(Ward.ward_id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    return ward


@router.get("/{ward_id}/stats", response_model=WardStats)
def get_ward_stats(ward_id: str, db: Session = Depends(get_db)):
    """
    Get aggregated statistics for a specific ward:
    complaint counts by status, active alerts, incidents, avg resolution time.
    """
    ward = db.query(Ward).filter(Ward.ward_id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    # Count complaints by status
    total = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == ward_id
    ).scalar()

    open_c = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == ward_id, Complaint.status == "open"
    ).scalar()

    resolved_c = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == ward_id, Complaint.status == "resolved"
    ).scalar()

    critical_c = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.ward_id == ward_id, Complaint.severity == "critical"
    ).scalar()

    # Active alerts and incidents
    active_alerts = db.query(func.count(Alert.id)).filter(
        Alert.ward_id == ward_id, Alert.status == "active"
    ).scalar()

    active_incidents = db.query(func.count(Incident.id)).filter(
        Incident.ward_id == ward_id,
        Incident.status.in_(["reported", "open", "assigned", "in_progress"]),
    ).scalar()

    # Average resolution time (hours)
    resolved_complaints = (
        db.query(Complaint)
        .filter(Complaint.ward_id == ward_id, Complaint.resolved_at.isnot(None))
        .limit(500)
        .all()
    )

    avg_hours = None
    if resolved_complaints:
        total_hours = sum(
            (c.resolved_at - c.reported_at).total_seconds() / 3600
            for c in resolved_complaints
            if c.resolved_at and c.reported_at
        )
        avg_hours = round(total_hours / len(resolved_complaints), 1)

    return WardStats(
        ward_id=ward_id,
        ward_name=ward.ward_name,
        zone_name=ward.zone_name,
        total_complaints=total,
        open_complaints=open_c,
        resolved_complaints=resolved_c,
        critical_complaints=critical_c,
        active_alerts=active_alerts,
        active_incidents=active_incidents,
        avg_resolution_hours=avg_hours,
        risk_score=0.0,  # Dynamic infrastructure risk index
    )
