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
from .citizen_auth import router as citizen_auth_router, public_router
from .database import engine
from .routers import complaints, wards, alerts, incidents, dashboard, predictions, network, citizen, clusters, service_notices

# -- FastAPI App ------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "JalWatch operations API for complaints, alerts, incident work orders, "
        "measured dashboard analytics, synthetic network preview, and a demo complaint model."
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
app.include_router(citizen_auth_router, prefix=settings.API_PREFIX)
app.include_router(public_router, prefix=settings.API_PREFIX)
app.include_router(citizen.router, prefix=settings.API_PREFIX)
app.include_router(service_notices.citizen_router, prefix=settings.API_PREFIX)
for protected_router in (
    dashboard.router, complaints.router, wards.router,
    alerts.router, incidents.router, predictions.router,
    network.router, clusters.router, service_notices.admin_router,
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
            if connection.execute(text("SELECT 1 FROM wards LIMIT 1")).first() is None:
                raise HTTPException(status_code=503, detail="Database has not been seeded")
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable or not initialized") from None
    return {"status": "healthy"}
