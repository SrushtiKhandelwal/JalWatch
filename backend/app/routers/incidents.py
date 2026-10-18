"""Incident work orders and their auditable lifecycle."""

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import update as sql_update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Alert, Complaint, Incident, IncidentEvent, Ward
from ..schemas import (
    IncidentCreate, IncidentEventResponse, IncidentResponse, IncidentStatusUpdate,
)

router = APIRouter(prefix="/incidents", tags=["Incidents"])

NEXT_STATUS = {
    "reported": "open",
    "open": "assigned",
    "assigned": "in_progress",
    "in_progress": "resolved",
    "resolved": "closed",
}


def _find_incident(db: Session, incident_id: str) -> Incident:
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.get("", response_model=List[IncidentResponse])
@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    status: Optional[Literal["reported", "open", "assigned", "in_progress", "resolved", "closed"]] = None,
    severity: Optional[Literal["low", "medium", "high", "critical"]] = None,
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
        query.order_by(Incident.reported_at.desc(), Incident.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return incidents


@router.post("", response_model=IncidentResponse, status_code=201)
@router.post("/", response_model=IncidentResponse, status_code=201)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    """Create a ticket, optionally assigning a crew in the same transaction."""
    if not db.query(Ward).filter(Ward.ward_id == data.ward_id).first():
        raise HTTPException(status_code=404, detail="Ward not found")
    if data.related_alert_id is not None:
        alert = db.query(Alert).filter(Alert.id == data.related_alert_id).first()
        if alert is None or alert.ward_id != data.ward_id:
            raise HTTPException(status_code=422, detail="Related alert must belong to the selected ward")
    complaint_ids = set(data.related_complaint_ids)
    if len(complaint_ids) != len(data.related_complaint_ids):
        raise HTTPException(status_code=422, detail="Related complaint IDs must be unique")
    if complaint_ids:
        complaints = db.query(Complaint.complaint_id, Complaint.ward_id).filter(
            Complaint.complaint_id.in_(complaint_ids)
        ).all()
        if len(complaints) != len(complaint_ids) or any(ward_id != data.ward_id for _, ward_id in complaints):
            raise HTTPException(status_code=422, detail="Related complaints must belong to the selected ward")

    now = datetime.now(timezone.utc)
    status = "assigned" if data.assigned_to else "reported"
    incident = Incident(
        incident_id=f"INC-{uuid4().hex[:12].upper()}",
        title=data.title,
        description=data.description,
        ward_id=data.ward_id,
        locality_id=data.locality_id,
        latitude=data.latitude,
        longitude=data.longitude,
        incident_type=data.incident_type,
        severity=data.severity,
        status=status,
        assigned_to=data.assigned_to,
        assigned_at=now if data.assigned_to else None,
        related_complaint_ids=data.related_complaint_ids,
        related_alert_id=data.related_alert_id,
        reported_at=now,
    )
    db.add(incident)
    db.add(IncidentEvent(
        incident_id=incident.incident_id, from_status=None, to_status=status,
        assigned_to=data.assigned_to, note="Incident created", occurred_at=now,
    ))
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    return _find_incident(db, incident_id)


@router.get("/{incident_id}/events", response_model=List[IncidentEventResponse])
def get_incident_events(incident_id: str, db: Session = Depends(get_db)):
    _find_incident(db, incident_id)
    return db.query(IncidentEvent).filter(IncidentEvent.incident_id == incident_id).order_by(
        IncidentEvent.id
    ).all()


@router.patch("/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(
    incident_id: str, update: IncidentStatusUpdate, db: Session = Depends(get_db)
):
    """Advance one stage. A conditional update rejects concurrent stale writes."""
    incident = _find_incident(db, incident_id)
    if incident.status == update.status:
        return incident
    if NEXT_STATUS.get(incident.status) != update.status:
        raise HTTPException(status_code=409, detail="Invalid incident status transition")
    if update.status == "assigned" and not (update.assigned_to or incident.assigned_to):
        raise HTTPException(status_code=422, detail="Choose a crew before assignment")
    if update.status == "resolved" and not update.resolution_notes:
        raise HTTPException(status_code=422, detail="Resolution notes are required")

    previous_status = incident.status
    now = datetime.now(timezone.utc)
    values = {"status": update.status}
    if update.status == "assigned":
        values.update(assigned_at=now, assigned_to=update.assigned_to or incident.assigned_to)
    elif update.status == "resolved":
        values.update(resolved_at=now, resolution_notes=update.resolution_notes)
    elif update.status == "closed":
        values["closed_at"] = now

    result = db.execute(
        sql_update(Incident).where(
            Incident.id == incident.id, Incident.status == previous_status
        ).values(**values)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Incident changed; reload and try again")
    db.add(IncidentEvent(
        incident_id=incident_id, from_status=previous_status, to_status=update.status,
        assigned_to=values.get("assigned_to", incident.assigned_to),
        note=update.resolution_notes, occurred_at=now,
    ))

    db.commit()
    db.refresh(incident)
    return incident
