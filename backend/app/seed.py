"""
Database Seeder: Loads real municipal data from CSVs + telemetry alerts and incidents.

Usage:
    cd JalWatch
    python -m backend.app.seed            # seed once
    python -m backend.app.seed --force     # drop all tables and reseed
"""

import csv
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Fix imports when running as module
from backend.app.database import engine, SessionLocal, Base
from backend.app.models import Ward, Complaint, Alert, Incident, NetworkNode, NetworkPipe
from backend.app.config import settings


def seed_database(force: bool = False):
    """Create tables and populate with data."""

    if force:
        print("Force mode: dropping all tables...")
        Base.metadata.drop_all(bind=engine)

    print("📦 Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Ward).first() and not force:
            print("✅ Database already seeded. Use --force to reseed.")
            return

        _seed_wards(db)
        _seed_network_nodes(db)
        _seed_network_pipes(db)
        _seed_complaints(db)
        _seed_mock_alerts(db)
        _seed_mock_incidents(db)

        print("\n🎉 Database seeding complete!")
        print(f"   Wards:         {db.query(Ward).count()}")
        print(f"   Network Nodes: {db.query(NetworkNode).count()} (Synthetic Preview)")
        print(f"   Network Pipes: {db.query(NetworkPipe).count()} (Synthetic Preview)")
        print(f"   Complaints:    {db.query(Complaint).count()}")
        print(f"   Alerts:        {db.query(Alert).count()}")
        print(f"   Incidents:     {db.query(Incident).count()}")
    finally:
        db.close()


# ── Load wards from CSV ──────────────────────────────────

def _seed_wards(db):
    csv_path = settings.RAW_DATA_DIR / "wards_master.csv"
    print(f"\n📍 Loading wards from {csv_path.name}...")

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            ward = Ward(
                ward_id=row["ward_id"].strip(),
                ward_number=int(row["ward_number"]),
                ward_name=row["ward_name"].strip(),
                zone_id=row["zone_id"].strip(),
                zone_name=row["zone_name"].strip(),
                locality_count=int(row["locality_count"]),
                representative_latitude=float(row["representative_latitude"]),
                representative_longitude=float(row["representative_longitude"]),
                boundary_geojson=row.get("boundary_geojson", ""),
            )
            db.add(ward)
            count += 1

        db.commit()
        print(f"   ✓ Loaded {count} wards")


# ── Load water network nodes from CSV ────────────────────

def _seed_network_nodes(db):
    csv_path = settings.RAW_DATA_DIR / "water_network_nodes.csv"
    print(f"\n💧 Loading water network nodes from {csv_path.name} (Synthetic Preview)...")

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        count = 0
        batch = []
        for row in reader:
            node = NetworkNode(
                node_id=row["node_id"].strip(),
                node_type=row["node_type"].strip(),
                ward_id=row["ward_id"].strip(),
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                elevation_m=float(row["elevation_m"]) if row.get("elevation_m") else None,
                data_origin=row.get("data_origin", "synthetic"),
                scenario_id=row.get("scenario_id"),
            )
            batch.append(node)
            count += 1
            if len(batch) >= 500:
                db.add_all(batch)
                db.commit()
                batch = []

        if batch:
            db.add_all(batch)
            db.commit()

        print(f"   ✓ Loaded {count} network nodes")


# ── Load water network pipes from CSV ────────────────────

def _seed_network_pipes(db):
    csv_path = settings.RAW_DATA_DIR / "water_network_pipes.csv"
    print(f"\n🚰 Loading water network distribution pipes from {csv_path.name} (Synthetic Preview)...")

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        count = 0
        batch = []
        for row in reader:
            pipe = NetworkPipe(
                pipe_id=row["pipe_id"].strip(),
                from_node_id=row["from_node_id"].strip(),
                to_node_id=row["to_node_id"].strip(),
                geometry=row["geometry"].strip(),
                diameter_mm=int(row["diameter_mm"]) if row.get("diameter_mm") else None,
                material=row.get("material", "").strip() or None,
                length_m=float(row["length_m"]) if row.get("length_m") else None,
                valve_status=row.get("valve_status", "open").strip(),
                flow_direction=row.get("flow_direction", "forward").strip(),
                ward_id=row["ward_id"].strip(),
                data_origin=row.get("data_origin", "synthetic"),
                scenario_id=row.get("scenario_id"),
            )
            batch.append(pipe)
            count += 1
            if len(batch) >= 500:
                db.add_all(batch)
                db.commit()
                batch = []

        if batch:
            db.add_all(batch)
            db.commit()

        print(f"   ✓ Loaded {count} network pipes")


# ── Load complaints from CSV ────────────────────────────

def _seed_complaints(db):
    csv_path = settings.RAW_DATA_DIR / "jalwatch_complaints_final_50000.csv"
    print(f"\n📋 Loading complaints from {csv_path.name}...")

    # Load first 10,000 rows for fast development; change to None for all 50k
    MAX_ROWS = 10_000

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        count = 0
        batch = []

        for row in reader:
            if MAX_ROWS and count >= MAX_ROWS:
                break

            # Parse resolved_at (may be empty)
            resolved_at = None
            if row.get("resolved_at"):
                try:
                    resolved_at = datetime.fromisoformat(row["resolved_at"])
                except ValueError:
                    resolved_at = None

            complaint = Complaint(
                complaint_id=row["complaint_id"],
                citizen_id=row["citizen_id"] if row.get("citizen_id") else None,
                reported_at=datetime.fromisoformat(row["reported_at"]),
                complaint_type=row["complaint_type"],
                description=row["description"],
                ward_id=row["ward_id"],
                locality_id=row["locality_id"],
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                severity=row["severity"],
                status=row["status"],
                incident_id=row["incident_id"] if row.get("incident_id") else None,
                resolved_at=resolved_at,
                data_origin=row["data_origin"],
                scenario_id=row["scenario_id"],
                incident_risk_label=int(row["incident_risk_label"]),
                training_label_origin=row["training_label_origin"],
            )
            batch.append(complaint)
            count += 1

            # Commit in batches for speed
            if len(batch) >= 500:
                db.add_all(batch)
                db.commit()
                batch = []
                print(f"   ... {count} rows loaded", end="\r")

        if batch:
            db.add_all(batch)
            db.commit()

        print(f"   ✓ Loaded {count} complaints")


# ── Generate mock alerts ─────────────────────────────────

def _seed_mock_alerts(db):
    print("\n🚨 Generating mock alerts...")

    wards = db.query(Ward).all()
    alert_configs = [
        ("high_risk",         "High risk detected in {ward}",         "Risk score exceeded threshold for {ward} ({zone} zone). Immediate attention recommended."),
        ("anomaly",           "Unusual complaint pattern in {ward}",  "Abnormal spike in {type} complaints detected in {ward}."),
        ("threshold_breach",  "Complaint threshold exceeded in {ward}", "More than 50 complaints received in the last 24 hours for {ward}."),
        ("cluster_detected",  "Complaint cluster detected in {ward}", "Geographic clustering of complaints identified near locality in {ward}."),
    ]
    severities = ["low", "medium", "high", "critical"]
    complaint_types = ["leakage", "water_shortage", "dirty_water", "low_pressure"]

    alerts = []
    for i in range(30):
        ward = random.choice(wards)
        alert_type, title_tpl, desc_tpl = random.choice(alert_configs)
        severity = random.choices(severities, weights=[15, 30, 35, 20])[0]

        status = random.choices(
            ["active", "acknowledged", "resolved", "dismissed"],
            weights=[40, 20, 25, 15],
        )[0]

        triggered = datetime.now(timezone.utc) - timedelta(
            hours=random.randint(1, 96), minutes=random.randint(0, 59)
        )

        title = title_tpl.format(ward=ward.ward_name)
        desc = desc_tpl.format(
            ward=ward.ward_name,
            zone=ward.zone_name,
            type=random.choice(complaint_types),
        )

        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            ward_id=ward.ward_id,
            title=title,
            description=desc,
            risk_score=round(random.uniform(0.3, 0.98), 3),
            status=status,
            triggered_at=triggered,
            acknowledged_at=(
                triggered + timedelta(minutes=random.randint(10, 120))
                if status in ("acknowledged", "resolved") else None
            ),
            resolved_at=(
                triggered + timedelta(hours=random.randint(2, 24))
                if status == "resolved" else None
            ),
            source="demo",
        )
        alerts.append(alert)

    db.add_all(alerts)
    db.commit()
    print(f"   ✓ Generated {len(alerts)} mock alerts")


# ── Generate mock incidents ──────────────────────────────

def _seed_mock_incidents(db):
    print("\n🔧 Generating mock incidents...")

    wards = db.query(Ward).all()
    incident_configs = [
        ("pipe_burst",     "Pipe burst reported in {ward}"),
        ("contamination",  "Water contamination in {ward}"),
        ("supply_failure", "Supply failure affecting {ward}"),
        ("pressure_drop",  "Major pressure drop in {ward}"),
        ("flooding",       "Water main flooding in {ward}"),
    ]
    severities = ["low", "medium", "high", "critical"]

    incidents = []
    for i in range(20):
        ward = random.choice(wards)
        inc_type, title_tpl = random.choice(incident_configs)
        severity = random.choices(severities, weights=[15, 30, 35, 20])[0]

        status = random.choices(
            ["reported", "open", "assigned", "in_progress", "resolved", "closed"],
            weights=[10, 15, 15, 20, 25, 15],
        )[0]

        reported = datetime.now(timezone.utc) - timedelta(
            days=random.randint(0, 14), hours=random.randint(0, 23)
        )

        incident = Incident(
            incident_id=f"INC-{i + 1:04d}",
            title=title_tpl.format(ward=ward.ward_name),
            description=f"Incident reported by multiple citizens in {ward.ward_name}. Requires investigation and response.",
            ward_id=ward.ward_id,
            latitude=ward.representative_latitude + random.uniform(-0.005, 0.005),
            longitude=ward.representative_longitude + random.uniform(-0.005, 0.005),
            incident_type=inc_type,
            severity=severity,
            status=status,
            assigned_to=(
                f"Team-{random.choice(['Alpha', 'Beta', 'Gamma', 'Delta'])}"
                if status in ("assigned", "in_progress", "resolved", "closed") else None
            ),
            reported_at=reported,
            assigned_at=(
                reported + timedelta(hours=random.randint(1, 6))
                if status in ("assigned", "in_progress", "resolved", "closed") else None
            ),
            resolved_at=(
                reported + timedelta(days=random.randint(1, 5))
                if status in ("resolved", "closed") else None
            ),
            closed_at=(
                reported + timedelta(days=random.randint(5, 10))
                if status == "closed" else None
            ),
            resolution_notes=(
                "Issue addressed and service restored."
                if status in ("resolved", "closed") else None
            ),
            related_complaint_ids=[
                f"CMP{random.randint(1, 10000):06d}"
                for _ in range(random.randint(1, 5))
            ],
        )
        incidents.append(incident)

    db.add_all(incidents)
    db.commit()
    print(f"   ✓ Generated {len(incidents)} mock incidents")


# ── Entry point ──────────────────────────────────────────

if __name__ == "__main__":
    force = "--force" in sys.argv
    seed_database(force=force)
