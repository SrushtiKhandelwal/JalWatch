"""Ward risk snapshots from complaint records and the trained demo model."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ml.anomaly import weekly_activity
from ml.predict import load_model

from ..models import Complaint, Ward
from ..schemas import WardRiskResponse


RISK_WINDOW_DAYS = 30


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def risk_level(score: float | None) -> str:
    if score is None:
        return "unknown"
    if score >= 0.85:
        return "critical"
    if score >= 0.70:
        return "high"
    if score >= 0.40:
        return "medium"
    return "low"


def ward_risk_snapshots(db: Session) -> list[WardRiskResponse]:
    model = load_model()
    wards = db.query(Ward).order_by(Ward.ward_number).all()
    latest = db.query(func.max(Complaint.reported_at)).scalar()
    if latest is None:
        return [WardRiskResponse(
            ward_id=ward.ward_id,
            ward_name=ward.ward_name,
            risk_score=None,
            risk_level="unknown",
            complaint_count=0,
            critical_count=0,
            recent_7_day_count=0,
            baseline_weekly_count=0,
            is_anomalous=False,
            contributing_factors=["No complaint records available"],
            model_version=model.version,
            data_through=None,
            is_demo=True,
        ) for ward in wards]

    latest_utc = _utc(latest)
    window_start = latest_utc - timedelta(days=RISK_WINDOW_DAYS)
    activity_start = latest_utc - timedelta(days=34)
    rows = db.query(
        Complaint.ward_id,
        Complaint.complaint_type,
        Complaint.severity,
        Complaint.locality_id,
        Complaint.reported_at,
    ).filter(Complaint.reported_at >= activity_start).all()

    activity = weekly_activity(
        ((row.ward_id, _utc(row.reported_at)) for row in rows), latest_utc.date()
    )
    scores = defaultdict(list)
    critical = Counter()
    for row in rows:
        if _utc(row.reported_at) < window_start:
            continue
        scores[row.ward_id].append(model.predict_score({
            "complaint_type": row.complaint_type,
            "severity": row.severity,
            "ward_id": row.ward_id,
            "locality_id": row.locality_id,
        }))
        if row.severity == "critical":
            critical[row.ward_id] += 1

    snapshots = []
    for ward in wards:
        ward_scores = scores[ward.ward_id]
        score = round(sum(ward_scores) / len(ward_scores), 4) if ward_scores else None
        trend = activity.get(ward.ward_id, {})
        recent_count = int(trend.get("recent_count", 0))
        baseline_count = float(trend.get("baseline_weekly_count", 0))
        anomaly = bool(trend.get("is_anomalous", False))
        factors = [
            f"{len(ward_scores)} reports in the 30 days ending {latest_utc.date().isoformat()}",
            f"{critical[ward.ward_id]} critical-severity reports in that window",
        ]
        if anomaly:
            factors.append(
                f"Seven-day complaint spike: {recent_count} vs {baseline_count:g} per prior week"
            )
        snapshots.append(WardRiskResponse(
            ward_id=ward.ward_id,
            ward_name=ward.ward_name,
            risk_score=score,
            risk_level=risk_level(score),
            complaint_count=len(ward_scores),
            critical_count=critical[ward.ward_id],
            recent_7_day_count=recent_count,
            baseline_weekly_count=baseline_count,
            is_anomalous=anomaly,
            contributing_factors=factors,
            model_version=model.version,
            data_through=latest_utc,
            is_demo=True,
        ))
    snapshots.sort(key=lambda item: (item.risk_score is None, -(item.risk_score or 0), item.ward_id))
    return snapshots
