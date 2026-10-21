"""
JalWatch operations API.

Run with:
    cd JalWatch
    uvicorn backend.app.main:app --reload --port 8000

Then open http://localhost:8000/docs for the interactive API documentation.
"""

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .auth import access_configured, require_session, router as auth_router
from .database import engine, Base
from .routers import complaints, wards, alerts, incidents, dashboard, predictions, network

# Create database tables on startup (if they don't exist)
Base.metadata.create_all(bind=engine)

# -- FastAPI App ------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "JalWatch operations API for complaints, alerts, incident work orders, "
        "and measured dashboard analytics. Model and GIS integration are separate team deliverables."
    ),
)

# -- CORS: allow frontend dev server to call this API ----

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Register all routers --------------------------------

app.include_router(auth_router, prefix=settings.API_PREFIX)
for protected_router in (
    dashboard.router, complaints.router, wards.router,
    alerts.router, incidents.router, predictions.router,
    network.router,
):
    app.include_router(
        protected_router,
        prefix=settings.API_PREFIX,
        dependencies=[Depends(require_session)],
    )


# -- Root & health endpoints ------------------------------

@app.get("/", tags=["Health"])
def root():
    """API root: shows basic info and links to docs."""
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "api_prefix": settings.API_PREFIX,
        "endpoints": {
            "dashboard": f"{settings.API_PREFIX}/dashboard/summary",
            "complaints": f"{settings.API_PREFIX}/complaints",
            "wards": f"{settings.API_PREFIX}/wards",
            "alerts": f"{settings.API_PREFIX}/alerts",
            "incidents": f"{settings.API_PREFIX}/incidents",
            "predictions": f"{settings.API_PREFIX}/predictions/risk",
            "network_nodes": f"{settings.API_PREFIX}/network/nodes",
            "network_pipes": f"{settings.API_PREFIX}/network/pipes",
        },
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Readiness check for credentials and database connectivity."""
    if not access_configured():
        raise HTTPException(status_code=503, detail="Administrator credentials are not configured")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return {"status": "healthy"}
