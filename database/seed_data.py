"""
Database Seeding Script.

Populates SQLite or PostgreSQL database with wards, complaints, alerts, incidents,
and water network nodes/pipes using the backend seeding module.
"""

import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.seed import seed_database


def main():
    force = "--force" in sys.argv
    print("Initiating database seeding...")
    seed_database(force=force)


if __name__ == "__main__":
    main()
