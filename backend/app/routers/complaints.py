"""
Complaints API: Browse, filter, and audit citizen grievance records.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from ..database import get_db
from ..models import Complaint
from ..schemas import ComplaintResponse, ComplaintListResponse

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.get("", response_model=ComplaintListResponse)
@router.get("/", response_model=ComplaintListResponse)
def get_complaints(
    ward_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    complaint_type: Optional[str] = None,
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
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
    if status:
        query = query.filter(Complaint.status == status)
    if severity:
        query = query.filter(Complaint.severity == severity)
    if complaint_type:
        query = query.filter(Complaint.complaint_type == complaint_type)
    if search and search.strip():
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{term}%"
        query = query.filter(or_(
            Complaint.complaint_id.ilike(pattern, escape="\\"),
            Complaint.locality_id.ilike(pattern, escape="\\"),
            Complaint.complaint_type.ilike(pattern, escape="\\"),
        ))

    total = query.count()
    complaints = (
        query.order_by(Complaint.reported_at.desc())
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


@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    """Get a single complaint by its ID."""
    complaint = db.query(Complaint).filter(Complaint.complaint_id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint
