"""
GIS, spatial data validation, and network endpoint tests.
"""

import json
import unittest
from datetime import datetime, timezone

from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.app.auth import LoginRequest, login, require_session
from backend.app.config import settings
from backend.app.database import Base
from backend.app.models import NetworkNode, NetworkPipe, Ward
from backend.app.routers.network import get_network_nodes, get_network_pipes, get_network_summary
from gis.spatial_utils import (
    NAGPUR_BBOX,
    is_pdf_reference,
    is_valid_coordinate,
    validate_geojson_geometry,
)


class SpatialUtilsTests(unittest.TestCase):
    def test_valid_nagpur_coordinate(self):
        valid, reason = is_valid_coordinate(21.1458, 79.0882)
        self.assertTrue(valid)
        self.assertIsNone(reason)

    def test_out_of_bounds_coordinate(self):
        # Mumbai coordinate: lat 19.07, lon 72.87
        valid, reason = is_valid_coordinate(19.0760, 72.8777)
        self.assertFalse(valid)
        self.assertIn("outside Nagpur bounds", reason)

    def test_inverted_coordinate_detected(self):
        # Inverted: lat ~79, lon ~21
        valid, reason = is_valid_coordinate(79.0882, 21.1458)
        self.assertFalse(valid)
        self.assertIn("suspected inverted", reason.lower())

    def test_null_and_nan_coordinates(self):
        valid, reason = is_valid_coordinate(None, 79.0)
        self.assertFalse(valid)
        self.assertEqual(reason, "Null coordinate")

        valid, reason = is_valid_coordinate(float("nan"), 79.0)
        self.assertFalse(valid)
        self.assertIn("NaN", reason)

    def test_pdf_reference_detection(self):
        pdf_url = "https://election.nagpurnmc.in/storage/uploads/1759544972_NMC%20GIS%20Full%20Map.pdf"
        self.assertTrue(is_pdf_reference(pdf_url))
        self.assertTrue(is_pdf_reference("http://example.org/map.pdf"))
        self.assertFalse(is_pdf_reference('{"type":"Point","coordinates":[79.1,21.1]}'))
        self.assertFalse(is_pdf_reference(""))
        self.assertFalse(is_pdf_reference(None))

    def test_validate_geojson_point(self):
        valid_point = '{"type":"Point","coordinates":[79.0814, 21.1847]}'
        is_valid, parsed, err = validate_geojson_geometry(valid_point, expected_type="Point")
        self.assertTrue(is_valid)
        self.assertEqual(parsed["type"], "Point")
        self.assertIsNone(err)

    def test_validate_geojson_linestring(self):
        valid_line = '{"type":"LineString","coordinates":[[79.0814,21.1847],[79.1299,21.1583]]}'
        is_valid, parsed, err = validate_geojson_geometry(valid_line, expected_type="LineString")
        self.assertTrue(is_valid)
        self.assertEqual(parsed["type"], "LineString")
        self.assertEqual(len(parsed["coordinates"]), 2)
        self.assertIsNone(err)

    def test_reject_pdf_as_geometry(self):
        pdf_url = "https://election.nagpurnmc.in/storage/uploads/1759544972_NMC%20GIS%20Full%20Map.pdf"
        is_valid, parsed, err = validate_geojson_geometry(pdf_url, expected_type="Polygon")
        self.assertFalse(is_valid)
        self.assertIsNone(parsed)
        self.assertIn("PDF document URL reference", err)

    def test_reject_invalid_linestring_vertices(self):
        one_pt_line = '{"type":"LineString","coordinates":[[79.0814,21.1847]]}'
        is_valid, parsed, err = validate_geojson_geometry(one_pt_line, expected_type="LineString")
        self.assertFalse(is_valid)
        self.assertIn("at least 2 coordinate pairs", err)


class NetworkEndpointTests(unittest.TestCase):
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
            zone_id="Z01", zone_name="Central", locality_count=5,
            representative_latitude=21.1458, representative_longitude=79.0882,
        ))
        self.db.add(Ward(
            ward_id="W002", ward_number=2, ward_name="Ward Two",
            zone_id="Z01", zone_name="Central", locality_count=3,
            representative_latitude=21.1500, representative_longitude=79.0900,
        ))

        self.db.add_all([
            NetworkNode(
                node_id="N00001", node_type="junction", ward_id="W001",
                latitude=21.1458, longitude=79.0882, elevation_m=300.0,
                data_origin="synthetic", scenario_id="SCN-01",
            ),
            NetworkNode(
                node_id="N00002", node_type="valve", ward_id="W002",
                latitude=21.1500, longitude=79.0900, elevation_m=305.0,
                data_origin="synthetic", scenario_id="SCN-01",
            ),
        ])

        geom_str = json.dumps({
            "type": "LineString",
            "coordinates": [[79.0882, 21.1458], [79.0900, 21.1500]],
        })
        self.db.add(NetworkPipe(
            pipe_id="P00001", from_node_id="N00001", to_node_id="N00002",
            geometry=geom_str, diameter_mm=100, material="DI", length_m=520.5,
            valve_status="open", flow_direction="forward", ward_id="W001",
            data_origin="synthetic", scenario_id="SCN-01",
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_get_network_nodes_geojson(self):
        result = get_network_nodes(ward_id=None, node_type=None, db=self.db)
        self.assertEqual(result["type"], "FeatureCollection")
        self.assertEqual(len(result["features"]), 2)

        feat0 = result["features"][0]
        self.assertEqual(feat0["type"], "Feature")
        self.assertEqual(feat0["geometry"]["type"], "Point")
        # Ensure longitude, latitude order
        self.assertEqual(feat0["geometry"]["coordinates"], [79.0882, 21.1458])
        self.assertEqual(feat0["properties"]["node_id"], "N00001")
        self.assertTrue(feat0["properties"]["is_demo"])
        self.assertEqual(feat0["properties"]["data_origin"], "synthetic")

        self.assertIn("metadata", result)
        self.assertTrue(result["metadata"]["is_demo"])
        self.assertIn("Synthetic demonstration", result["metadata"]["disclaimer"])

    def test_get_network_nodes_filter_by_ward(self):
        result = get_network_nodes(ward_id="W001", node_type=None, db=self.db)
        self.assertEqual(len(result["features"]), 1)
        self.assertEqual(result["features"][0]["properties"]["ward_id"], "W001")

    def test_get_network_pipes_geojson(self):
        result = get_network_pipes(ward_id=None, valve_status=None, material=None, db=self.db)
        self.assertEqual(result["type"], "FeatureCollection")
        self.assertEqual(len(result["features"]), 1)

        feat = result["features"][0]
        self.assertEqual(feat["id"], "P00001")
        self.assertEqual(feat["geometry"]["type"], "LineString")
        coords = feat["geometry"]["coordinates"]
        self.assertEqual(len(coords), 2)
        # Verify [lon, lat] ordering
        self.assertAlmostEqual(coords[0][0], 79.0882)
        self.assertAlmostEqual(coords[0][1], 21.1458)
        self.assertEqual(feat["properties"]["diameter_mm"], 100)
        self.assertEqual(feat["properties"]["material"], "DI")
        self.assertTrue(feat["properties"]["is_demo"])

    def test_get_network_pipes_filter_by_ward(self):
        w1_result = get_network_pipes(ward_id="W001", valve_status=None, material=None, db=self.db)
        self.assertEqual(len(w1_result["features"]), 1)
        w2_result = get_network_pipes(ward_id="W002", valve_status=None, material=None, db=self.db)
        self.assertEqual(len(w2_result["features"]), 0)

    def test_get_network_summary(self):
        summary = get_network_summary(self.db)
        self.assertEqual(summary.total_nodes, 2)
        self.assertEqual(summary.total_pipes, 1)
        self.assertAlmostEqual(summary.total_pipe_length_km, 0.52)
        self.assertEqual(summary.materials.get("DI"), 1)
        self.assertTrue(summary.is_demo)


class NetworkAuthTests(unittest.TestCase):
    def test_network_endpoints_require_session(self):
        previous_password = settings.ADMIN_PASSWORD
        previous_secret = settings.SESSION_SECRET
        try:
            settings.ADMIN_PASSWORD = "test-password-123"
            settings.SESSION_SECRET = "signing-secret-longer-than-thirty-two-chars"

            # Unauthenticated request
            unauth_req = Request({
                "type": "http",
                "method": "GET",
                "path": "/api/network/nodes",
                "headers": [],
            })
            with self.assertRaises(HTTPException) as ctx:
                require_session(unauth_req)
            self.assertEqual(ctx.exception.status_code, 401)

            # Authenticated request with session cookie
            res = Response()
            login(LoginRequest(password="test-password-123"), res)
            cookie = res.headers["set-cookie"].split(";", 1)[0].encode("ascii")
            auth_req = Request({
                "type": "http",
                "method": "GET",
                "path": "/api/network/nodes",
                "headers": [(b"cookie", cookie)],
            })
            require_session(auth_req)  # Should not raise
        finally:
            settings.ADMIN_PASSWORD = previous_password
            settings.SESSION_SECRET = previous_secret


if __name__ == "__main__":
    unittest.main()
