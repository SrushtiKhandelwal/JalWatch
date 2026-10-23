"""A resident's own complaints and activity. All queries enforce ownership."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..citizen_auth import require_citizen
from ..database import get_db
from ..models import Citizen, Complaint, ComplaintDetail, Locality, Ward
from ..schemas import CitizenComplaintCreate, CitizenComplaintListResponse, ComplaintRecordResponse
from ..services.complaints import add_event, record_response


router = APIRouter(prefix="/citizen", tags=["Citizen complaints"])


@router.get("/summary")
def summary(citizen: Citizen = Depends(require_citizen), db: Session = Depends(get_db)):
    base = db.query(Complaint).filter(
        Complaint.citizen_id == citizen.citizen_id,
        Complaint.data_origin == "citizen_submission",
    )
    return {
        "total_complaints": base.count(),
        "open_complaints": base.filter(Complaint.status.in_(["open", "in_progress"])).count(),
        "resolved_complaints": base.filter(Complaint.status.in_(["resolved", "closed"])).count(),
    }


@router.post("/complaints", response_model=ComplaintRecordResponse, status_code=201)
def submit_complaint(
    data: CitizenComplaintCreate,
    citizen: Citizen = Depends(require_citizen),
    db: Session = Depends(get_db),
):
    locality = db.get(Locality, data.locality_id)
    if locality is None or locality.ward_id != data.ward_id:
        raise HTTPException(status_code=422, detail="Choose a locality in the selected ward")
    ward = db.get(Ward, locality.ward_id)
    if ward is None or ward.representative_latitude is None or ward.representative_longitude is None:
        raise HTTPException(status_code=422, detail="Location cannot be mapped to a ward")
    if data.observed_at is not None:
        if data.observed_at.tzinfo is None or data.observed_at > datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="Observed time must include a timezone and cannot be in the future")

    now = datetime.now(timezone.utc)
    complaint = Complaint(
        complaint_id=f"CMP-U-{uuid4().hex[:16].upper()}",
        citizen_id=citizen.citizen_id,
        reported_at=now,
        complaint_type=data.complaint_type,
        description=data.description,
        ward_id=ward.ward_id,
        locality_id=locality.locality_id,
        latitude=ward.representative_latitude,
        longitude=ward.representative_longitude,
        severity="medium",
        status="open",
        data_origin="citizen_submission",
        training_label_origin=None,
    )
    db.add(complaint)
    db.add(ComplaintDetail(
        complaint_id=complaint.complaint_id,
        title=data.title,
        address=data.address,
        observed_at=data.observed_at,
        location_precision="ward_representative",
    ))
    add_event(db, complaint, "open", "Complaint submitted for review", "citizen")
    db.commit()
    db.refresh(complaint)
    return record_response(complaint)


@router.get("/complaints", response_model=CitizenComplaintListResponse)
def my_complaints(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    citizen: Citizen = Depends(require_citizen),
    db: Session = Depends(get_db),
):
    query = db.query(Complaint).filter(
        Complaint.citizen_id == citizen.citizen_id,
        Complaint.data_origin == "citizen_submission",
    )
    total = query.with_entities(func.count(Complaint.complaint_id)).scalar() or 0
    complaints = query.order_by(Complaint.reported_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return CitizenComplaintListResponse(
        complaints=[record_response(item) for item in complaints],
        total=total, page=page, total_pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/complaints/{complaint_id}", response_model=ComplaintRecordResponse)
def my_complaint(
    complaint_id: str,
    citizen: Citizen = Depends(require_citizen),
    db: Session = Depends(get_db),
):
    complaint = db.query(Complaint).filter(
        Complaint.complaint_id == complaint_id,
        Complaint.citizen_id == citizen.citizen_id,
        Complaint.data_origin == "citizen_submission",
    ).first()
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return record_response(complaint)
