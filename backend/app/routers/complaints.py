"""
Complaints API: Browse, filter, and audit citizen grievance records.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, update as sql_update
from typing import Optional, Literal
from datetime import date, datetime, time, timedelta, timezone

from ..database import get_db
from ..models import Complaint, Incident, Locality, Ward
from ..schemas import (
    ComplaintResponse, ComplaintListResponse, ComplaintRecordResponse,
    ComplaintStatusUpdate, ComplaintNoteCreate, ComplaintIncidentLink,
)
from ..services.complaints import add_event, record_response

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.get("", response_model=ComplaintListResponse)
@router.get("/", response_model=ComplaintListResponse)
def get_complaints(
    ward_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    complaint_type: Optional[str] = None,
    source: Optional[Literal["citizen", "sample"]] = None,
    zone_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    sort: Literal["newest", "oldest"] = "newest",
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Get paginated list of complaints with optional filters.

    Query params:
      - ward_id:        filter by ward (e.g. W001)
      - status:         open | in_progress | resolved | closed
      - severity:       low | medium | high | critical
      - complaint_type: low_pressure | water_shortage | dirty_water | leakage
      - page / page_size: pagination controls
    """
    query = db.query(Complaint)

    if ward_id:
        query = query.filter(Complaint.ward_id == ward_id)
    if zone_id:
        query = query.join(Ward, Complaint.ward_id == Ward.ward_id).filter(Ward.zone_id == zone_id)
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="Start date must be before end date")
    if from_date:
        query = query.filter(Complaint.reported_at >= datetime.combine(from_date, time.min, tzinfo=timezone.utc))
    if to_date:
        query = query.filter(Complaint.reported_at < datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=timezone.utc))
    if status:
        query = query.filter(Complaint.status == status)
    if severity:
        query = query.filter(Complaint.severity == severity)
    if complaint_type:
        query = query.filter(Complaint.complaint_type == complaint_type)
    if source == "citizen":
        query = query.filter(Complaint.data_origin == "citizen_submission")
    elif source == "sample":
        query = query.filter(or_(Complaint.data_origin.is_(None), Complaint.data_origin != "citizen_submission"))
    if search and search.strip():
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{term}%"
        query = query.filter(or_(
            Complaint.complaint_id.ilike(pattern, escape="\\"),
            Complaint.locality_id.ilike(pattern, escape="\\"),
            Complaint.locality_id.in_(
                db.query(Locality.locality_id).filter(Locality.locality_name.ilike(pattern, escape="\\"))
            ),
            Complaint.complaint_type.ilike(pattern, escape="\\"),
        ))

    total = query.count()
    complaints = (
        query.order_by(Complaint.reported_at.desc() if sort == "newest" else Complaint.reported_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ComplaintListResponse(
        complaints=complaints,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/{complaint_id}", response_model=ComplaintRecordResponse)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    """Get a single complaint by its ID."""
    complaint = db.query(Complaint).filter(Complaint.complaint_id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return record_response(complaint)


@router.patch("/{complaint_id}/status", response_model=ComplaintRecordResponse)
def update_complaint_status(
    complaint_id: str, update: ComplaintStatusUpdate, db: Session = Depends(get_db),
):
    complaint = db.get(Complaint, complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    allowed = {
        "open": {"in_progress", "resolved"},
        "in_progress": {"resolved"},
        "resolved": {"closed"},
    }
    if update.status not in allowed.get(complaint.status, set()):
        raise HTTPException(status_code=409, detail="Invalid complaint status transition")
    previous = complaint.status
    values = {"status": update.status}
    if update.status == "resolved":
        values["resolved_at"] = datetime.now(timezone.utc)
    result = db.execute(sql_update(Complaint).where(
        Complaint.complaint_id == complaint_id, Complaint.status == previous,
    ).values(**values))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Complaint changed; reload and try again")
    add_event(db, complaint, update.status, update.note, "admin", previous)
    db.commit()
    db.refresh(complaint)
    return record_response(complaint)


@router.post("/{complaint_id}/notes", response_model=ComplaintRecordResponse)
def add_complaint_note(
    complaint_id: str, data: ComplaintNoteCreate, db: Session = Depends(get_db),
):
    complaint = db.get(Complaint, complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    add_event(db, complaint, complaint.status, data.note, "admin", complaint.status)
    db.commit()
    db.refresh(complaint)
    return record_response(complaint)


@router.post("/{complaint_id}/incident", response_model=ComplaintRecordResponse)
def link_complaint_incident(
    complaint_id: str, data: ComplaintIncidentLink, db: Session = Depends(get_db),
):
    complaint = db.get(Complaint, complaint_id)
    incident = db.query(Incident).filter(Incident.incident_id == data.incident_id).first()
    if complaint is None or incident is None:
        raise HTTPException(status_code=404, detail="Complaint or incident not found")
    if complaint.ward_id != incident.ward_id:
        raise HTTPException(status_code=422, detail="Complaint and incident must be in the same ward")
    if complaint.incident_id:
        raise HTTPException(status_code=409, detail="Complaint is already linked to an incident")
    if len(incident.related_complaint_ids or []) >= 100:
        raise HTTPException(status_code=422, detail="Incident already has the maximum related complaints")
    result = db.execute(sql_update(Complaint).where(
        Complaint.complaint_id == complaint_id, Complaint.incident_id.is_(None),
    ).values(incident_id=incident.incident_id))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Complaint changed; reload and try again")
    incident.related_complaint_ids = [*(incident.related_complaint_ids or []), complaint_id]
    add_event(db, complaint, complaint.status, f"Linked to incident {incident.incident_id}", "admin", complaint.status)
    if incident.status in ("assigned", "in_progress") and complaint.status == "open":
        add_event(db, complaint, "in_progress", "Response team is investigating", "admin", complaint.status)
        complaint.status = "in_progress"
    if incident.status in ("resolved", "closed") and complaint.status in ("open", "in_progress"):
        add_event(db, complaint, "resolved", incident.resolution_notes or "Linked incident resolved", "admin", complaint.status)
        complaint.status = "resolved"
        complaint.resolved_at = incident.resolved_at or datetime.now(timezone.utc)
    if incident.status == "closed" and complaint.status == "resolved":
        add_event(db, complaint, "closed", "Linked incident closed", "admin", "resolved")
        complaint.status = "closed"
    db.commit()
    db.refresh(complaint)
    return record_response(complaint)
