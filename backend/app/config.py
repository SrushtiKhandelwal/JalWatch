import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Project root is JalWatch/
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings:
    """Application configuration. Credentials must be supplied by the operator."""

    APP_NAME: str = "JalWatch API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Database: SQLite for development, swap to PostgreSQL for production
    # PostgreSQL example: "postgresql+psycopg://user:pass@localhost:5432/jalwatch"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{PROJECT_ROOT / 'jalwatch.db'}",
    )

    # Path to raw CSV data files
    RAW_DATA_DIR: Path = PROJECT_ROOT / "data" / "raw"

    ADMIN_PASSWORD: str = os.getenv("JALWATCH_ADMIN_PASSWORD", "")
    SESSION_SECRET: str = os.getenv("JALWATCH_SESSION_SECRET", "")
    COOKIE_SECURE: bool = os.getenv("JALWATCH_COOKIE_SECURE", "false").lower() == "true"

    # CORS: origins allowed to call this API (frontend dev server)
    DEFAULT_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    CORS_ORIGINS: list = [
        origin.strip() for origin in os.getenv("JALWATCH_CORS_ORIGINS", "").split(",") if origin.strip()
    ] or DEFAULT_CORS_ORIGINS


settings = Settings()
