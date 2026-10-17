"""
Pydantic schemas — define the shape of data going IN and OUT of the API.

These are NOT database models. They are contracts:
  - Request schemas  → what the frontend sends
  - Response schemas → what the API returns
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# ╔═══════════════════════════════════════════════════════════╗
# ║  WARD SCHEMAS                                            ║
# ╚═══════════════════════════════════════════════════════════╝

class WardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ward_id: str
    ward_number: int
    ward_name: str
    zone_id: str
    zone_name: str
    locality_count: int
    representative_latitude: float
    representative_longitude: float


class WardStats(BaseModel):
    """Per-ward analytics — used on the dashboard and ward detail page."""
    ward_id: str
    ward_name: str
    zone_name: str
    total_complaints: int
    open_complaints: int
    resolved_complaints: int
    critical_complaints: int
    active_alerts: int
    active_incidents: int
    avg_resolution_hours: Optional[float] = None
    risk_score: float = 0.0   # Member 1 replaces with real score


# ╔═══════════════════════════════════════════════════════════╗
# ║  COMPLAINT SCHEMAS                                       ║
# ╚═══════════════════════════════════════════════════════════╝

class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    complaint_id: str
    citizen_id: Optional[str] = None
    reported_at: datetime
    complaint_type: str
    description: Optional[str] = None
    ward_id: str
    locality_id: Optional[str] = None
    latitude: float
    longitude: float
    severity: str
    status: str
    incident_id: Optional[str] = None
    resolved_at: Optional[datetime] = None
    incident_risk_label: int = 0


class ComplaintListResponse(BaseModel):
    """Paginated list of complaints."""
    complaints: List[ComplaintResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ╔═══════════════════════════════════════════════════════════╗
# ║  ALERT SCHEMAS                                           ║
# ╚═══════════════════════════════════════════════════════════╝

class AlertCreate(BaseModel):
    """Payload to create a new alert."""
    alert_type: str           # high_risk | anomaly | threshold_breach | cluster_detected
    severity: str             # low | medium | high | critical
    ward_id: str
    locality_id: Optional[str] = None
    title: str
    description: str
    risk_score: float = 0.0
    source: str = "system"


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_type: str
    severity: str
    ward_id: str
    locality_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    risk_score: float
    status: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    source: str


class AlertUpdate(BaseModel):
    """Payload to update alert status."""
    status: str   # acknowledged | resolved | dismissed


# ╔═══════════════════════════════════════════════════════════╗
# ║  INCIDENT SCHEMAS                                        ║
# ╚═══════════════════════════════════════════════════════════╝

class IncidentCreate(BaseModel):
    """Payload to create a new incident."""
    title: str
    description: str
    ward_id: str
    locality_id: Optional[str] = None
    latitude: float
    longitude: float
    incident_type: str        # pipe_burst | contamination | supply_failure | pressure_drop | flooding
    severity: str
    related_complaint_ids: List[str] = []
    related_alert_id: Optional[int] = None


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: str
    title: str
    description: Optional[str] = None
    ward_id: str
    locality_id: Optional[str] = None
    latitude: float
    longitude: float
    incident_type: str
    severity: str
    status: str
    assigned_to: Optional[str] = None
    reported_at: datetime
    assigned_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    related_complaint_ids: List[str] = []
    related_alert_id: Optional[int] = None


class IncidentStatusUpdate(BaseModel):
    """Payload to change incident status and optionally assign/resolve."""
    status: str               # reported | open | assigned | in_progress | resolved | closed
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None


# ╔═══════════════════════════════════════════════════════════╗
# ║  DASHBOARD SCHEMAS                                       ║
# ╚═══════════════════════════════════════════════════════════╝

class DashboardSummary(BaseModel):
    """Top-level KPI cards on the admin dashboard."""
    total_complaints: int
    open_complaints: int
    in_progress_complaints: int
    resolved_complaints: int
    closed_complaints: int
    active_alerts: int
    critical_alerts: int
    total_incidents: int
    open_incidents: int
    avg_resolution_hours: float
    complaints_today: int
    high_risk_wards: int


class ComplaintsByType(BaseModel):
    complaint_type: str
    count: int


class ComplaintsBySeverity(BaseModel):
    severity: str
    count: int


class ComplaintTrend(BaseModel):
    date: str
    count: int


class WardRiskSummary(BaseModel):
    """Ward-level risk overview for the dashboard map / table."""
    ward_id: str
    ward_name: str
    risk_score: float
    risk_level: str           # low | medium | high | critical
    total_complaints: int
    active_alerts: int


# ╔═══════════════════════════════════════════════════════════╗
# ║  PREDICTION SCHEMAS (Mock — Member 1 replaces)           ║
# ╚═══════════════════════════════════════════════════════════╝

class PredictionRequest(BaseModel):
    ward_id: str
    complaint_type: Optional[str] = None
    time_window_days: int = 7


class PredictionResponse(BaseModel):
    ward_id: str
    risk_score: float
    risk_level: str
    predicted_incidents: int
    contributing_factors: List[str]
    confidence: float
    generated_at: datetime
