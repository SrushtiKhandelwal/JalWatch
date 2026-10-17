"""
JalWatch API: Enterprise Water Utility Operations Platform.

Run with:
    cd JalWatch
    uvicorn backend.app.main:app --reload --port 8000

Then open http://localhost:8000/docs for the interactive API documentation.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .routers import complaints, wards, alerts, incidents, dashboard, predictions

# Create database tables on startup (if they don't exist)
Base.metadata.create_all(bind=engine)

# -- FastAPI App ------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "JalWatch: Intelligent Water Monitoring & Grievance Redressal System "
        "for Nagpur Municipal Corporation.\n\n"
        "Features:\n"
        "- SCADA & Telemetry Alert Feed\n"
        "- Incident Redressal & Field Crew Dispatch\n"
        "- Executive Dashboard & Spatial Analytics\n"
        "- Machine Learning Infrastructure Risk Prediction"
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

app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(complaints.router, prefix=settings.API_PREFIX)
app.include_router(wards.router, prefix=settings.API_PREFIX)
app.include_router(alerts.router, prefix=settings.API_PREFIX)
app.include_router(incidents.router, prefix=settings.API_PREFIX)
app.include_router(predictions.router, prefix=settings.API_PREFIX)


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
        },
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}
