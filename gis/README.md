# JalWatch GIS, Spatial Layers, and Geographic API Documentation

**Owner:** Member 2 (Datasets, Data Validation, Preprocessing, GIS Layers, Geographic APIs, Map Integration)
**Location:** Nagpur Municipal Corporation (NMC), Maharashtra, India
**Spatial Reference System:** WGS84 (`EPSG:4326` / `urn:ogc:def:crs:OGC:1.3:CRS84`)

---

## 1. System Architecture & Flow

JalWatch is an AI-assisted water-supply monitoring and complaint early-warning platform for Nagpur. The GIS subsystem transforms raw municipal and infrastructure data into validated geospatial layers consumed by the FastAPI backend and interactive React Leaflet map.

```
+-------------------------------------------------------------------------+
|                              Raw Datasets                               |
|                     (Stored in data/raw/ - Read Only)                   |
|  * wards_master.csv                 * water_network_nodes.csv           |
|  * wards_localities.csv             * water_network_pipes.csv           |
|  * wards_localities_QA.csv          * jalwatch_complaints_final_50000.csv|
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Data Validation & Preprocessing Pipeline               |
|  * python -m gis.validate_data  --> validation_report.json / .md        |
|  * python -m gis.preprocess     --> Cleaned CSVs & GeoJSON layers       |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                           Processed GeoJSON                             |
|                   (Stored in data/processed/)                           |
|  * wards_representative_points.geojson (38 centroid features)           |
|  * water_network_nodes.geojson         (800 Point features, [DEMO])     |
|  * water_network_pipes.geojson         (1,450 LineString features, [DEMO])|
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                       FastAPI Backend Operations                        |
|  * GET /api/wards             * GET /api/network/nodes                  |
|  * GET /api/complaints        * GET /api/network/pipes                  |
|  * GET /api/network/summary   (All protected by session auth)           |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                       Frontend Interactive Map                          |
|                     (frontend/src/components/MapView.jsx)               |
|  * 4 Switchable Layer Groups: Wards, Complaints, Nodes, Pipes           |
|  * Dynamic Filter Controls (Ward, Category, Pin Limit)                  |
|  * Safe, Informative Popups & Interactive Legend                        |
+-------------------------------------------------------------------------+
```

---

## 2. Raw Datasets & Schema Specifications

Raw datasets are stored in `data/raw/` and remain strictly read-only:

| Dataset | Rows | Description | Provenance |
| --- | --- | --- | --- |
| `wards_master.csv` | 38 | 38 administrative wards (W001-W038) with zone names and centroid coordinates | NMC Official / Derived |
| `wards_localities.csv` | 860 | 860 municipal localities mapped to wards | NMC Zone/Ward Area Details |
| `wards_localities_QA.csv` | 10 | Quality assurance checklist for ward extraction | Engineering Documentation |
| `water_network_nodes.csv` | 800 | Network junctions, valves, pumps, tanks, and reservoirs | Synthetic Demonstration |
| `water_network_pipes.csv` | 1,450 | Network distribution pipeline segments with GeoJSON LineStrings | Synthetic Demonstration |
| `jalwatch_complaints_final_50000.csv` | 50,000 | Citizen water grievances (leakage, shortage, contamination, pressure) | Synthetic Demonstration |

---

## 3. Geographic Data Integrity & Critical Verification

### Ward Boundaries (PDF Reference vs. Polygon GeoJSON)
- **Finding:** The `boundary_geojson` column in `wards_master.csv` and `wards_localities.csv` contains external HTTP URLs referencing official NMC consolidated ward map PDFs (`https://election.nagpurnmc.in/storage/uploads/1759544972_NMC%20GIS%20Full%20Map.pdf`).
- **Rule:** PDF URLs are **never** parsed or converted into polygon geometries.
- **Integrity Guarantee:** JalWatch strictly prohibits fabricating synthetic boundary polygons (e.g. Voronoi or convex hulls). Instead, **official representative centroid coordinates (`representative_latitude`, `representative_longitude`)** are preserved as truthful references.
- **Missing Source:** Official municipal GIS cadastral polygon shapefiles have not been published by NMC. When available, genuine polygon shapefiles should be processed into `data/processed/wards_polygons.geojson`.

### Water Network Provenance
- All 800 nodes and 1,450 pipes are **Synthetic Demonstration Data**.
- Every API endpoint and map popup explicitly labels these features as **`[DEMO PREVIEW]`**.
- These features must never be presented as live sensor telemetry or verified municipal engineering assets.

### Coordinate Standards
- Coordinate format in GeoJSON: `[longitude, latitude]` per RFC 7946.
- Bounding box: Nagpur metropolitan boundary (`min_lat: 21.00`, `max_lat: 21.30`, `min_lon: 79.00`, `max_lon: 79.30`).
- Coordinate integrity: Zero inverted coordinates, zero NaN/null coordinates.

### Citizen Privacy & PII Protection
- The raw grievance dataset contains pseudonymous `citizen_id` tokens (e.g., `CIT001400`).
- Public map popups, spatial layers, and API response summaries omit `citizen_id` to guarantee privacy compliance.

---

## 4. Execution & Pipeline Commands

Run the pipeline from the project root using the virtual environment:

### Step 1: Validate Raw Datasets
```powershell
python -m gis.validate_data
```
Outputs:
- Machine-readable audit: `data/processed/validation_report.json`
- Human-readable summary: `data/processed/validation_report.md`

### Step 2: Preprocess & Generate GeoJSON Layers
```powershell
python -m gis.preprocess
```
Generates in `data/processed/`:
- `wards_master_cleaned.csv`
- `wards_representative_points.geojson`
- `wards_localities_cleaned.csv`
- `water_network_nodes_cleaned.csv`
- `water_network_nodes.geojson`
- `water_network_pipes_cleaned.csv`
- `water_network_pipes.geojson`
- `complaints_sample_sanitized_1000.csv`
- `preprocessing_summary.json`

### Step 3: Seed Database
```powershell
python -m backend.app.seed
```
Seeds wards, network nodes, network pipes, complaints, alerts, and incidents into SQLite `jalwatch.db`.

### Step 4: Optional Production PostGIS Setup
```powershell
# For PostgreSQL / PostGIS deployments:
# set DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/jalwatch
python -m gis.load_to_postgis
```

---

## 5. Backend GIS API Endpoints

All endpoints require an active administrator session cookie (`dependencies=[Depends(require_session)]`).

### 1. `GET /api/network/nodes`
Returns water network nodes as an RFC 7946 GeoJSON `FeatureCollection`.

**Query Parameters:**
- `ward_id` *(optional, string)*: Filter by ward (e.g., `W001`).
- `node_type` *(optional, string)*: Filter by type (`junction`, `valve`, `pump_station`, `tank`, `reservoir`).

**Response Example:**
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "layer_name": "water_network_nodes",
    "feature_count": 800,
    "geometry_type": "Point",
    "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
    "data_origin": "synthetic",
    "is_demo": true,
    "disclaimer": "Synthetic demonstration water network data for Nagpur. Not verified municipal infrastructure or live telemetry."
  },
  "features": [
    {
      "type": "Feature",
      "id": "N00001",
      "geometry": {
        "type": "Point",
        "coordinates": [79.081413, 21.184747]
      },
      "properties": {
        "node_id": "N00001",
        "node_type": "junction",
        "ward_id": "W009",
        "elevation_m": 299.5,
        "data_origin": "synthetic",
        "is_demo": true
      }
    }
  ]
}
```

### 2. `GET /api/network/pipes`
Returns water network distribution pipelines as an RFC 7946 GeoJSON `FeatureCollection`.

**Query Parameters:**
- `ward_id` *(optional, string)*: Filter by ward (e.g., `W001`).
- `valve_status` *(optional, string)*: Filter by status (`open`, `closed`).
- `material` *(optional, string)*: Filter by pipe material (`MS`, `DI`, `HDPE`, `CI`, `PVC`).

**Response Example:**
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "layer_name": "water_network_pipes",
    "feature_count": 1450,
    "geometry_type": "LineString",
    "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
    "data_origin": "synthetic",
    "is_demo": true,
    "disclaimer": "Synthetic demonstration water network distribution pipelines for Nagpur. Not verified municipal infrastructure or live telemetry."
  },
  "features": [
    {
      "type": "Feature",
      "id": "P00001",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [79.081413, 21.184747],
          [79.129956, 21.15835]
        ]
      },
      "properties": {
        "pipe_id": "P00001",
        "from_node_id": "N00001",
        "to_node_id": "N00002",
        "diameter_mm": 80,
        "material": "MS",
        "length_m": 5822.9,
        "valve_status": "open",
        "flow_direction": "forward",
        "ward_id": "W009",
        "data_origin": "synthetic",
        "is_demo": true
      }
    }
  ]
}
```

### 3. `GET /api/network/summary`
Returns aggregate statistics of the water network infrastructure:
```json
{
  "total_nodes": 800,
  "total_pipes": 1450,
  "total_pipe_length_km": 4210.58,
  "node_types": {
    "junction": 629,
    "valve": 91,
    "pump_station": 32,
    "tank": 26,
    "reservoir": 22
  },
  "materials": {
    "MS": 312,
    "DI": 298,
    "HDPE": 285,
    "CI": 280,
    "PVC": 275
  },
  "valve_statuses": {
    "open": 1380,
    "closed": 70
  },
  "data_origin": "synthetic",
  "is_demo": true
}
```

---

## 6. Frontend Map Integration (`MapView.jsx`)

The interactive map in `frontend/src/components/MapView.jsx` provides:
1. **Four Switchable GIS Layers:**
   - **Municipal Ward Centroids:** Interactive markers displaying ward number, zone name, locality count, and boundary reference note.
   - **Citizen Grievance Pins:** Color-coded by grievance category (leakage, shortage, contamination, low pressure).
   - **Distribution Pipelines:** Color-coded by valve status (cyan for active flow, dashed red for closed valves) and weighted by diameter.
   - **Network Nodes:** Distinct color and size styling for junctions (slate), valves (amber), pumps (emerald), tanks (purple), and reservoirs (blue).
2. **Layer Visibility Controls:** Checkboxes allow toggling any layer on or off without reloading.
3. **Filter & Sample Controls:**
   - Filter complaints by category (`leakage`, `water_shortage`, `low_pressure`, `dirty_water`, `bad_smell`).
   - Ward selector dropdown to zoom and isolate infrastructure to a single ward.
   - Sample limit selector (`100`, `250`, `500`) with a clear banner displaying rendered count vs total database records.
4. **Side Drawer Inspector:** Clicking any ward, complaint, node, or pipe opens a detailed sidebar panel.
5. **Interactive Legend:** Explains all symbols and colors with explicit synthetic demonstration badges.

---

## 7. Verification & Automated Testing

Run the test suite:
```powershell
python -m unittest discover -s tests -v
```
All 20 tests verify:
- Coordinate bounds validation and inverted lat/lon detection.
- Detection of external PDF URL references vs GeoJSON polygons.
- LineString vertex formatting and coordinate ordering `[longitude, latitude]`.
- Network endpoints authentication requirement (HTTP 401 on missing session).
- GeoJSON FeatureCollection response formatting and ward filtering.
- Non-regression compatibility with Member 3's incident and alert lifecycle tests.

Run frontend production checks:
```powershell
cd frontend
npm run lint
npm run build
```
Builds cleanly with zero errors.
