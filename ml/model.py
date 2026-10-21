"""Dependency-free categorical model for the synthetic JalWatch labels.

The score estimates the supplied heuristic label. It is not a validated
probability of a real future water incident.
"""

import math
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Mapping

from .preprocess_features import FEATURES, complaint_features


MODEL_VERSION = "categorical-nb-v1"
SMOOTHING = 1.0


@dataclass(frozen=True)
class CategoricalRiskModel:
    class_counts: dict[str, int]
    feature_counts: dict[str, dict[str, dict[str, int]]]
    vocabulary: dict[str, list[str]]
    temperature: float = 1.0
    version: str = MODEL_VERSION

    @classmethod
    def fit(cls, rows: Iterable[Mapping[str, object]]) -> "CategoricalRiskModel":
        class_counts = Counter()
        feature_counts = {
            label: {feature: Counter() for feature in FEATURES}
            for label in ("0", "1")
        }
        vocabulary = {feature: set() for feature in FEATURES}

        for row in rows:
            label = str(row.get("incident_risk_label", "")).strip()
            if label not in ("0", "1"):
                raise ValueError(f"Invalid incident_risk_label: {label!r}")
            values = complaint_features(row)
            class_counts[label] += 1
            for feature, value in values.items():
                feature_counts[label][feature][value] += 1
                vocabulary[feature].add(value)

        if min(class_counts["0"], class_counts["1"]) == 0:
            raise ValueError("Training data must contain both label classes")

        return cls(
            class_counts=dict(class_counts),
            feature_counts={
                label: {feature: dict(counts) for feature, counts in by_feature.items()}
                for label, by_feature in feature_counts.items()
            },
            vocabulary={feature: sorted(values) for feature, values in vocabulary.items()},
        )

    def log_odds(self, record: Mapping[str, object]) -> float:
        values = complaint_features(record)
        total = sum(self.class_counts.values())
        log_scores = {}
        for label in ("0", "1"):
            count = self.class_counts[label]
            score = math.log((count + SMOOTHING) / (total + 2 * SMOOTHING))
            for feature, value in values.items():
                counts = self.feature_counts[label][feature]
                categories = len(self.vocabulary[feature]) + 1
                score += math.log(
                    (counts.get(value, 0) + SMOOTHING)
                    / (count + SMOOTHING * categories)
                )
            log_scores[label] = score
        return log_scores["1"] - log_scores["0"]

    def predict_score(self, record: Mapping[str, object]) -> float:
        margin = self.log_odds(record) / self.temperature
        if margin >= 0:
            return 1 / (1 + math.exp(-margin))
        exp_margin = math.exp(margin)
        return exp_margin / (1 + exp_margin)

    def with_temperature(self, temperature: float) -> "CategoricalRiskModel":
        if temperature <= 0:
            raise ValueError("Temperature must be positive")
        return CategoricalRiskModel(
            class_counts=self.class_counts,
            feature_counts=self.feature_counts,
            vocabulary=self.vocabulary,
            temperature=temperature,
            version=self.version,
        )

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "temperature": self.temperature,
            "features": list(FEATURES),
            "class_counts": self.class_counts,
            "feature_counts": self.feature_counts,
            "vocabulary": self.vocabulary,
            "label_origin": "synthetic_heuristic",
        }

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> "CategoricalRiskModel":
        if payload.get("version") != MODEL_VERSION or payload.get("features") != list(FEATURES):
            raise ValueError("Unsupported risk model artifact")
        return cls(
            class_counts=payload["class_counts"],
            feature_counts=payload["feature_counts"],
            vocabulary=payload["vocabulary"],
            temperature=float(payload["temperature"]),
            version=MODEL_VERSION,
        )
