"""
JalWatch API — main application entry point.

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

# ── FastAPI App ──────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "JalWatch — Intelligent Water Monitoring & Grievance Redressal System "
        "for Nagpur Municipal Corporation.\n\n"
        "**Modules covered by this API:**\n"
        "- Module 5: Early Warning and Alert System\n"
        "- Module 6: Incident Response and Tracking\n"
        "- Module 7: Admin Dashboard and Analytics\n\n"
        "Mock predictions are provided for Module 3 & 4 (Member 1 integration point)."
    ),
)

# ── CORS — allow frontend dev server to call this API ────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register all routers ────────────────────────────────

app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(complaints.router, prefix=settings.API_PREFIX)
app.include_router(wards.router, prefix=settings.API_PREFIX)
app.include_router(alerts.router, prefix=settings.API_PREFIX)
app.include_router(incidents.router, prefix=settings.API_PREFIX)
app.include_router(predictions.router, prefix=settings.API_PREFIX)


# ── Root & health endpoints ──────────────────────────────

@app.get("/", tags=["Health"])
def root():
    """API root — shows basic info and links to docs."""
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
