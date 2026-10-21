-- JalWatch Spatial Analytical Queries (PostGIS & Spatial Analysis)

-- 1. Find complaints within 500 meters of an incident or pipe burst
-- (Uses ST_DWithin with geography for meter-accurate distance)
SELECT
    c.complaint_id,
    c.complaint_type,
    c.severity,
    c.status,
    c.reported_at,
    ROUND(ST_Distance(
        ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(:incident_lon, :incident_lat), 4326)::geography
    )::numeric, 1) AS distance_meters
FROM complaints c
WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(:incident_lon, :incident_lat), 4326)::geography,
    500
)
ORDER BY distance_meters ASC;

-- 2. Count network nodes and pipe length (km) by ward
SELECT
    w.ward_id,
    w.ward_name,
    w.zone_name,
    COUNT(DISTINCT n.node_id) AS total_nodes,
    COUNT(DISTINCT p.pipe_id) AS total_pipes,
    COALESCE(ROUND(SUM(p.length_m) / 1000.0, 2), 0.0) AS total_pipeline_km
FROM wards w
LEFT JOIN network_nodes n ON n.ward_id = w.ward_id
LEFT JOIN network_pipes p ON p.ward_id = w.ward_id
GROUP BY w.ward_id, w.ward_name, w.zone_name
ORDER BY w.ward_number ASC;

-- 3. Identify pipeline vulnerability clusters (high complaint density near pipes)
SELECT
    p.pipe_id,
    p.ward_id,
    p.diameter_mm,
    p.material,
    p.valve_status,
    COUNT(c.complaint_id) AS nearby_complaints_count
FROM network_pipes p
JOIN complaints c ON c.ward_id = p.ward_id
WHERE c.status IN ('open', 'in_progress')
GROUP BY p.pipe_id, p.ward_id, p.diameter_mm, p.material, p.valve_status
HAVING COUNT(c.complaint_id) > 10
ORDER BY nearby_complaints_count DESC
LIMIT 20;
