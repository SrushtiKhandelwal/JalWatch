"""
Spatial utilities for JalWatch GIS processing and validation.

Provides geometry validation, coordinate range checks, GeoJSON formatting,
and boundary verification for Nagpur municipal water infrastructure.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple, Union

# Nagpur Municipal Corporation geographical bounding box (WGS84)
# Latitude: ~21.05 to ~21.25 N
# Longitude: ~79.00 to ~79.25 E
NAGPUR_BBOX = {
    "min_lat": 21.00,
    "max_lat": 21.30,
    "min_lon": 79.00,
    "max_lon": 79.30,
}

# City center fallback coordinates (Latitude, Longitude)
NAGPUR_CENTER_LAT = 21.1458
NAGPUR_CENTER_LON = 79.0882


def is_valid_coordinate(
    lat: Any,
    lon: Any,
    bbox: Optional[Dict[str, float]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Validate that latitude and longitude are valid numeric floats within expected bounds.
    Returns (is_valid, error_reason).
    """
    if lat is None or lon is None:
        return False, "Null coordinate"

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        return False, f"Non-numeric coordinates: lat={lat}, lon={lon}"

    if math.isnan(lat_f) or math.isnan(lon_f) or math.isinf(lat_f) or math.isinf(lon_f):
        return False, "Coordinate is NaN or Inf"

    # WGS84 global valid range
    if not (-90.0 <= lat_f <= 90.0):
        return False, f"Latitude {lat_f} out of global range [-90, 90]"
    if not (-180.0 <= lon_f <= 180.0):
        return False, f"Longitude {lon_f} out of global range [-180, 180]"

    # Check for inverted lat/lon (lon is around 79, lat is around 21 for Nagpur)
    if lat_f > 70.0 and lon_f < 30.0:
        return False, f"Suspected inverted coordinates: lat={lat_f}, lon={lon_f}"

    bounds = bbox or NAGPUR_BBOX
    if not (bounds["min_lat"] <= lat_f <= bounds["max_lat"]):
        return False, f"Latitude {lat_f} outside Nagpur bounds [{bounds['min_lat']}, {bounds['max_lat']}]"
    if not (bounds["min_lon"] <= lon_f <= bounds["max_lon"]):
        return False, f"Longitude {lon_f} outside Nagpur bounds [{bounds['min_lon']}, {bounds['max_lon']}]"

    return True, None


def is_pdf_reference(val: Any) -> bool:
    """
    Detect whether a boundary string is a reference to an external PDF document
    instead of genuine GeoJSON geometry.
    """
    if not val or not isinstance(val, str):
        return False
    stripped = val.strip().lower()
    return (
        stripped.endswith(".pdf")
        or ".pdf?" in stripped
        or ".pdf|" in stripped
        or "nmc%20gis%20full%20map.pdf" in stripped
        or stripped.startswith("http://")
        or stripped.startswith("https://")
    )


def validate_geojson_geometry(
    geom: Union[str, Dict[str, Any]],
    expected_type: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Validate GeoJSON geometry.
    Ensures valid JSON, correct geometry type, valid coordinate format and ordering ([lon, lat]).
    Returns (is_valid, parsed_dict, error_message).
    """
    if isinstance(geom, str):
        if is_pdf_reference(geom):
            return False, None, f"Geometry string is a PDF document URL reference, not GeoJSON: {geom[:60]}..."
        try:
            parsed = json.loads(geom)
        except json.JSONDecodeError as err:
            return False, None, f"Malformed JSON string: {err}"
    elif isinstance(geom, dict):
        parsed = geom
    else:
        return False, None, f"Unsupported geometry type: {type(geom)}"

    if not isinstance(parsed, dict) or "type" not in parsed or "coordinates" not in parsed:
        return False, None, "Missing 'type' or 'coordinates' in geometry dictionary"

    geom_type = parsed["type"]
    if expected_type and geom_type != expected_type:
        return False, None, f"Expected geometry type '{expected_type}', got '{geom_type}'"

    coords = parsed["coordinates"]

    if geom_type == "Point":
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            return False, None, f"Invalid Point coordinates: {coords}"
        lon, lat = coords[0], coords[1]
        valid_coord, reason = is_valid_coordinate(lat, lon)
        if not valid_coord:
            return False, None, f"Point coordinate invalid: {reason}"

    elif geom_type == "LineString":
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            return False, None, f"LineString must contain at least 2 coordinate pairs, got: {coords}"
        for idx, pt in enumerate(coords):
            if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                return False, None, f"LineString vertex #{idx} is not [lon, lat]: {pt}"
            lon, lat = pt[0], pt[1]
            valid_coord, reason = is_valid_coordinate(lat, lon)
            if not valid_coord:
                return False, None, f"LineString vertex #{idx} invalid: {reason}"

    elif geom_type == "Polygon":
        if not isinstance(coords, (list, tuple)) or len(coords) < 1:
            return False, None, "Polygon must contain at least one linear ring"
        for ring_idx, ring in enumerate(coords):
            if not isinstance(ring, (list, tuple)) or len(ring) < 4:
                return False, None, f"Linear ring #{ring_idx} must have at least 4 positions"
            if ring[0] != ring[-1]:
                return False, None, f"Linear ring #{ring_idx} is not closed (first != last)"
            for pt_idx, pt in enumerate(ring):
                lon, lat = pt[0], pt[1]
                valid_coord, reason = is_valid_coordinate(lat, lon)
                if not valid_coord:
                    return False, None, f"Polygon ring #{ring_idx} vertex #{pt_idx} invalid: {reason}"

    else:
        return False, None, f"Unsupported GeoJSON geometry type: {geom_type}"

    return True, parsed, None


def create_geojson_feature(
    feature_id: Union[str, int],
    geometry: Dict[str, Any],
    properties: Dict[str, Any],
) -> Dict[str, Any]:
    """Create a standard RFC 7946 GeoJSON Feature object."""
    return {
        "type": "Feature",
        "id": feature_id,
        "geometry": geometry,
        "properties": properties,
    }


def create_feature_collection(
    features: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a standard RFC 7946 GeoJSON FeatureCollection with optional metadata."""
    fc: Dict[str, Any] = {
        "type": "FeatureCollection",
        "features": features,
    }
    if metadata:
        fc["metadata"] = metadata
    return fc


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    r = 6371.0  # Earth's radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c
