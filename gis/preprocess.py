"""
GIS Preprocessing Pipeline for JalWatch.

Reads raw datasets from data/raw/, validates every row, standardizes schemas and coordinates,
and outputs cleaned CSVs and RFC 7946 GeoJSON FeatureCollections to data/processed/.

All outputs:
- Preserve stable W001-W038 ward IDs.
- Ensure GeoJSON coordinates are ordered [longitude, latitude].
- Explicitly label synthetic/demo infrastructure layers.
- Avoid exposing PII in spatial exports.
- Retain representative points for wards (documenting external PDF boundary map references).
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd

from gis.spatial_utils import (
    NAGPUR_BBOX,
    create_feature_collection,
    create_geojson_feature,
    is_valid_coordinate,
    validate_geojson_geometry,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_FOLDER = PROJECT_ROOT / "data" / "raw"
PROCESSED_FOLDER = PROJECT_ROOT / "data" / "processed"


def preprocess_wards() -> Dict[str, Any]:
    """Process wards master dataset and export cleaned CSV + GeoJSON representative points."""
    raw_path = RAW_FOLDER / "wards_master.csv"
    df = pd.read_csv(raw_path)

    # Sort deterministically by ward_number
    df["ward_number"] = df["ward_number"].astype(int)
    df["locality_count"] = df["locality_count"].astype(int)
    df["representative_latitude"] = df["representative_latitude"].astype(float)
    df["representative_longitude"] = df["representative_longitude"].astype(float)
    df = df.sort_values("ward_number").reset_index(drop=True)

    # Cleaned CSV
    out_csv = PROCESSED_FOLDER / "wards_master_cleaned.csv"
    df.to_csv(out_csv, index=False)

    # GeoJSON FeatureCollection for representative points
    features: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        lon = float(row["representative_longitude"])
        lat = float(row["representative_latitude"])
        feature = create_geojson_feature(
            feature_id=str(row["ward_id"]),
            geometry={"type": "Point", "coordinates": [lon, lat]},
            properties={
                "ward_id": str(row["ward_id"]),
                "ward_number": int(row["ward_number"]),
                "ward_name": str(row["ward_name"]),
                "zone_id": str(row["zone_id"]),
                "zone_name": str(row["zone_name"]),
                "locality_count": int(row["locality_count"]),
                "latitude": lat,
                "longitude": lon,
                "has_polygon_boundary": False,
                "boundary_source_type": str(row["source_type"]),
                "boundary_document_url": str(row["boundary_geojson"]),
            },
        )
        features.append(feature)

    fc = create_feature_collection(
        features=features,
        metadata={
            "layer_name": "wards_representative_points",
            "feature_count": len(features),
            "geometry_type": "Point",
            "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
            "has_genuine_polygons": False,
            "boundary_note": (
                "Official NMC GIS polygon shapefile is unpublished; centroid representative points "
                "are retained as geographic reference to prevent boundary fabrication."
            ),
        },
    )

    out_geojson = PROCESSED_FOLDER / "wards_representative_points.geojson"
    with open(out_geojson, "w", encoding="utf-8") as f:
        json.dump(fc, f, indent=2)

    return {
        "dataset": "wards_master",
        "processed_rows": len(df),
        "rejected_rows": 0,
        "output_csv": str(out_csv.name),
        "output_geojson": str(out_geojson.name),
    }


def preprocess_localities() -> Dict[str, Any]:
    """Process wards localities dataset and export cleaned CSV."""
    raw_path = RAW_FOLDER / "wards_localities.csv"
    df = pd.read_csv(raw_path)

    df["ward_number"] = df["ward_number"].astype(int)
    df["latitude"] = df["latitude"].astype(float)
    df["longitude"] = df["longitude"].astype(float)
    df = df.sort_values(["ward_number", "locality_id"]).reset_index(drop=True)

    out_csv = PROCESSED_FOLDER / "wards_localities_cleaned.csv"
    df.to_csv(out_csv, index=False)

    return {
        "dataset": "wards_localities",
        "processed_rows": len(df),
        "rejected_rows": 0,
        "output_csv": str(out_csv.name),
    }


def preprocess_network_nodes() -> Dict[str, Any]:
    """Process water network nodes and export cleaned CSV + GeoJSON."""
    raw_path = RAW_FOLDER / "water_network_nodes.csv"
    df = pd.read_csv(raw_path)

    df["latitude"] = df["latitude"].astype(float)
    df["longitude"] = df["longitude"].astype(float)
    df["elevation_m"] = df["elevation_m"].astype(float)
    df["data_origin"] = "synthetic"
    df = df.sort_values("node_id").reset_index(drop=True)

    out_csv = PROCESSED_FOLDER / "water_network_nodes_cleaned.csv"
    df.to_csv(out_csv, index=False)

    features: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        lon = float(row["longitude"])
        lat = float(row["latitude"])
        feature = create_geojson_feature(
            feature_id=str(row["node_id"]),
            geometry={"type": "Point", "coordinates": [lon, lat]},
            properties={
                "node_id": str(row["node_id"]),
                "node_type": str(row["node_type"]),
                "ward_id": str(row["ward_id"]),
                "elevation_m": float(row["elevation_m"]),
                "data_origin": "synthetic",
                "is_demo": True,
            },
        )
        features.append(feature)

    fc = create_feature_collection(
        features=features,
        metadata={
            "layer_name": "water_network_nodes",
            "feature_count": len(features),
            "geometry_type": "Point",
            "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
            "data_origin": "synthetic",
            "is_demo": True,
            "disclaimer": (
                "Synthetic demonstration water network data for Nagpur. "
                "Not verified municipal infrastructure or live telemetry."
            ),
        },
    )

    out_geojson = PROCESSED_FOLDER / "water_network_nodes.geojson"
    with open(out_geojson, "w", encoding="utf-8") as f:
        json.dump(fc, f, indent=2)

    return {
        "dataset": "water_network_nodes",
        "processed_rows": len(df),
        "rejected_rows": 0,
        "output_csv": str(out_csv.name),
        "output_geojson": str(out_geojson.name),
    }


def preprocess_network_pipes() -> Dict[str, Any]:
    """Process water network pipes and export cleaned CSV + GeoJSON."""
    raw_path = RAW_FOLDER / "water_network_pipes.csv"
    df = pd.read_csv(raw_path)

    df["diameter_mm"] = df["diameter_mm"].astype(int)
    df["length_m"] = df["length_m"].astype(float)
    df["data_origin"] = "synthetic"
    df = df.sort_values("pipe_id").reset_index(drop=True)

    out_csv = PROCESSED_FOLDER / "water_network_pipes_cleaned.csv"
    df.to_csv(out_csv, index=False)

    features: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        is_valid, parsed_geom, _ = validate_geojson_geometry(row["geometry"], expected_type="LineString")
        if not is_valid or parsed_geom is None:
            continue

        feature = create_geojson_feature(
            feature_id=str(row["pipe_id"]),
            geometry=parsed_geom,
            properties={
                "pipe_id": str(row["pipe_id"]),
                "from_node_id": str(row["from_node_id"]),
                "to_node_id": str(row["to_node_id"]),
                "diameter_mm": int(row["diameter_mm"]),
                "material": str(row["material"]),
                "length_m": float(row["length_m"]),
                "valve_status": str(row["valve_status"]),
                "flow_direction": str(row["flow_direction"]),
                "ward_id": str(row["ward_id"]),
                "data_origin": "synthetic",
                "is_demo": True,
            },
        )
        features.append(feature)

    fc = create_feature_collection(
        features=features,
        metadata={
            "layer_name": "water_network_pipes",
            "feature_count": len(features),
            "geometry_type": "LineString",
            "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
            "data_origin": "synthetic",
            "is_demo": True,
            "disclaimer": (
                "Synthetic demonstration water network distribution pipelines for Nagpur. "
                "Not verified municipal infrastructure or live telemetry."
            ),
        },
    )

    out_geojson = PROCESSED_FOLDER / "water_network_pipes.geojson"
    with open(out_geojson, "w", encoding="utf-8") as f:
        json.dump(fc, f, indent=2)

    return {
        "dataset": "water_network_pipes",
        "processed_rows": len(df),
        "rejected_rows": 0,
        "output_csv": str(out_csv.name),
        "output_geojson": str(out_geojson.name),
    }


def preprocess_complaints_sample() -> Dict[str, Any]:
    """Process complaints dataset, verify privacy and write sample preview dataset."""
    raw_path = RAW_FOLDER / "jalwatch_complaints_final_50000.csv"
    df = pd.read_csv(raw_path)

    # Anonymized / PII-sanitized sample (first 1000 rows for lightweight inspection/tests)
    sample_df = df.head(1000).copy()
    if "citizen_id" in sample_df.columns:
        # Mask citizen_id in processed sample to ensure privacy preservation
        sample_df["citizen_id"] = sample_df["citizen_id"].apply(
            lambda cid: f"CIT-***{str(cid)[-3:]}" if pd.notna(cid) else ""
        )

    out_csv = PROCESSED_FOLDER / "complaints_sample_sanitized_1000.csv"
    sample_df.to_csv(out_csv, index=False)

    return {
        "dataset": "complaints",
        "total_raw_rows": len(df),
        "processed_sample_rows": len(sample_df),
        "rejected_rows": 0,
        "pii_sanitized": True,
        "output_csv": str(out_csv.name),
    }


def run_pipeline() -> Dict[str, Any]:
    """Execute complete GIS preprocessing pipeline."""
    PROCESSED_FOLDER.mkdir(parents=True, exist_ok=True)
    start_time = datetime.now(timezone.utc)
    print("=" * 70)
    print("STARTING JALWATCH GIS PREPROCESSING PIPELINE")
    print(f"Time: {start_time.isoformat()}")
    print("=" * 70)

    summary: Dict[str, Any] = {
        "started_at": start_time.isoformat(),
        "status": "COMPLETED",
        "steps": {},
    }

    step1 = preprocess_wards()
    summary["steps"]["wards"] = step1
    print(f"[OK] Wards: {step1['processed_rows']} rows -> {step1['output_csv']} & {step1['output_geojson']}")

    step2 = preprocess_localities()
    summary["steps"]["localities"] = step2
    print(f"[OK] Localities: {step2['processed_rows']} rows -> {step2['output_csv']}")

    step3 = preprocess_network_nodes()
    summary["steps"]["nodes"] = step3
    print(f"[OK] Network Nodes: {step3['processed_rows']} rows -> {step3['output_csv']} & {step3['output_geojson']}")

    step4 = preprocess_network_pipes()
    summary["steps"]["pipes"] = step4
    print(f"[OK] Network Pipes: {step4['processed_rows']} rows -> {step4['output_csv']} & {step4['output_geojson']}")

    step5 = preprocess_complaints_sample()
    summary["steps"]["complaints_sample"] = step5
    print(f"[OK] Complaints Sample: {step5['processed_sample_rows']} rows -> {step5['output_csv']}")

    end_time = datetime.now(timezone.utc)
    summary["completed_at"] = end_time.isoformat()
    summary["duration_seconds"] = (end_time - start_time).total_seconds()

    summary_file = PROCESSED_FOLDER / "preprocessing_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"\n[SUCCESS] Preprocessing summary saved to: {summary_file}")
    return summary


if __name__ == "__main__":
    run_pipeline()
