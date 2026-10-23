"""Measured workload and response metrics for the operations dashboard."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, func
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone

from ..database import get_db
from ..models import Complaint, Alert, Incident, Ward
from ..schemas import (
    DashboardSummary,
    ComplaintsByType,
    ComplaintsBySeverity,
    ComplaintTrend,
    WardPrioritySummary,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Top-level KPI numbers for the dashboard overview.
    Returns counts for complaints (by status), alerts, incidents, etc.
    """
    # Complaint counts by status
    total = db.query(func.count(Complaint.complaint_id)).scalar()
    citizen_total = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.data_origin == "citizen_submission"
    ).scalar()
    open_c = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.status == "open"
    ).scalar()
    in_progress = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.status == "in_progress"
    ).scalar()
    resolved = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.status == "resolved"
    ).scalar()
    closed = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.status == "closed"
    ).scalar()

    # Alert counts
    active_alerts = db.query(func.count(Alert.id)).filter(
        Alert.status == "active"
    ).scalar()
    critical_alerts = db.query(func.count(Alert.id)).filter(
        Alert.status == "active", Alert.severity == "critical"
    ).scalar()

    # Incident counts
    total_incidents = db.query(func.count(Incident.id)).scalar()
    open_incidents = db.query(func.count(Incident.id)).filter(
        Incident.status.in_(["reported", "open", "assigned", "in_progress"])
    ).scalar()

    # Stream all resolved timestamps instead of taking an arbitrary sample.
    total_resolution_hours = 0.0
    measured_resolutions = 0
    for reported_at, resolved_at in db.query(Complaint.reported_at, Complaint.resolved_at).filter(
        Complaint.resolved_at.isnot(None)
    ).yield_per(500):
        hours = (resolved_at - reported_at).total_seconds() / 3600
        if hours >= 0:
            total_resolution_hours += hours
            measured_resolutions += 1
    avg_hours = round(total_resolution_hours / measured_resolutions, 1) if measured_resolutions else None

    # Complaints reported today
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    complaints_today = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.reported_at >= today_start
    ).scalar()

    wards_with_critical_alerts = db.query(func.count(func.distinct(Alert.ward_id))).filter(
        Alert.status == "active", Alert.severity == "critical"
    ).scalar()
    latest_complaint_at = db.query(func.max(Complaint.reported_at)).scalar()

    return DashboardSummary(
        total_complaints=total,
        citizen_complaints=citizen_total,
        sample_complaints=total - citizen_total,
        open_complaints=open_c,
        in_progress_complaints=in_progress,
        resolved_complaints=resolved,
        closed_complaints=closed,
        active_alerts=active_alerts,
        critical_alerts=critical_alerts,
        total_incidents=total_incidents,
        open_incidents=open_incidents,
        avg_resolution_hours=avg_hours,
        complaints_today=complaints_today,
        wards_with_critical_alerts=wards_with_critical_alerts,
        latest_complaint_at=latest_complaint_at,
    )


@router.get("/complaints-by-type", response_model=List[ComplaintsByType])
def get_complaints_by_type(db: Session = Depends(get_db)):
    """Complaint count grouped by type for distribution charts."""
    results = (
        db.query(Complaint.complaint_type, func.count(Complaint.complaint_id))
        .group_by(Complaint.complaint_type)
        .all()
    )
    return [ComplaintsByType(complaint_type=t, count=c) for t, c in results]


@router.get("/complaints-by-severity", response_model=List[ComplaintsBySeverity])
def get_complaints_by_severity(db: Session = Depends(get_db)):
    """Complaint count grouped by severity priority."""
    results = (
        db.query(Complaint.severity, func.count(Complaint.complaint_id))
        .group_by(Complaint.severity)
        .all()
    )
    return [ComplaintsBySeverity(severity=s, count=c) for s, c in results]


@router.get("/daily-trend", response_model=List[ComplaintTrend])
@router.get("/complaint-trends", response_model=List[ComplaintTrend])
def get_complaint_trends(
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db),
    as_of: Optional[date] = None,
):
    """
    Daily complaint count for the last N days for trend analytics.
    Default: last 90 days.
    """
    end_date = as_of or datetime.now(timezone.utc).date()
    first_date = end_date - timedelta(days=days - 1)
    cutoff = datetime.combine(first_date, datetime.min.time(), tzinfo=timezone.utc)
    end_exclusive = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    results = (
        db.query(
            func.date(Complaint.reported_at).label("date"),
            func.count(Complaint.complaint_id).label("count"),
        )
        .filter(Complaint.reported_at >= cutoff, Complaint.reported_at < end_exclusive)
        .group_by(func.date(Complaint.reported_at))
        .order_by(func.date(Complaint.reported_at))
        .all()
    )
    counts = {str(d): c for d, c in results}
    return [
        ComplaintTrend(date=str(first_date + timedelta(days=offset)),
                       count=counts.get(str(first_date + timedelta(days=offset)), 0))
        for offset in range(days)
    ]


@router.get("/ward-priorities", response_model=List[WardPrioritySummary])
def get_ward_priorities(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
):
    """Rank wards by observed recent critical reports, then report volume."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    complaint_rows = db.query(
        Complaint.ward_id,
        func.count(Complaint.complaint_id),
        func.sum(case((Complaint.severity == "critical", 1), else_=0)),
    ).filter(Complaint.reported_at >= cutoff).group_by(Complaint.ward_id).all()
    complaints = {ward_id: (total, critical) for ward_id, total, critical in complaint_rows}
    alert_rows = db.query(Alert.ward_id, func.count(Alert.id)).filter(
        Alert.status == "active"
    ).group_by(Alert.ward_id).all()
    alerts = dict(alert_rows)

    results = [WardPrioritySummary(
        ward_id=ward.ward_id,
        ward_name=ward.ward_name,
        zone_name=ward.zone_name,
        recent_complaints=complaints.get(ward.ward_id, (0, 0))[0],
        critical_complaints=complaints.get(ward.ward_id, (0, 0))[1],
        active_alerts=alerts.get(ward.ward_id, 0),
        window_days=days,
    ) for ward in db.query(Ward).all()]
    results.sort(key=lambda row: (-row.critical_complaints, -row.recent_complaints, row.ward_id))
    return results
