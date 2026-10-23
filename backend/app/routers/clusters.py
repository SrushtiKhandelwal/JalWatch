"""Explainable review suggestions from recent, nearby citizen reports."""

import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Complaint
from ..schemas import ComplaintClusterResponse

router = APIRouter(prefix="/clusters", tags=["Complaint clusters"])


@router.get("", response_model=list[ComplaintClusterResponse])
def list_clusters(
    days: int = Query(30, ge=1, le=90),
    ward_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Group unresolved reports in the same locality/category within 48 hours.

    The locality markers are ward representative points, so this makes no claim
    about street-level distance or a confirmed common cause.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = db.query(Complaint).filter(
        Complaint.data_origin == "citizen_submission",
        Complaint.status.in_(["open", "in_progress"]),
        Complaint.incident_id.is_(None),
        Complaint.reported_at >= cutoff,
    )
    if ward_id:
        query = query.filter(Complaint.ward_id == ward_id)
    reports = query.order_by(Complaint.reported_at.desc(), Complaint.complaint_id.desc()).limit(5000).all()
    reports.reverse()
    by_area: dict[tuple[str, str, str], list[Complaint]] = {}
    for item in reports:
        if item.locality_id:
            by_area.setdefault((item.ward_id, item.locality_id, item.complaint_type), []).append(item)

    clusters = []
    for (area_ward, locality, category), items in by_area.items():
        window = []
        def append_window(group: list[Complaint]) -> None:
            if len(group) < 2:
                return
            ids = sorted(item.complaint_id for item in group)
            digest = hashlib.sha256("|".join(ids).encode()).hexdigest()[:12].upper()
            clusters.append(ComplaintClusterResponse(
                cluster_id=f"CLU-{digest}", ward_id=area_ward,
                locality_id=locality, complaint_type=category,
                complaint_ids=ids, complaint_count=len(ids),
                first_reported_at=group[0].reported_at,
                last_reported_at=group[-1].reported_at,
                explanation=(
                    f"{len(ids)} unresolved citizen reports of {category.replace('_', ' ')} "
                    "were submitted for the same selected locality within 48 hours. "
                    "This is a review suggestion, not a confirmed shared cause; "
                    "location markers are ward representative points."
                ),
                latitude=group[0].latitude, longitude=group[0].longitude,
            ))

        for item in items:
            if window and item.reported_at - window[0].reported_at > timedelta(hours=48):
                append_window(window)
                window = []
            window.append(item)
        append_window(window)
    return sorted(clusters, key=lambda item: item.last_reported_at, reverse=True)[:100]
