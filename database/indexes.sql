-- JalWatch Relational and Spatial Indexes

-- Indexes on Wards
CREATE INDEX IF NOT EXISTS idx_wards_ward_number ON wards(ward_number);
CREATE INDEX IF NOT EXISTS idx_wards_zone_id ON wards(zone_id);

-- Indexes on Complaints
CREATE INDEX IF NOT EXISTS idx_complaints_ward_id ON complaints(ward_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_severity ON complaints(severity);
CREATE INDEX IF NOT EXISTS idx_complaints_reported_at ON complaints(reported_at);
CREATE INDEX IF NOT EXISTS idx_complaints_complaint_type ON complaints(complaint_type);

-- Indexes on Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_ward_id ON alerts(ward_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at);

-- Indexes on Incidents
CREATE INDEX IF NOT EXISTS idx_incidents_ward_id ON incidents(ward_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_at ON incidents(reported_at);

-- Indexes on Network Nodes & Pipes
CREATE INDEX IF NOT EXISTS idx_network_nodes_ward_id ON network_nodes(ward_id);
CREATE INDEX IF NOT EXISTS idx_network_nodes_node_type ON network_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_network_pipes_ward_id ON network_pipes(ward_id);
CREATE INDEX IF NOT EXISTS idx_network_pipes_from_node ON network_pipes(from_node_id);
CREATE INDEX IF NOT EXISTS idx_network_pipes_to_node ON network_pipes(to_node_id);
CREATE INDEX IF NOT EXISTS idx_network_pipes_valve_status ON network_pipes(valve_status);
