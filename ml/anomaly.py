"""Detect unusually high recent complaint volume by ward.

The comparison uses the latest seven calendar days in the data against the
average of the four preceding seven-day periods. It is a count rule, not a
claim about sensor telemetry or causal incident prediction.
"""

from collections import Counter
from datetime import date, datetime, timedelta
from typing import Iterable


def weekly_activity(
    reports: Iterable[tuple[str, datetime]],
    reference_date: date,
) -> dict[str, dict[str, float | int | bool]]:
    recent_start = reference_date - timedelta(days=6)
    baseline_start = recent_start - timedelta(days=28)
    recent = Counter()
    baseline = Counter()

    for ward_id, reported_at in reports:
        reported_date = reported_at.date()
        if recent_start <= reported_date <= reference_date:
            recent[ward_id] += 1
        elif baseline_start <= reported_date < recent_start:
            baseline[ward_id] += 1

    activity = {}
    for ward_id in recent.keys() | baseline.keys():
        current = recent[ward_id]
        weekly_baseline = baseline[ward_id] / 4
        activity[ward_id] = {
            "recent_count": current,
            "baseline_weekly_count": round(weekly_baseline, 2),
            "is_anomalous": (
                current >= 5
                and current >= weekly_baseline * 2
                and current - weekly_baseline >= 3
            ),
        }
    return activity
