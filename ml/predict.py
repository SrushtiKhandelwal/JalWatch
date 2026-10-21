"""Load the fitted model and score a complaint without training packages."""

import json
from functools import lru_cache

from .model import CategoricalRiskModel
from .train import MODEL_PATH


@lru_cache(maxsize=1)
def load_model() -> CategoricalRiskModel:
    try:
        payload = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError("Risk model is missing; run python -m ml.train") from exc
    return CategoricalRiskModel.from_dict(payload)


def predict_risk(
    complaint_type: str,
    severity: str,
    ward_id: str,
    locality_id: str | None = None,
) -> float:
    return load_model().predict_score({
        "complaint_type": complaint_type,
        "severity": severity,
        "ward_id": ward_id,
        "locality_id": locality_id,
    })
