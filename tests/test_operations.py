"""Operational contract tests using an isolated in-memory database."""

import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.auth import LoginRequest, access_configured, login, require_session
from backend.app.config import settings
from backend.app.database import Base
from backend.app.models import Alert, AlertEvent, Complaint, Incident, IncidentEvent, Ward
from backend.app.routers.alerts import create_alert, evaluate_risk_signal, update_alert_status
from backend.app.routers.dashboard import get_complaint_trends, get_dashboard_summary, get_ward_priorities
from backend.app.routers.incidents import create_incident, update_incident_status
from backend.app.schemas import AlertCreate, AlertUpdate, IncidentCreate, IncidentStatusUpdate, RiskSignal


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([
            Ward(ward_id="W001", ward_number=1, ward_name="Ward One", zone_id="Z01",
                 zone_name="Central", locality_count=1, representative_latitude=21.1,
                 representative_longitude=79.1),
            Ward(ward_id="W002", ward_number=2, ward_name="Ward Two", zone_id="Z01",
                 zone_name="Central", locality_count=1, representative_latitude=21.2,
                 representative_longitude=79.2),
        ])
        now = datetime.now(timezone.utc)
        self.db.add(Complaint(
            complaint_id="CMP000001", ward_id="W001", reported_at=now - timedelta(hours=8),
            complaint_type="leakage", latitude=21.1, longitude=79.1, severity="critical",
            status="resolved", resolved_at=now - timedelta(hours=2),
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_incident_lifecycle_and_history(self):
        incident = create_incident(IncidentCreate(
            title="Pipe repair", ward_id="W001", latitude=21.1, longitude=79.1,
            incident_type="pipe_burst", severity="high",
            related_complaint_ids=["CMP000001"],
        ), self.db)
        self.assertTrue(incident.incident_id.startswith("INC-"))
        self.assertEqual(incident.status, "reported")
        for status, crew, notes in [
            ("open", None, None),
            ("assigned", "Central Crew", None),
            ("in_progress", None, None),
            ("resolved", None, "Pipe replaced and supply restored"),
            ("closed", None, None),
        ]:
            incident = update_incident_status(incident.incident_id, IncidentStatusUpdate(
                status=status, assigned_to=crew, resolution_notes=notes,
            ), self.db)
        self.assertEqual(incident.status, "closed")
        self.assertEqual(incident.assigned_to, "Central Crew")
        self.assertIsNotNone(incident.resolved_at)
        self.assertIsNotNone(incident.closed_at)
        events = self.db.query(IncidentEvent).filter_by(incident_id=incident.incident_id).all()
        self.assertEqual([event.to_status for event in events], [
            "reported", "open", "assigned", "in_progress", "resolved", "closed",
        ])
        # Repeating a completed transition does not append another event.
        update_incident_status(incident.incident_id, IncidentStatusUpdate(status="closed"), self.db)
        self.assertEqual(self.db.query(IncidentEvent).filter_by(incident_id=incident.incident_id).count(), 6)

    def test_incident_validation_rejects_invalid_work(self):
        payload = IncidentCreate(
            title="Pipe repair", ward_id="W002", latitude=21.2, longitude=79.2,
            incident_type="pipe_burst", severity="high", related_complaint_ids=["CMP000001"],
        )
        with self.assertRaises(HTTPException) as error:
            create_incident(payload, self.db)
        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(self.db.query(Incident).count(), 0)

        incident = create_incident(payload.model_copy(update={"related_complaint_ids": []}), self.db)
        update_incident_status(incident.incident_id, IncidentStatusUpdate(status="open"), self.db)
        with self.assertRaises(HTTPException) as error:
            update_incident_status(incident.incident_id, IncidentStatusUpdate(status="assigned"), self.db)
        self.assertEqual(error.exception.status_code, 422)
        with self.assertRaises(HTTPException) as error:
            update_incident_status(incident.incident_id, IncidentStatusUpdate(status="resolved"), self.db)
        self.assertEqual(error.exception.status_code, 409)

    def test_alert_lifecycle_and_model_signal_contract(self):
        manual = create_alert(AlertCreate(
            alert_type="early_warning", severity="high", ward_id="W001",
            title="Pressure warning", description="Pressure readings need review",
        ), self.db)
        self.assertEqual(manual.source, "manual")
        self.assertEqual(manual.risk_score, 0)
        update_alert_status(manual.id, AlertUpdate(status="acknowledged"), self.db)
        update_alert_status(manual.id, AlertUpdate(status="resolved"), self.db)
        with self.assertRaises(HTTPException) as error:
            update_alert_status(manual.id, AlertUpdate(status="acknowledged"), self.db)
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(AlertEvent).filter_by(alert_id=manual.id).count(), 3)

        signal = RiskSignal(
            ward_id="W001", risk_score=0.91, severity_prediction="critical",
            model_version="test-1", contributing_factors=["Complaint cluster"],
            generated_at=datetime.now(timezone.utc),
        )
        first = evaluate_risk_signal(signal, self.db)
        second = evaluate_risk_signal(signal, self.db)
        self.assertTrue(first.alert_created)
        self.assertFalse(second.alert_created)
        self.assertEqual(first.alert.id, second.alert.id)
        self.assertEqual(first.alert.source, "ml_model")

    def test_dashboard_reports_observed_values(self):
        summary = get_dashboard_summary(self.db)
        self.assertEqual(summary.total_complaints, 1)
        self.assertEqual(summary.avg_resolution_hours, 6.0)
        priorities = get_ward_priorities(30, self.db)
        self.assertEqual(priorities[0].ward_id, "W001")
        self.assertEqual(priorities[0].critical_complaints, 1)
        trend = get_complaint_trends(7, self.db)
        self.assertEqual(len(trend), 7)
        self.assertEqual(sum(day.count for day in trend), 1)

class AuthTests(unittest.TestCase):
    def test_session_required_and_signed(self):
        previous_password = settings.ADMIN_PASSWORD
        previous_secret = settings.SESSION_SECRET
        try:
            settings.ADMIN_PASSWORD = "strong-test-password"
            settings.SESSION_SECRET = "a-test-signing-secret-longer-than-32-chars"
            self.assertTrue(access_configured())
            no_cookie = Request({"type": "http", "method": "GET", "path": "/api/wards", "headers": []})
            with self.assertRaises(HTTPException) as error:
                require_session(no_cookie)
            self.assertEqual(error.exception.status_code, 401)
            response = Response()
            login(LoginRequest(password="strong-test-password"), response)
            cookie = response.headers["set-cookie"].split(";", 1)[0].encode("ascii")
            authenticated = Request({
                "type": "http", "method": "GET", "path": "/api/wards",
                "headers": [(b"cookie", cookie)],
            })
            require_session(authenticated)
        finally:
            settings.ADMIN_PASSWORD = previous_password
            settings.SESSION_SECRET = previous_secret


if __name__ == "__main__":
    unittest.main()
