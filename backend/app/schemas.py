"""
Pydantic schemas: Define the structure of data in the API.

These are application data contracts:
  - Request schemas  -> payload sent by clients
  - Response schemas -> payload returned by API
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Literal, Dict, Any, Union
from datetime import datetime, timezone


def _utc_if_naive(value: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; stored application timestamps are UTC."""
    return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


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
    risk_score: Optional[float] = None


class LocalityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    locality_id: str
    locality_name: str
    ward_id: str
    representative_latitude: float
    representative_longitude: float
    geometry_precision: str


class CitizenRegistration(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    password_confirm: str
    address: str = Field(min_length=5, max_length=500)
    ward_id: str
    locality_id: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized.count("@") != 1 or "." not in normalized.split("@", 1)[1]:
            raise ValueError("Enter a valid email address")
        return normalized

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match")
        return self


class CitizenLogin(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: str
    password: str


class CitizenLocationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    address: str = Field(min_length=5, max_length=500)
    ward_id: str
    locality_id: str


class CitizenResponse(BaseModel):
    citizen_id: str
    full_name: str
    email: str
    address: str
    ward_id: str
    zone_id: str
    locality_id: str
    location_status: str


class CitizenComplaintCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    complaint_type: Literal["low_pressure", "water_shortage", "dirty_water", "leakage", "bad_smell"]
    address: str = Field(min_length=5, max_length=500)
    ward_id: str
    locality_id: str
    observed_at: Optional[datetime] = None


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
    data_origin: Optional[str] = None

    @field_validator("reported_at", "resolved_at", mode="after")
    @classmethod
    def utc_dates(cls, value):
        return _utc_if_naive(value)


class ComplaintEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_status: Optional[str] = None
    to_status: str
    note: Optional[str] = None
    actor_role: str
    occurred_at: datetime

    @field_validator("occurred_at", mode="after")
    @classmethod
    def utc_date(cls, value):
        return _utc_if_naive(value)


class ComplaintRecordResponse(ComplaintResponse):
    title: Optional[str] = None
    address: Optional[str] = None
    observed_at: Optional[datetime] = None
    location_precision: Optional[str] = None
    events: List[ComplaintEventResponse] = Field(default_factory=list)

    @field_validator("observed_at", mode="after")
    @classmethod
    def utc_observed(cls, value):
        return _utc_if_naive(value)


class ComplaintStatusUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: Literal["open", "in_progress", "resolved", "closed"]
    note: str = Field(min_length=3, max_length=5000)


class ComplaintNoteCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    note: str = Field(min_length=3, max_length=5000)


class ComplaintIncidentLink(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    incident_id: str = Field(min_length=1, max_length=50)


class CitizenComplaintListResponse(BaseModel):
    complaints: List[ComplaintRecordResponse]
    total: int
    page: int
    total_pages: int


class ComplaintClusterResponse(BaseModel):
    cluster_id: str
    ward_id: str
    locality_id: str
    complaint_type: str
    complaint_ids: List[str]
    complaint_count: int
    first_reported_at: datetime
    last_reported_at: datetime
    explanation: str
    latitude: float
    longitude: float


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

    @field_validator("triggered_at", "acknowledged_at", "resolved_at", mode="after")
    @classmethod
    def utc_dates(cls, value):
        return _utc_if_naive(value)


class AlertEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_id: int
    from_status: Optional[str] = None
    to_status: str
    occurred_at: datetime

    @field_validator("occurred_at", mode="after")
    @classmethod
    def utc_date(cls, value):
        return _utc_if_naive(value)


class AlertUpdate(BaseModel):
    """Payload to update alert status."""
    model_config = ConfigDict(extra="forbid")
    status: Literal["acknowledged", "resolved", "dismissed"]


class ServiceNoticeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=5, max_length=200)
    notice_type: Literal["planned_cut", "interruption", "emergency_repair", "quality_advisory", "restoration", "general"]
    message: str = Field(min_length=10, max_length=5000)
    target_kind: Literal["citywide", "wards", "zones"]
    target_ids: List[str] = Field(default_factory=list, max_length=38)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    publication: Literal["draft", "publish"] = "draft"


class ServiceNoticeEdit(ServiceNoticeCreate):
    publication: Literal["draft", "publish"] = "draft"


class ServiceNoticeAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["publish", "cancel"]


class ServiceNoticeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    notice_type: str
    message: str
    target_kind: str
    target_ids: List[str]
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    publish_at: Optional[str] = None
    status: str
    revision: int
    created_at: str
    updated_at: str
    published_at: Optional[str] = None
    is_read: Optional[bool] = None


class RiskSignal(BaseModel):
    """Validated model output consumed by the alert evaluator."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    ward_id: str
    risk_score: float = Field(ge=0, le=1)
    severity_prediction: Literal["low", "medium", "high", "critical"]
    model_version: str = Field(min_length=1, max_length=100)
    contributing_factors: List[str] = Field(default_factory=list, max_length=20)
    generated_at: datetime
    is_demo: bool = False


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

    @field_validator("reported_at", "assigned_at", "resolved_at", "closed_at", mode="after")
    @classmethod
    def utc_dates(cls, value):
        return _utc_if_naive(value)


class IncidentEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: str
    from_status: Optional[str] = None
    to_status: str
    assigned_to: Optional[str] = None
    note: Optional[str] = None
    occurred_at: datetime

    @field_validator("occurred_at", mode="after")
    @classmethod
    def utc_date(cls, value):
        return _utc_if_naive(value)


class IncidentStatusUpdate(BaseModel):
    """Payload to change incident status and optionally assign/resolve."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: Literal["open", "assigned", "in_progress", "resolved", "closed"]
    assigned_to: Optional[str] = Field(default=None, min_length=1, max_length=120)
    resolution_notes: Optional[str] = Field(default=None, min_length=3, max_length=5000)


class IncidentNoteCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    note: str = Field(min_length=3, max_length=5000)
    share_with_citizens: bool = False


# ╔═══════════════════════════════════════════════════════════╗
# ║  DASHBOARD SCHEMAS                                       ║
# ╚═══════════════════════════════════════════════════════════╝

class DashboardSummary(BaseModel):
    """Top-level KPI cards on the admin dashboard."""
    total_complaints: int
    citizen_complaints: int
    sample_complaints: int
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

    @field_validator("latest_complaint_at", mode="after")
    @classmethod
    def utc_date(cls, value):
        return _utc_if_naive(value)


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


# [ PREDICTION SCHEMAS: Synthetic-label model inference ]

class PredictionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    complaint_type: str = Field(min_length=1, max_length=80)
    severity: Literal["low", "medium", "high", "critical"]
    ward_id: str = Field(min_length=1, max_length=20)
    locality_id: Optional[str] = Field(default=None, max_length=30)


class PredictionResponse(BaseModel):
    ward_id: str
    risk_score: float = Field(ge=0, le=1)
    risk_level: Literal["low", "medium", "high", "critical"]
    model_version: str
    label_origin: str = "synthetic_heuristic"
    generated_at: datetime
    is_demo: bool = True


class WardRiskResponse(BaseModel):
    ward_id: str
    ward_name: str
    risk_score: Optional[float] = Field(default=None, ge=0, le=1)
    risk_level: Literal["unknown", "low", "medium", "high", "critical"]
    complaint_count: int
    critical_count: int
    recent_7_day_count: int
    baseline_weekly_count: float
    is_anomalous: bool
    contributing_factors: List[str]
    model_version: str
    data_through: Optional[datetime] = None
    is_demo: bool = True

    @field_validator("data_through", mode="after")
    @classmethod
    def utc_date(cls, value):
        return _utc_if_naive(value)


class ScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allow_stale_demo_data: bool = False


class ScanResponse(BaseModel):
    processed_wards: int
    anomalous_wards: int
    created_alerts: int
    deduplicated_alerts: int
    below_threshold: int
    data_through: Optional[datetime] = None
    alerts: List[AlertResponse]


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
