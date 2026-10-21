"""Model and alert integration checks with an isolated database."""

import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.database import Base
from backend.app.models import Alert, Complaint, Locality, Ward
from backend.app.routers.predictions import (
    get_all_predictions,
    predict_risk,
    scan_for_alerts,
)
from backend.app.routers.wards import get_ward_localities
from backend.app.schemas import PredictionRequest, ScanRequest
from ml.anomaly import weekly_activity
from ml.model import CategoricalRiskModel


class ModelTests(unittest.TestCase):
    def test_serialized_model_scores_unseen_categories(self):
        rows = [
            {"incident_risk_label": label, "complaint_type": kind,
             "severity": severity, "ward_id": "W001", "locality_id": "L001"}
            for label, kind, severity in [
                ("0", "low_pressure", "low"),
                ("0", "low_pressure", "low"),
                ("1", "leakage", "critical"),
                ("1", "leakage", "critical"),
            ]
        ]
        model = CategoricalRiskModel.fit(rows)
        restored = CategoricalRiskModel.from_dict(model.to_dict())
        high = restored.predict_score(rows[-1])
        low = restored.predict_score(rows[0])
        unseen = restored.predict_score({
            "complaint_type": "new_type", "severity": "medium",
            "ward_id": "W999", "locality_id": None,
        })
        self.assertGreater(high, low)
        self.assertTrue(0 < unseen < 1)
        self.assertAlmostEqual(high, model.predict_score(rows[-1]))

    def test_count_spike_uses_previous_four_weeks(self):
        today = datetime.now(timezone.utc).date()
        reports = [
            ("W001", datetime.combine(today - timedelta(days=1), datetime.min.time(), timezone.utc))
            for _ in range(8)
        ] + [
            ("W001", datetime.combine(today - timedelta(days=10), datetime.min.time(), timezone.utc))
            for _ in range(4)
        ]
        result = weekly_activity(reports, today)["W001"]
        self.assertEqual(result["recent_count"], 8)
        self.assertEqual(result["baseline_weekly_count"], 1)
        self.assertTrue(result["is_anomalous"])


class PredictionIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(Ward(
            ward_id="W001", ward_number=1, ward_name="Ward One",
            zone_id="Z01", zone_name="Central", locality_count=1,
            representative_latitude=21.1, representative_longitude=79.1,
        ))
        self.db.add(Locality(
            locality_id="L001", locality_name="Test locality", ward_id="W001",
            representative_latitude=21.1, representative_longitude=79.1,
            geometry_precision="ward_representative",
        ))
        self.db.add(Complaint(
            complaint_id="CMP001", ward_id="W001", locality_id="L001",
            reported_at=datetime.now(timezone.utc) - timedelta(days=1),
            complaint_type="leakage", severity="critical", status="open",
            latitude=21.1, longitude=79.1,
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_localities_and_prediction_contract(self):
        self.assertEqual(get_ward_localities("W001", self.db)[0].locality_id, "L001")
        result = predict_risk(PredictionRequest(
            complaint_type="leakage", severity="critical",
            ward_id="W001", locality_id="L001",
        ), self.db)
        self.assertGreaterEqual(result.risk_score, 0)
        self.assertLessEqual(result.risk_score, 1)
        self.assertEqual(len(get_all_predictions(self.db)), 1)
        with self.assertRaises(HTTPException) as raised:
            predict_risk(PredictionRequest(
                complaint_type="leakage", severity="critical",
                ward_id="W001", locality_id="L999",
            ), self.db)
        self.assertEqual(raised.exception.status_code, 422)

    def test_stale_scan_requires_override_and_deduplicates(self):
        complaint = self.db.query(Complaint).one()
        complaint.reported_at = datetime.now(timezone.utc) - timedelta(days=30)
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            scan_for_alerts(ScanRequest(), self.db)
        self.assertEqual(raised.exception.status_code, 409)
        first = scan_for_alerts(ScanRequest(allow_stale_demo_data=True), self.db)
        second = scan_for_alerts(ScanRequest(allow_stale_demo_data=True), self.db)
        self.assertEqual(first.created_alerts, 1)
        self.assertEqual(second.created_alerts, 0)
        self.assertEqual(self.db.query(Alert).count(), 1)
        self.assertEqual(self.db.query(Alert).one().source, "demo_model")


if __name__ == "__main__":
    unittest.main()
