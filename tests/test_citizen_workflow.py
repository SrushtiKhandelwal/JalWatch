"""Connected citizen, investigation, and notice scenarios with isolated data."""

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.auth import LoginRequest, login, require_session
from backend.app.citizen_auth import register, require_citizen, update_location
from backend.app.config import settings
from backend.app.database import Base
from backend.app.models import Citizen, Complaint, Locality, NoticeRead, Ward
from backend.app.routers.citizen import my_complaint, my_complaints, submit_complaint
from backend.app.routers.clusters import list_clusters
from backend.app.routers.complaints import link_complaint_incident, update_complaint_status
from backend.app.routers.incidents import add_incident_note, create_incident, update_incident_status
from backend.app.routers.service_notices import (
    citizen_notices, create_notice, edit_notice, mark_notice_read, notice_action,
)
from backend.app.schemas import (
    CitizenComplaintCreate, CitizenRegistration, ComplaintStatusUpdate, ComplaintIncidentLink, IncidentNoteCreate,
    IncidentCreate, IncidentStatusUpdate, ServiceNoticeAction, ServiceNoticeCreate,
    ServiceNoticeEdit, CitizenLocationUpdate,
)


class CitizenWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.previous_secret = settings.SESSION_SECRET
        settings.SESSION_SECRET = "test-only-signing-secret-more-than-32-characters"
        self.engine = create_engine("sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([
            Ward(ward_id="W001", ward_number=1, ward_name="North", zone_id="Z01",
                 zone_name="North Zone", locality_count=1, representative_latitude=21.1, representative_longitude=79.1),
            Ward(ward_id="W002", ward_number=2, ward_name="South", zone_id="Z02",
                 zone_name="South Zone", locality_count=1, representative_latitude=21.2, representative_longitude=79.2),
            Locality(locality_id="L001", locality_name="North Area", ward_id="W001",
                     representative_latitude=21.1, representative_longitude=79.1),
            Locality(locality_id="L002", locality_name="South Area", ward_id="W002",
                     representative_latitude=21.2, representative_longitude=79.2),
        ])
        self.db.commit()
        self.north = self._register("north@example.test", "W001", "L001")
        self.south = self._register("south@example.test", "W002", "L002")

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        settings.SESSION_SECRET = self.previous_secret

    def _register(self, email, ward_id, locality_id):
        response = Response()
        profile = register(CitizenRegistration(
            full_name="Test Resident", email=email, password="long-test-password",
            password_confirm="long-test-password", address="123 Sample Road",
            ward_id=ward_id, locality_id=locality_id,
        ), response, self.db)
        cookie = response.headers["set-cookie"].split(";", 1)[0].encode()
        request = Request({"type": "http", "method": "GET", "path": "/api/auth/citizen/me",
                           "headers": [(b"cookie", cookie)]})
        citizen = require_citizen(request, self.db)
        self.assertEqual(citizen.citizen_id, profile.citizen_id)
        self.assertNotIn("password", response.body.decode())
        return citizen

    def test_citizen_and_admin_sessions_are_not_interchangeable(self):
        citizen_response = Response()
        from backend.app.citizen_auth import _set_cookie
        _set_cookie(citizen_response, self.north.citizen_id)
        citizen_cookie = citizen_response.headers["set-cookie"].split(";", 1)[0].encode()
        citizen_request = Request({"type": "http", "method": "GET", "path": "/api/dashboard/summary",
                                   "headers": [(b"cookie", citizen_cookie)]})
        with self.assertRaises(HTTPException) as denied:
            require_session(citizen_request)
        self.assertEqual(denied.exception.status_code, 401)

        previous_password = settings.ADMIN_PASSWORD
        try:
            settings.ADMIN_PASSWORD = "test-admin-password"
            admin_response = Response()
            login(LoginRequest(password="test-admin-password"), admin_response)
            admin_cookie = admin_response.headers["set-cookie"].split(";", 1)[0].encode()
            admin_request = Request({"type": "http", "method": "GET", "path": "/api/citizen/complaints",
                                     "headers": [(b"cookie", admin_cookie)]})
            with self.assertRaises(HTTPException) as denied:
                require_citizen(admin_request, self.db)
            self.assertEqual(denied.exception.status_code, 401)
        finally:
            settings.ADMIN_PASSWORD = previous_password

    def _complaint(self, citizen, ward="W001", locality="L001"):
        return submit_complaint(CitizenComplaintCreate(
            title="Low pressure at home", description="The tap pressure has dropped since morning.",
            complaint_type="low_pressure", address="123 Sample Road",
            ward_id=ward, locality_id=locality,
        ), citizen, self.db)

    def test_ownership_area_validation_and_status_history(self):
        with self.assertRaises(HTTPException) as invalid:
            self._complaint(self.north, locality="L002")
        self.assertEqual(invalid.exception.status_code, 422)

        created = self._complaint(self.north)
        self.assertEqual(created.data_origin, "citizen_submission")
        self.assertEqual(created.location_precision, "ward_representative")
        self.assertEqual(self.db.get(Complaint, created.complaint_id).citizen_id, self.north.citizen_id)
        self.assertEqual(my_complaints(1, 20, self.north, self.db).total, 1)
        self.assertEqual(my_complaints(1, 20, self.south, self.db).total, 0)
        with self.assertRaises(HTTPException) as denied:
            my_complaint(created.complaint_id, self.south, self.db)
        self.assertEqual(denied.exception.status_code, 404)

        update_complaint_status(created.complaint_id,
            ComplaintStatusUpdate(status="in_progress", note="Review started"), self.db)
        latest = my_complaint(created.complaint_id, self.north, self.db)
        self.assertEqual(latest.status, "in_progress")
        self.assertEqual([event.to_status for event in latest.events], ["open", "in_progress"])

    def test_cluster_can_become_incident_and_update_both_reports(self):
        first = self._complaint(self.north)
        second = self._complaint(self.north)
        suggestions = list_clusters(30, None, self.db)
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(set(suggestions[0].complaint_ids), {first.complaint_id, second.complaint_id})
        incident = create_incident(IncidentCreate(
            title="Investigate pressure", ward_id="W001", latitude=21.1, longitude=79.1,
            incident_type="pressure_drop", severity="high",
            related_complaint_ids=suggestions[0].complaint_ids,
        ), self.db)
        self.assertEqual(list_clusters(30, None, self.db), [])
        for status, crew, notes in [
            ("open", None, None), ("assigned", "North Crew", None),
            ("in_progress", None, None), ("resolved", None, "Supply restored"),
        ]:
            update_incident_status(incident.incident_id,
                IncidentStatusUpdate(status=status, assigned_to=crew, resolution_notes=notes), self.db)
        for identifier in suggestions[0].complaint_ids:
            record = my_complaint(identifier, self.north, self.db)
            self.assertEqual(record.incident_id, incident.incident_id)
            self.assertEqual(record.status, "resolved")
            self.assertIn("resolved", [event.to_status for event in record.events])

    def test_notices_targeting_revision_and_cancellation(self):
        start = datetime.now(timezone.utc) + timedelta(hours=1)
        created = create_notice(ServiceNoticeCreate(
            title="Water supply pause", notice_type="planned_cut",
            message="Supply will pause for maintenance.", target_kind="wards",
            target_ids=["W001"], starts_at=start, ends_at=start + timedelta(hours=2),
            publication="publish",
        ), self.db)
        self.assertEqual(len(citizen_notices(self.north, self.db)), 1)
        self.assertEqual(citizen_notices(self.south, self.db), [])
        self.assertFalse(citizen_notices(self.north, self.db)[0].is_read)
        mark_notice_read(created.id, self.north, self.db)
        self.assertTrue(citizen_notices(self.north, self.db)[0].is_read)
        self.assertEqual(self.db.query(NoticeRead).count(), 1)

        edit_notice(created.id, ServiceNoticeEdit(
            title="Water supply pause updated", notice_type="planned_cut",
            message="Maintenance now includes the main valve.", target_kind="wards",
            target_ids=["W001"], starts_at=start, ends_at=start + timedelta(hours=2),
            publication="publish",
        ), self.db)
        self.assertFalse(citizen_notices(self.north, self.db)[0].is_read)
        notice_action(created.id, ServiceNoticeAction(action="cancel"), self.db)
        self.assertEqual(citizen_notices(self.north, self.db)[0].status, "cancelled")
        self.assertFalse(citizen_notices(self.north, self.db)[0].is_read)

        draft = create_notice(ServiceNoticeCreate(
            title="Unpublished notice", notice_type="general", message="This is still a draft.",
            target_kind="citywide", publication="draft",
        ), self.db)
        notice_action(draft.id, ServiceNoticeAction(action="cancel"), self.db)
        self.assertEqual(len(citizen_notices(self.south, self.db)), 0)

    def test_scheduled_zone_notice_and_location_change(self):
        publish_at = datetime.now(timezone.utc) + timedelta(hours=1)
        notice = create_notice(ServiceNoticeCreate(
            title="South supply update", notice_type="interruption",
            message="Supply may be interrupted in the south zone.",
            target_kind="zones", target_ids=["Z02"], publish_at=publish_at,
            publication="publish",
        ), self.db)
        self.assertEqual(notice.status, "scheduled")
        self.assertEqual(citizen_notices(self.south, self.db), [])
        after = (publish_at + timedelta(seconds=1)).isoformat(timespec="seconds").replace("+00:00", "Z")
        with patch("backend.app.routers.service_notices._now", return_value=after):
            self.assertEqual(len(citizen_notices(self.south, self.db)), 1)
        self.assertEqual(citizen_notices(self.north, self.db), [])
        update_location(CitizenLocationUpdate(
            address="456 South Avenue", ward_id="W002", locality_id="L002",
        ), self.north, self.db)
        self.assertEqual(len(citizen_notices(self.north, self.db)), 1)

    def test_link_to_existing_incident_and_record_progress_note(self):
        complaint = self._complaint(self.north)
        incident = create_incident(IncidentCreate(
            title="Pressure investigation", ward_id="W001", latitude=21.1, longitude=79.1,
            incident_type="pressure_drop", severity="medium",
        ), self.db)
        linked = link_complaint_incident(complaint.complaint_id,
            ComplaintIncidentLink(incident_id=incident.incident_id), self.db)
        self.assertEqual(linked.incident_id, incident.incident_id)
        self.assertIn(complaint.complaint_id, incident.related_complaint_ids)
        event = add_incident_note(incident.incident_id,
            IncidentNoteCreate(note="Crew inspected the distribution valve.", share_with_citizens=True), self.db)
        self.assertEqual(event.to_status, "reported")
        self.assertIn("Crew inspected the distribution valve.",
            [entry.note for entry in my_complaint(complaint.complaint_id, self.north, self.db).events])
        with self.assertRaises(HTTPException) as duplicate:
            link_complaint_incident(complaint.complaint_id,
                ComplaintIncidentLink(incident_id=incident.incident_id), self.db)
        self.assertEqual(duplicate.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
