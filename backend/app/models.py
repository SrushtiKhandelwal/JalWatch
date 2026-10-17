"""
SQLAlchemy database models for JalWatch.

These define the actual database tables. Each class = one table.
Supports spatial geometries, telemetry alerts, and grievance redressal pipelines.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Text,
    ForeignKey, JSON,
)
from sqlalchemy.orm import relationship

from .database import Base


# [ ENUMS: allowed values for status / type / severity ]

class ComplaintType(str, enum.Enum):
    low_pressure = "low_pressure"
    water_shortage = "water_shortage"
    dirty_water = "dirty_water"
    leakage = "leakage"


class SeverityLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ComplaintStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class AlertStatus(str, enum.Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"
    dismissed = "dismissed"


class IncidentStatus(str, enum.Enum):
    reported = "reported"
    open = "open"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


# [ WARD: administrative ward in Nagpur ]

class Ward(Base):
    __tablename__ = "wards"

    ward_id = Column(String, primary_key=True, index=True)        # W001-W038
    ward_number = Column(Integer, nullable=False)
    ward_name = Column(String, nullable=False)
    zone_id = Column(String, nullable=False)                       # Z01-Z10
    zone_name = Column(String, nullable=False)
    locality_count = Column(Integer, default=0)
    representative_latitude = Column(Float)
    representative_longitude = Column(Float)
    boundary_geojson = Column(Text, nullable=True)

    # Relationships
    complaints = relationship("Complaint", back_populates="ward", lazy="dynamic")
    alerts = relationship("Alert", back_populates="ward", lazy="dynamic")
    incidents = relationship("Incident", back_populates="ward", lazy="dynamic")


# [ COMPLAINT: citizen grievance report ]

class Complaint(Base):
    __tablename__ = "complaints"

    complaint_id = Column(String, primary_key=True, index=True)    # CMP000001
    citizen_id = Column(String, nullable=True)
    reported_at = Column(DateTime, nullable=False)
    complaint_type = Column(String, nullable=False)                # low_pressure | water_shortage | dirty_water | leakage
    description = Column(Text, nullable=True)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=False, index=True)
    locality_id = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    severity = Column(String, nullable=False)                      # low | medium | high | critical
    status = Column(String, nullable=False, default="open")        # open | in_progress | resolved | closed
    incident_id = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    data_origin = Column(String, nullable=True)
    scenario_id = Column(String, nullable=True)
    incident_risk_label = Column(Integer, default=0)               # 0 = no risk, 1 = risk
    training_label_origin = Column(String, nullable=True)

    # Relationships
    ward = relationship("Ward", back_populates="complaints")


# [ ALERT: early warning telemetry generated from risk thresholds ]

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_type = Column(String, nullable=False)                    # high_risk | anomaly | threshold_breach | cluster_detected
    severity = Column(String, nullable=False)                      # low | medium | high | critical
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=False, index=True)
    locality_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    risk_score = Column(Float, default=0.0)                        # 0.0 to 1.0
    status = Column(String, nullable=False, default="active")      # active | acknowledged | resolved | dismissed
    triggered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    source = Column(String, default="system")                      # system | ml_model | threshold_rule

    # Relationships
    ward = relationship("Ward", back_populates="alerts")


# [ INCIDENT: tracked work order and crew response ]

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String, unique=True, nullable=False, index=True)  # INC-0001
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=False, index=True)
    locality_id = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    incident_type = Column(String, nullable=False)                 # pipe_burst | contamination | supply_failure | pressure_drop | flooding
    severity = Column(String, nullable=False)                      # low | medium | high | critical
    status = Column(String, nullable=False, default="reported")    # reported → open → assigned → in_progress → resolved → closed
    assigned_to = Column(String, nullable=True)                    # Team or person name
    reported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    assigned_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    related_complaint_ids = Column(JSON, default=list)             # ["CMP000001", "CMP000002"]
    related_alert_id = Column(Integer, nullable=True)              # FK to alerts.id

    # Relationships
    ward = relationship("Ward", back_populates="incidents")
