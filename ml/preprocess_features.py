"""Shared complaint feature extraction for training and inference."""

from typing import Mapping


FEATURES = ("complaint_type", "severity", "ward_id", "locality_id")
MISSING = "__missing__"


def complaint_features(record: Mapping[str, object]) -> dict[str, str]:
    """Normalize the same categorical inputs in every model path.

    Status is intentionally excluded: it may change after a complaint is filed
    and would leak future response information into an intake-time prediction.
    """
    result = {}
    for name in FEATURES:
        value = record.get(name)
        normalized = str(value).strip() if value is not None else ""
        result[name] = normalized or MISSING
    return result
