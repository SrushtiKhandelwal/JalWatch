"""
Incidents API — Incident Response and Tracking (Module 6).

Incident lifecycle:  reported → open → assigned → in_progress → resolved → closed
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone

from ..database import get_db
from ..models import Incident
from ..schemas import IncidentResponse, IncidentCreate, IncidentStatusUpdate

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("", response_model=List[IncidentResponse])
@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    ward_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get incidents with optional filters."""
    query = db.query(Incident)

    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if ward_id:
        query = query.filter(Incident.ward_id == ward_id)

    incidents = (
        query.order_by(Incident.reported_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return incidents


@router.post("", response_model=IncidentResponse, status_code=201)
@router.post("/", response_model=IncidentResponse, status_code=201)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    """
    Create a new incident and assign it an auto-generated ID (INC-0001, etc.).
    """
    # Generate next incident ID
    last = db.query(Incident).order_by(Incident.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    incident_id = f"INC-{next_num:04d}"

    incident = Incident(
        incident_id=incident_id,
        title=data.title,
        description=data.description,
        ward_id=data.ward_id,
        locality_id=data.locality_id,
        latitude=data.latitude,
        longitude=data.longitude,
        incident_type=data.incident_type,
        severity=data.severity,
        related_complaint_ids=data.related_complaint_ids,
        related_alert_id=data.related_alert_id,
        reported_at=datetime.now(timezone.utc),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Get a single incident by its string ID (e.g. INC-0001)."""
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(
    incident_id: str, update: IncidentStatusUpdate, db: Session = Depends(get_db)
):
    """
    Update incident status through the lifecycle.

    Status transitions and what they set:
      → assigned:    sets assigned_at + assigned_to
      → in_progress: (just status change)
      → resolved:    sets resolved_at + resolution_notes
      → closed:      sets closed_at
    """
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = datetime.now(timezone.utc)
    incident.status = update.status

    if update.status == "assigned":
        incident.assigned_at = now
        if update.assigned_to:
            incident.assigned_to = update.assigned_to

    elif update.status == "resolved":
        incident.resolved_at = now
        if update.resolution_notes:
            incident.resolution_notes = update.resolution_notes

    elif update.status == "closed":
        incident.closed_at = now

    db.commit()
    db.refresh(incident)
    return incident
