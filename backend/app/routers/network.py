"""
Network GIS API: Serve water distribution infrastructure layers (nodes and pipes).

All network layers are marked as synthetic demonstration data for Nagpur.
Returns valid RFC 7946 GeoJSON FeatureCollections with [longitude, latitude] coordinates.
"""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import NetworkNode, NetworkPipe
from ..schemas import GeoJSONFeatureCollection, NetworkSummary
from gis.map_layers import get_network_nodes_layer, get_network_pipes_layer

router = APIRouter(prefix="/network", tags=["Network"])

SYNTHETIC_DISCLAIMER = (
    "Synthetic demonstration water network data for Nagpur. "
    "Not verified municipal infrastructure or live telemetry."
)


@router.get("/nodes", response_model=GeoJSONFeatureCollection)
def get_network_nodes(
    ward_id: Optional[str] = Query(None, description="Filter nodes by ward ID (e.g. W001)"),
    node_type: Optional[str] = Query(None, description="Filter by node type (junction, valve, pump_station, tank, reservoir)"),
    db: Session = Depends(get_db),
):
    """
    Get water network nodes as a GeoJSON FeatureCollection.

    - Returns Point geometries with coordinates [longitude, latitude].
    - Includes synthetic demo metadata.
    """
    total_in_db = db.query(func.count(NetworkNode.node_id)).scalar() or 0
    if total_in_db == 0:
        layer_data = get_network_nodes_layer(ward_id=ward_id, node_type=node_type)
        if layer_data.get("features"):
            return layer_data

    query = db.query(NetworkNode)
    if ward_id:
        query = query.filter(NetworkNode.ward_id == ward_id)
    if node_type:
        query = query.filter(NetworkNode.node_type == node_type)

    nodes = query.all()

    features: List[Dict[str, Any]] = []
    for node in nodes:
        features.append({
            "type": "Feature",
            "id": node.node_id,
            "geometry": {
                "type": "Point",
                "coordinates": [node.longitude, node.latitude],
            },
            "properties": {
                "node_id": node.node_id,
                "node_type": node.node_type,
                "ward_id": node.ward_id,
                "elevation_m": node.elevation_m,
                "data_origin": node.data_origin or "synthetic",
                "is_demo": True,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "layer_name": "water_network_nodes",
            "feature_count": len(features),
            "geometry_type": "Point",
            "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
            "data_origin": "synthetic",
            "is_demo": True,
            "disclaimer": SYNTHETIC_DISCLAIMER,
        },
    }


@router.get("/pipes", response_model=GeoJSONFeatureCollection)
def get_network_pipes(
    ward_id: Optional[str] = Query(None, description="Filter pipes by ward ID (e.g. W001)"),
    valve_status: Optional[str] = Query(None, description="Filter by valve status (open, closed)"),
    material: Optional[str] = Query(None, description="Filter by pipe material (MS, DI, HDPE, CI, PVC)"),
    db: Session = Depends(get_db),
):
    """
    Get water network distribution pipes as a GeoJSON FeatureCollection.

    - Returns LineString geometries with coordinates [[lon, lat], ...].
    - Includes synthetic demo metadata.
    """
    total_in_db = db.query(func.count(NetworkPipe.pipe_id)).scalar() or 0
    if total_in_db == 0:
        layer_data = get_network_pipes_layer(ward_id=ward_id, valve_status=valve_status, material=material)
        if layer_data.get("features"):
            return layer_data

    query = db.query(NetworkPipe)
    if ward_id:
        query = query.filter(NetworkPipe.ward_id == ward_id)
    if valve_status:
        query = query.filter(NetworkPipe.valve_status == valve_status)
    if material:
        query = query.filter(NetworkPipe.material == material)

    pipes = query.all()

    features: List[Dict[str, Any]] = []
    for pipe in pipes:
        try:
            geom = json.loads(pipe.geometry)
        except (json.JSONDecodeError, TypeError):
            continue

        features.append({
            "type": "Feature",
            "id": pipe.pipe_id,
            "geometry": geom,
            "properties": {
                "pipe_id": pipe.pipe_id,
                "from_node_id": pipe.from_node_id,
                "to_node_id": pipe.to_node_id,
                "diameter_mm": pipe.diameter_mm,
                "material": pipe.material,
                "length_m": pipe.length_m,
                "valve_status": pipe.valve_status,
                "flow_direction": pipe.flow_direction,
                "ward_id": pipe.ward_id,
                "data_origin": pipe.data_origin or "synthetic",
                "is_demo": True,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "layer_name": "water_network_pipes",
            "feature_count": len(features),
            "geometry_type": "LineString",
            "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
            "data_origin": "synthetic",
            "is_demo": True,
            "disclaimer": SYNTHETIC_DISCLAIMER,
        },
    }


@router.get("/summary", response_model=NetworkSummary)
def get_network_summary(db: Session = Depends(get_db)):
    """Summary metrics of water distribution infrastructure."""
    total_nodes = db.query(func.count(NetworkNode.node_id)).scalar() or 0
    total_pipes = db.query(func.count(NetworkPipe.pipe_id)).scalar() or 0
    total_length_m = db.query(func.sum(NetworkPipe.length_m)).scalar() or 0.0

    # If DB not seeded yet, compute from processed GeoJSON
    if total_nodes == 0:
        nodes_layer = get_network_nodes_layer()
        pipes_layer = get_network_pipes_layer()
        total_nodes = len(nodes_layer.get("features", []))
        total_pipes = len(pipes_layer.get("features", []))
        total_length_m = sum(
            f.get("properties", {}).get("length_m", 0.0)
            for f in pipes_layer.get("features", [])
        )
        node_types = {}
        for f in nodes_layer.get("features", []):
            nt = f.get("properties", {}).get("node_type", "unknown")
            node_types[nt] = node_types.get(nt, 0) + 1
        materials = {}
        valve_statuses = {}
        for f in pipes_layer.get("features", []):
            mat = f.get("properties", {}).get("material", "unknown")
            vs = f.get("properties", {}).get("valve_status", "unknown")
            materials[mat] = materials.get(mat, 0) + 1
            valve_statuses[vs] = valve_statuses.get(vs, 0) + 1
    else:
        node_types_query = db.query(NetworkNode.node_type, func.count(NetworkNode.node_id)).group_by(NetworkNode.node_type).all()
        node_types = {row[0]: row[1] for row in node_types_query}

        materials_query = db.query(NetworkPipe.material, func.count(NetworkPipe.pipe_id)).group_by(NetworkPipe.material).all()
        materials = {row[0]: row[1] for row in materials_query if row[0]}

        valves_query = db.query(NetworkPipe.valve_status, func.count(NetworkPipe.pipe_id)).group_by(NetworkPipe.valve_status).all()
        valve_statuses = {row[0]: row[1] for row in valves_query if row[0]}

    return NetworkSummary(
        total_nodes=total_nodes,
        total_pipes=total_pipes,
        total_pipe_length_km=round(total_length_m / 1000.0, 2),
        node_types=node_types,
        materials=materials,
        valve_statuses=valve_statuses,
        data_origin="synthetic",
        is_demo=True,
    )
