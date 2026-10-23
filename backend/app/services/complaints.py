"""Shared complaint response and event helpers."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Complaint, ComplaintEvent
from ..schemas import ComplaintRecordResponse, ComplaintResponse


def record_response(complaint: Complaint) -> ComplaintRecordResponse:
    detail = complaint.detail
    return ComplaintRecordResponse(
        **ComplaintResponse.model_validate(complaint).model_dump(),
        title=detail.title if detail else None,
        address=detail.address if detail else None,
        observed_at=detail.observed_at if detail else None,
        location_precision=detail.location_precision if detail else None,
        events=complaint.events,
    )


def add_event(
    db: Session, complaint: Complaint, to_status: str, note: str,
    actor_role: str, from_status: str | None = None,
) -> None:
    db.add(ComplaintEvent(
        complaint_id=complaint.complaint_id,
        from_status=from_status,
        to_status=to_status,
        note=note,
        actor_role=actor_role,
        occurred_at=datetime.now(timezone.utc),
    ))
