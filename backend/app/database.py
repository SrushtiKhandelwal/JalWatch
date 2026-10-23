import os

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool

from .config import settings

database_url = make_url(settings.DATABASE_URL)
if os.getenv("VERCEL") and database_url.get_backend_name() == "sqlite":
    raise RuntimeError("Set DATABASE_URL to a persistent PostgreSQL database on Vercel")

# Marketplace providers commonly supply postgresql:// URLs. Select the installed
# psycopg 3 driver explicitly rather than SQLAlchemy's psycopg2 default.
if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+psycopg")

engine_options = {"echo": False, "pool_pre_ping": True}
if database_url.get_backend_name() == "sqlite":
    engine_options["connect_args"] = {"check_same_thread": False}
elif os.getenv("VERCEL"):
    # The database provider's pooled connection URL handles concurrency.
    engine_options["poolclass"] = NullPool

engine = create_engine(database_url, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


def get_db():
    """
    FastAPI dependency: yields a database session per request.
    Usage in a router:
        @router.get("/")
        def my_endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
