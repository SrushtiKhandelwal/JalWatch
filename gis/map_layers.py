"""
Map layers provider for JalWatch.

Builds standardized RFC 7946 GeoJSON FeatureCollections for:
- Ward representative points (with truthful boundary caveats)
- Water network nodes (synthetic preview)
- Water network distribution pipes (synthetic preview)
- Citizen grievances / complaints (with privacy filtering)
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from gis.spatial_utils import (
    create_feature_collection,
    create_geojson_feature,
    validate_geojson_geometry,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_FOLDER = PROJECT_ROOT / "data" / "processed"


def get_ward_points_layer(ward_id: Optional[str] = None) -> Dict[str, Any]:
    """Return GeoJSON FeatureCollection of ward representative centroid points."""
    geojson_path = PROCESSED_FOLDER / "wards_representative_points.geojson"
    if geojson_path.exists():
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if ward_id:
            data["features"] = [
                feat for feat in data.get("features", [])
                if feat.get("properties", {}).get("ward_id") == ward_id
            ]
            if "metadata" in data:
                data["metadata"]["feature_count"] = len(data["features"])
        return data

    return create_feature_collection([], metadata={"error": "Layer not found"})


def get_network_nodes_layer(
    ward_id: Optional[str] = None,
    node_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Return GeoJSON FeatureCollection of water network nodes (synthetic demo)."""
    geojson_path = PROCESSED_FOLDER / "water_network_nodes.geojson"
    if geojson_path.exists():
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = data.get("features", [])
        if ward_id:
            features = [f for f in features if f.get("properties", {}).get("ward_id") == ward_id]
        if node_type:
            features = [f for f in features if f.get("properties", {}).get("node_type") == node_type]

        data["features"] = features
        if "metadata" in data:
            data["metadata"]["feature_count"] = len(features)
        return data

    return create_feature_collection([], metadata={"error": "Layer not found"})


def get_network_pipes_layer(
    ward_id: Optional[str] = None,
    valve_status: Optional[str] = None,
    material: Optional[str] = None,
) -> Dict[str, Any]:
    """Return GeoJSON FeatureCollection of water network pipes (synthetic demo)."""
    geojson_path = PROCESSED_FOLDER / "water_network_pipes.geojson"
    if geojson_path.exists():
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = data.get("features", [])
        if ward_id:
            features = [f for f in features if f.get("properties", {}).get("ward_id") == ward_id]
        if valve_status:
            features = [f for f in features if f.get("properties", {}).get("valve_status") == valve_status]
        if material:
            features = [f for f in features if f.get("properties", {}).get("material") == material]

        data["features"] = features
        if "metadata" in data:
            data["metadata"]["feature_count"] = len(features)
        return data

    return create_feature_collection([], metadata={"error": "Layer not found"})


def build_complaint_feature(complaint_obj: Any) -> Optional[Dict[str, Any]]:
    """Build a single GeoJSON Feature from a Complaint model instance or dict."""
    if isinstance(complaint_obj, dict):
        cid = complaint_obj.get("complaint_id")
        lat = complaint_obj.get("latitude")
        lon = complaint_obj.get("longitude")
        ctype = complaint_obj.get("complaint_type")
        sev = complaint_obj.get("severity")
        stat = complaint_obj.get("status")
        wid = complaint_obj.get("ward_id")
        lid = complaint_obj.get("locality_id")
        rep_at = complaint_obj.get("reported_at")
    else:
        cid = getattr(complaint_obj, "complaint_id", None)
        lat = getattr(complaint_obj, "latitude", None)
        lon = getattr(complaint_obj, "longitude", None)
        ctype = getattr(complaint_obj, "complaint_type", None)
        sev = getattr(complaint_obj, "severity", None)
        stat = getattr(complaint_obj, "status", None)
        wid = getattr(complaint_obj, "ward_id", None)
        lid = getattr(complaint_obj, "locality_id", None)
        rep_at = getattr(complaint_obj, "reported_at", None)

    if lat is None or lon is None or cid is None:
        return None

    # Omit citizen_id to protect citizen privacy
    return create_geojson_feature(
        feature_id=str(cid),
        geometry={"type": "Point", "coordinates": [float(lon), float(lat)]},
        properties={
            "complaint_id": str(cid),
            "complaint_type": str(ctype or "unspecified"),
            "severity": str(sev or "medium"),
            "status": str(stat or "open"),
            "ward_id": str(wid or ""),
            "locality_id": str(lid or ""),
            "reported_at": str(rep_at) if rep_at else "",
        },
    )
