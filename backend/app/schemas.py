"""
Pydantic schemas: Define the structure of data in the API.

These are application data contracts:
  - Request schemas  -> payload sent by clients
  - Response schemas -> payload returned by API
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Literal, Dict, Any, Union
from datetime import datetime


# [ WARD SCHEMAS ]

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
    """Per-ward analytics: used on the dashboard and ward detail view."""
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
    risk_score: float = 0.0


# ╔═══════════════════════════════════════════════════════════╗
# ║  COMPLAINT SCHEMAS                                       ║
# ╚═══════════════════════════════════════════════════════════╝

class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    complaint_id: str
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
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    alert_type: Literal["high_risk", "anomaly", "threshold_breach", "cluster_detected", "early_warning"]
    severity: Literal["low", "medium", "high", "critical"]
    ward_id: str
    locality_id: Optional[str] = None
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    risk_score: float = Field(default=0.0, ge=0, le=1)


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


class AlertEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_id: int
    from_status: Optional[str] = None
    to_status: str
    occurred_at: datetime


class AlertUpdate(BaseModel):
    """Payload to update alert status."""
    model_config = ConfigDict(extra="forbid")
    status: Literal["acknowledged", "resolved", "dismissed"]


class RiskSignal(BaseModel):
    """Contract for Member 1's model output consumed by the alert evaluator."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    ward_id: str
    risk_score: float = Field(ge=0, le=1)
    severity_prediction: Literal["low", "medium", "high", "critical"]
    model_version: str = Field(min_length=1, max_length=100)
    contributing_factors: List[str] = Field(default_factory=list, max_length=20)
    generated_at: datetime


class AlertEvaluationResponse(BaseModel):
    alert_created: bool
    reason: str
    alert: Optional[AlertResponse] = None


# ╔═══════════════════════════════════════════════════════════╗
# ║  INCIDENT SCHEMAS                                        ║
# ╚═══════════════════════════════════════════════════════════╝

class IncidentCreate(BaseModel):
    """Payload to create a new incident."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    ward_id: str
    locality_id: Optional[str] = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    incident_type: Literal["pipe_burst", "contamination", "supply_failure", "pressure_drop", "flooding"]
    severity: Literal["low", "medium", "high", "critical"]
    assigned_to: Optional[str] = Field(default=None, min_length=1, max_length=120)
    related_complaint_ids: List[str] = Field(default_factory=list, max_length=100)
    related_alert_id: Optional[int] = Field(default=None, gt=0)


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
    related_complaint_ids: List[str] = Field(default_factory=list)
    related_alert_id: Optional[int] = None


class IncidentEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: str
    from_status: Optional[str] = None
    to_status: str
    assigned_to: Optional[str] = None
    note: Optional[str] = None
    occurred_at: datetime


class IncidentStatusUpdate(BaseModel):
    """Payload to change incident status and optionally assign/resolve."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: Literal["open", "assigned", "in_progress", "resolved", "closed"]
    assigned_to: Optional[str] = Field(default=None, min_length=1, max_length=120)
    resolution_notes: Optional[str] = Field(default=None, min_length=3, max_length=5000)


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
    avg_resolution_hours: Optional[float] = None
    complaints_today: int
    wards_with_critical_alerts: int
    latest_complaint_at: Optional[datetime] = None


class ComplaintsByType(BaseModel):
    complaint_type: str
    count: int


class ComplaintsBySeverity(BaseModel):
    severity: str
    count: int


class ComplaintTrend(BaseModel):
    date: str
    count: int


class WardPrioritySummary(BaseModel):
    """Observed ward workload; no model risk score is implied."""
    ward_id: str
    ward_name: str
    zone_name: str
    recent_complaints: int
    critical_complaints: int
    active_alerts: int
    window_days: int


# [ PREDICTION SCHEMAS: Machine Learning Inference ]

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


# [ GEOJSON & SPATIAL NETWORK SCHEMAS ]

class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: Any


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: Union[str, int]
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature]
    metadata: Optional[Dict[str, Any]] = None


class NetworkNodeProperties(BaseModel):
    node_id: str
    node_type: str
    ward_id: str
    elevation_m: Optional[float] = None
    data_origin: str = "synthetic"
    is_demo: bool = True


class NetworkPipeProperties(BaseModel):
    pipe_id: str
    from_node_id: str
    to_node_id: str
    diameter_mm: Optional[int] = None
    material: Optional[str] = None
    length_m: Optional[float] = None
    valve_status: Optional[str] = "open"
    flow_direction: Optional[str] = "forward"
    ward_id: str
    data_origin: str = "synthetic"
    is_demo: bool = True


class NetworkSummary(BaseModel):
    total_nodes: int
    total_pipes: int
    total_pipe_length_km: float
    node_types: Dict[str, int]
    materials: Dict[str, int]
    valve_statuses: Dict[str, int]
    data_origin: str = "synthetic"
    is_demo: bool = True