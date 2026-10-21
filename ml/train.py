"""Train the synthetic-label model with a chronological holdout.

Run from the repository root with ``python -m ml.train``.
"""

import csv
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

from .model import CategoricalRiskModel


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "raw" / "jalwatch_complaints_final_50000.csv"
MODEL_PATH = ROOT / "ml" / "models" / "risk_model.json"
EVALUATION_PATH = ROOT / "ml" / "models" / "evaluation.json"


def evaluate(model: CategoricalRiskModel, rows: list[dict]) -> dict:
    tp = fp = tn = fn = 0
    brier = 0.0
    log_loss = 0.0
    for row in rows:
        expected = int(row["incident_risk_label"])
        score = model.predict_score(row)
        predicted = int(score >= 0.5)
        if expected and predicted:
            tp += 1
        elif expected:
            fn += 1
        elif predicted:
            fp += 1
        else:
            tn += 1
        brier += (score - expected) ** 2
        clipped = min(max(score, 1e-12), 1 - 1e-12)
        log_loss -= expected * math.log(clipped) + (1 - expected) * math.log(1 - clipped)
    count = len(rows)
    return {
        "rows": count,
        "positive_rate": round((tp + fn) / count, 4),
        "accuracy": round((tp + tn) / count, 4),
        "precision": round(tp / (tp + fp), 4) if tp + fp else None,
        "recall": round(tp / (tp + fn), 4) if tp + fn else None,
        "f1": round(2 * tp / (2 * tp + fp + fn), 4) if 2 * tp + fp + fn else None,
        "brier_score": round(brier / count, 4),
        "log_loss": round(log_loss / count, 4),
    }


def _atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def train(data_path: Path = DATA_PATH, model_path: Path = MODEL_PATH) -> dict:
    with data_path.open(newline="", encoding="utf-8-sig") as source:
        rows = list(csv.DictReader(source))
    rows = [row for row in rows if row.get("incident_risk_label") in ("0", "1")]
    rows.sort(key=lambda row: row["reported_at"])
    if len(rows) < 100:
        raise ValueError("At least 100 labeled complaints are needed")

    cutoff = int(len(rows) * 0.8)
    training, holdout = rows[:cutoff], rows[cutoff:]

    # Calibrate using only a subset of training data, keeping holdout untouched.
    calibration_size = max(1000, len(training) // 10)
    calibration = training[-calibration_size:]
    base_model = CategoricalRiskModel.fit(training[:-calibration_size])
    temperatures = (0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0)
    temperature = min(
        temperatures,
        key=lambda value: evaluate(base_model.with_temperature(value), calibration)["log_loss"],
    )
    model = CategoricalRiskModel.fit(training).with_temperature(temperature)

    report = {
        "model_version": model.version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": len(training),
        "holdout_start": holdout[0]["reported_at"],
        "holdout_end": holdout[-1]["reported_at"],
        "temperature": temperature,
        "label_origin": "synthetic_heuristic",
        "limitations": "Scores estimate synthetic heuristic labels, not verified future incidents.",
        "holdout": evaluate(model, holdout),
    }
    _atomic_json(model_path, model.to_dict())
    _atomic_json(model_path.with_name("evaluation.json"), report)
    return report


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
