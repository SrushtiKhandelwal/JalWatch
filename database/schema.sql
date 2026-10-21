-- JalWatch Relational & Spatial Database Schema
-- Compatible with PostgreSQL + PostGIS and SQLite

-- 1. Administrative Wards
CREATE TABLE IF NOT EXISTS wards (
    ward_id VARCHAR(10) PRIMARY KEY,
    ward_number INTEGER NOT NULL,
    ward_name VARCHAR(100) NOT NULL,
    zone_id VARCHAR(10) NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    locality_count INTEGER DEFAULT 0,
    representative_latitude DOUBLE PRECISION,
    representative_longitude DOUBLE PRECISION,
    boundary_geojson TEXT
);

-- 2. Citizen Grievance Complaints
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id VARCHAR(20) PRIMARY KEY,
    citizen_id VARCHAR(50),
    reported_at TIMESTAMP WITH TIME ZONE NOT NULL,
    complaint_type VARCHAR(50) NOT NULL,
    description TEXT,
    ward_id VARCHAR(10) NOT NULL REFERENCES wards(ward_id),
    locality_id VARCHAR(20),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    incident_id VARCHAR(30),
    resolved_at TIMESTAMP WITH TIME ZONE,
    data_origin VARCHAR(50),
    scenario_id VARCHAR(50),
    incident_risk_label INTEGER DEFAULT 0,
    training_label_origin VARCHAR(50)
);

-- 3. Telemetry Early Warning Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    ward_id VARCHAR(10) NOT NULL REFERENCES wards(ward_id),
    locality_id VARCHAR(20),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    risk_score DOUBLE PRECISION DEFAULT 0.0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50) DEFAULT 'system'
);

-- 4. Alert Audit Events
CREATE TABLE IF NOT EXISTS alert_events (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Incident Work Orders
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(30) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    ward_id VARCHAR(10) NOT NULL REFERENCES wards(ward_id),
    locality_id VARCHAR(20),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reported',
    assigned_to VARCHAR(120),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    related_complaint_ids JSON DEFAULT '[]'::json,
    related_alert_id INTEGER
);

-- 6. Incident Audit Events
CREATE TABLE IF NOT EXISTS incident_events (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(30) NOT NULL REFERENCES incidents(incident_id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    assigned_to VARCHAR(120),
    note TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Water Network Nodes (Synthetic Infrastructure Layer)
CREATE TABLE IF NOT EXISTS network_nodes (
    node_id VARCHAR(20) PRIMARY KEY,
    node_type VARCHAR(50) NOT NULL, -- junction, valve, pump_station, tank, reservoir
    ward_id VARCHAR(10) NOT NULL REFERENCES wards(ward_id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    elevation_m DOUBLE PRECISION,
    data_origin VARCHAR(50) DEFAULT 'synthetic',
    scenario_id VARCHAR(50)
);

-- 8. Water Network Pipes (Synthetic Infrastructure Layer)
CREATE TABLE IF NOT EXISTS network_pipes (
    pipe_id VARCHAR(20) PRIMARY KEY,
    from_node_id VARCHAR(20) NOT NULL REFERENCES network_nodes(node_id),
    to_node_id VARCHAR(20) NOT NULL REFERENCES network_nodes(node_id),
    geometry TEXT NOT NULL, -- GeoJSON LineString
    diameter_mm INTEGER,
    material VARCHAR(30), -- MS, DI, HDPE, CI, PVC
    length_m DOUBLE PRECISION,
    valve_status VARCHAR(20) DEFAULT 'open', -- open, closed
    flow_direction VARCHAR(20) DEFAULT 'forward', -- forward, reverse, bi
    ward_id VARCHAR(10) NOT NULL REFERENCES wards(ward_id),
    data_origin VARCHAR(50) DEFAULT 'synthetic',
    scenario_id VARCHAR(50)
);
