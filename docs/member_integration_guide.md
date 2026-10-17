# JalWatch: Technical Integration Guide & API Contracts

This guide documents the system architecture, integration interfaces, and handoff points across the **JalWatch** system.

---

## Quickstart: Running JalWatch

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### 2. Backend (FastAPI + SQLite/PostgreSQL)
```bash
# From project root (JalWatch/)
pip install -r requirements.txt

# Seed database with real Nagpur CSV data (38 wards, 10,000 complaints, telemetry alerts & incidents)
python -m backend.app.seed

# Start FastAPI server
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
- Swagger Interactive Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 3. Frontend (Vite + React + Leaflet + Recharts)
```bash
cd frontend
npm install
npm run dev
```
- Access web application: [http://127.0.0.1:5173](http://127.0.0.1:5173)

---

## Subsystem Architecture & Responsibilities

| Subsystem | Scope | Key Capabilities | Deliverable |
|:---|:---|:---|:---|
| **AI / Machine Learning** | Incident Risk Prediction | Feature extraction, pattern detection, risk scoring | Inference functions in `backend/app/routers/predictions.py` |
| **Data & GIS** | Spatial Layers & Networks | Ward boundaries, pipe lines, junction nodes | PostGIS spatial queries in `backend/app/routers/wards.py` |
| **Operations Center** | Alerts, Work Orders, Dashboard | Early warning alerts, work order dispatch, analytics | Complete REST API & React operations console |

---

## Machine Learning Integration Interface

### Location
File: [`backend/app/routers/predictions.py`](file:///c:/Users/srush/OneDrive/Desktop/JalWatch/backend/app/routers/predictions.py)

### Endpoints
1. **Single Inference Endpoint:** `POST /api/predictions/risk`
   - **Input:**
     ```json
     {
       "ward_id": "W001",
       "complaint_type": "low_pressure"
     }
     ```
   - **Output:**
     ```json
     {
       "ward_id": "W001",
       "risk_score": 0.85,
       "risk_level": "critical",
       "predicted_incidents": 8,
       "contributing_factors": [
         "High complaint volume in ward",
         "Acoustic anomaly detected"
       ],
       "confidence": 0.92,
       "generated_at": "2026-10-17T22:00:00Z"
     }
     ```

2. **Batch / Ward Rankings Endpoint:** `GET /api/predictions/risk`
   - Returns array of `{ ward_id, ward_name, risk_score, severity_prediction, confidence, recommended_action }` used directly by the Executive Dashboard and AI Risk Models view.

---

## GIS & Water Network Integration Interface

### Location
Files: [`backend/app/routers/wards.py`](file:///c:/Users/srush/OneDrive/Desktop/JalWatch/backend/app/routers/wards.py) and [`backend/app/models.py`](file:///c:/Users/srush/OneDrive/Desktop/JalWatch/backend/app/models.py)

### Data Sources
- `data/raw/wards_master.csv` (38 Nagpur wards with center coordinates)
- `data/raw/water_network_nodes.csv` (802 junctions/pumps/reservoirs)
- `data/raw/water_network_pipes.csv` (1,452 pipe segments with diameter & age)

### Network Layers
1. **Ward GeoJSON Boundaries:**
   - The `Ward` table in `backend/app/models.py` includes a `boundary_geojson: Text` column.
   - Populate this column with MultiPolygon coordinates from official shapefiles.
2. **Network Pipes & Nodes:**
   - Expose GeoJSON endpoints in `backend/app/routers/wards.py`:
     - `GET /api/network/nodes` -> GeoJSON FeatureCollection of junctions & pumps
     - `GET /api/network/pipes` -> GeoJSON FeatureCollection of pipe LineStrings
   - The React Leaflet map (`frontend/src/components/MapView.jsx`) is configured with standard Leaflet layers and consumes GeoJSON directly with `L.geoJSON()`.

---

## Complete REST API Directory

| Method | Endpoint | Description | Scope |
|:---|:---|:---|:---|
| `GET` | `/health` | Server health check | Core Health |
| `GET` | `/api/dashboard/summary` | Top-level KPI counts, resolution SLA, active alerts | Analytics |
| `GET` | `/api/dashboard/complaints-by-type` | Grouped breakdown by category | Analytics |
| `GET` | `/api/dashboard/complaints-by-severity` | Grouped breakdown by priority | Analytics |
| `GET` | `/api/dashboard/complaint-trends` | 30/90 day daily complaint inflow | Analytics |
| `GET` | `/api/dashboard/ward-risks` | Ward prioritization ranking | Analytics |
| `GET` | `/api/complaints` | Paginated grievances with ward/type/status filters | Grievances |
| `GET` | `/api/complaints/{id}` | Single complaint audit details | Grievances |
| `GET` | `/api/wards` | 38 Nagpur wards with zone & coordinates | Spatial |
| `GET` | `/api/alerts` | Filterable alert stream (critical, high, medium) | Telemetry |
| `POST` | `/api/alerts` | Broadcast early warning alert | Telemetry |
| `PATCH` | `/api/alerts/{id}/acknowledge`| Acknowledge alert | Telemetry |
| `PATCH` | `/api/alerts/{id}/resolve` | Mark alert resolved | Telemetry |
| `GET` | `/api/incidents` | Filterable incident work order list | Work Orders |
| `POST` | `/api/incidents` | Create incident ticket & crew dispatch | Work Orders |
| `PATCH` | `/api/incidents/{id}/status` | Advance lifecycle status & notes | Work Orders |
| `GET` | `/api/predictions/risk` | Batch ML ward risk predictions | AI Risk Engine |
| `POST` | `/api/predictions/risk` | Single complaint risk scoring | AI Risk Engine |
