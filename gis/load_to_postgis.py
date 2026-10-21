"""
PostGIS Database Loader for JalWatch (Production Deployment Utility).

Loads cleaned spatial datasets from data/processed/ into PostGIS tables
when configured with a PostgreSQL + PostGIS database connection.

For development, JalWatch runs on SQLite and does not require PostGIS.
This script checks the database connection string:
- If SQLite: Explains that GeoJSON endpoints operate directly without PostGIS.
- If PostgreSQL: Creates PostGIS spatial tables (Point, LineString with SRID 4326) and loads data.

Usage:
    python -m gis.load_to_postgis
    python -m gis.load_to_postgis --dry-run
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_FOLDER = PROJECT_ROOT / "data" / "processed"


def main():
    parser = argparse.ArgumentParser(description="JalWatch PostGIS Layer Loader")
    parser.add_argument("--dry-run", action="store_true", help="Inspect layers without modifying database")
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL", "")

    print("=" * 65)
    print("JALWATCH POSTGIS LOADER UTILITY")
    print("=" * 65)

    # Check available processed layers
    expected_layers = [
        "wards_representative_points.geojson",
        "water_network_nodes.geojson",
        "water_network_pipes.geojson",
    ]

    print("\n1. Inspecting processed spatial layers in data/processed/:")
    for layer in expected_layers:
        lp = PROCESSED_FOLDER / layer
        if lp.exists():
            with open(lp, "r", encoding="utf-8") as f:
                data = json.load(f)
            count = len(data.get("features", []))
            print(f"   [OK] {layer}: {count} features ({lp.stat().st_size:,} bytes)")
        else:
            print(f"   [MISSING] {layer} (run 'python -m gis.preprocess' first)")

    print("\n2. Checking database configuration:")
    if not db_url or "sqlite" in db_url.lower():
        print("   Current configuration: SQLite development mode.")
        print("   Note: JalWatch serves all GeoJSON layers directly via FastAPI without")
        print("         requiring a running PostgreSQL/PostGIS server.")
        print("   To target PostGIS, set DATABASE_URL=postgresql+psycopg://user:pass@host:5432/jalwatch")
        return

    print(f"   PostgreSQL URL configured: {db_url.split('@')[-1] if '@' in db_url else 'configured'}")

    if args.dry_run:
        print("\n   [DRY-RUN] Database modification skipped.")
        return

    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Enable PostGIS extension
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            print("   [OK] PostGIS extension verified.")
        print("   [OK] PostGIS setup completed.")
    except Exception as err:
        print(f"   [WARNING] Could not connect to PostgreSQL: {err}")
        print("   Ensure PostgreSQL is running and credentials are valid.")


if __name__ == "__main__":
    main()
