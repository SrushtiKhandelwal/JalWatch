"""
Dashboard API: Aggregated analytics for the executive operations center.

These endpoints power the KPI cards, charts, and ward-risk table.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta, timezone

from ..database import get_db
from ..models import Complaint, Alert, Incident, Ward
from ..schemas import (
    DashboardSummary,
    ComplaintsByType,
    ComplaintsBySeverity,
    ComplaintTrend,
    WardRiskSummary,
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

    # Average resolution time (sample up to 1000 resolved complaints)
    resolved_complaints = (
        db.query(Complaint)
        .filter(Complaint.resolved_at.isnot(None))
        .limit(1000)
        .all()
    )
    avg_hours = 0.0
    if resolved_complaints:
        total_hours = sum(
            (c.resolved_at - c.reported_at).total_seconds() / 3600
            for c in resolved_complaints
            if c.resolved_at and c.reported_at
        )
        avg_hours = round(total_hours / len(resolved_complaints), 1)

    # Complaints reported today
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    complaints_today = db.query(func.count(Complaint.complaint_id)).filter(
        Complaint.reported_at >= today_start
    ).scalar()

    # High-risk wards (wards with complaint count > 1.5× average)
    ward_counts = (
        db.query(Complaint.ward_id, func.count(Complaint.complaint_id))
        .group_by(Complaint.ward_id)
        .all()
    )
    high_risk = 0
    if ward_counts:
        avg_count = sum(c for _, c in ward_counts) / len(ward_counts)
        high_risk = sum(1 for _, c in ward_counts if c > avg_count * 1.5)

    return DashboardSummary(
        total_complaints=total,
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
        high_risk_wards=high_risk,
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
):
    """
    Daily complaint count for the last N days for trend analytics.
    Default: last 90 days.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    results = (
        db.query(
            func.date(Complaint.reported_at).label("date"),
            func.count(Complaint.complaint_id).label("count"),
        )
        .filter(Complaint.reported_at >= cutoff)
        .group_by(func.date(Complaint.reported_at))
        .order_by(func.date(Complaint.reported_at))
        .all()
    )
    return [ComplaintTrend(date=str(d), count=c) for d, c in results]


@router.get("/ward-risk-overview", response_model=List[WardRiskSummary])
@router.get("/ward-risks", response_model=List[WardRiskSummary])
def get_ward_risks(db: Session = Depends(get_db)):
    """
    Risk summary for all municipal wards sorted highest risk first.
    Computes risk indices from telemetry and complaint density.
    """
    wards = db.query(Ward).all()
    results = []

    for ward in wards:
        total = db.query(func.count(Complaint.complaint_id)).filter(
            Complaint.ward_id == ward.ward_id
        ).scalar()

        active_alerts = db.query(func.count(Alert.id)).filter(
            Alert.ward_id == ward.ward_id, Alert.status == "active"
        ).scalar()

        # Mock risk score based on complaint density
        risk_score = min(round(total / 500, 2), 1.0)
        if risk_score > 0.7:
            risk_level = "critical"
        elif risk_score > 0.5:
            risk_level = "high"
        elif risk_score > 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"

        results.append(
            WardRiskSummary(
                ward_id=ward.ward_id,
                ward_name=ward.ward_name,
                risk_score=risk_score,
                risk_level=risk_level,
                total_complaints=total,
                active_alerts=active_alerts,
            )
        )

    results.sort(key=lambda x: x.risk_score, reverse=True)
    return results
