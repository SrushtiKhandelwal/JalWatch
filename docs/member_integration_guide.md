# JalWatch — Team Integration Guide & API Contracts

This guide documents the system architecture, integration contracts, and handoff points for all 3 members of the **JalWatch** team.

---

## 🚀 Quickstart: Running JalWatch

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### 2. Backend (FastAPI + SQLite/PostgreSQL)
```bash
# From project root (JalWatch/)
pip install -r requirements.txt

# Seed database with real Nagpur CSV data (38 wards, 10,000 complaints, mock alerts & incidents)
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

## 👥 Work Allocation & Responsibilities

| Member | Focus | Assigned Modules | Deliverable |
|:---|:---|:---|:---|
| **Member 1** | AI / Machine Learning | **Module 3:** Water Incident Detection<br>**Module 4:** AI-Based Risk Prediction | Trained models & risk scoring logic plugged into `backend/app/routers/predictions.py` |
| **Member 2** | Data & GIS | **Module 1:** Data Management & Validation<br>**Module 2:** GIS Map & Water Network Visualization | Clean PostGIS layers, pipe/node networks, GeoJSON boundaries plugged into `backend/app/routers/wards.py` |
| **Member 3** | Full Stack / Integration (Completed) | **Module 5:** Early Warning & Alerts<br>**Module 6:** Incident Response & Tracking<br>**Module 7:** Admin Dashboard & Analytics | Working FastAPI backend, SQLite seeder, complete React UI, and API integration contracts |

---

## 🧠 Member 1 (AI/ML Developer) Integration Contract

### Location
File: [`backend/app/routers/predictions.py`](file:///c:/Users/srush/OneDrive/Desktop/JalWatch/backend/app/routers/predictions.py)

### Your Endpoints
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

### How to Hook Your Model
In `backend/app/routers/predictions.py`:
```python
# 1. Load your trained model (e.g., joblib.load("ml/models/risk_model.joblib"))
# 2. Extract features from complaints and pipeline data
# 3. Call model.predict_proba(features)
# 4. Return PredictionResponse with your real predictions
```

---

## 🗺️ Member 2 (Data & GIS Developer) Integration Contract

### Location
Files: [`backend/app/routers/wards.py`](file:///c:/Users/srush/OneDrive/Desktop/JalWatch/backend/app/routers/wards.py) and [`backend/app/models.py`](file:///c:/Users/srush/OneDrive/Desktop/JalWatch/backend/app/models.py)

### Your Data Sources
- `data/raw/wards_master.csv` (38 Nagpur wards with center coordinates)
- `data/raw/water_network_nodes.csv` (802 junctions/pumps/reservoirs)
- `data/raw/water_network_pipes.csv` (1,452 pipe segments with diameter & age)

### How to Hook Your GIS Network Layers
1. **Ward GeoJSON Boundaries:**
   - The `Ward` table in `backend/app/models.py` already includes a `boundary_geojson: Text` column.
   - Populate this column with the true MultiPolygon coordinates from your shapefiles.
2. **Network Pipes & Nodes:**
   - Add routes in `backend/app/routers/wards.py` or create a new `backend/app/routers/network.py`:
     - `GET /api/network/nodes` -> GeoJSON FeatureCollection of junctions & pumps
     - `GET /api/network/pipes` -> GeoJSON FeatureCollection of pipe LineStrings
   - The React Leaflet map (`frontend/src/components/MapView.jsx`) is configured with standard Leaflet layers and can directly consume your GeoJSON layers with `L.geoJSON()`.

---

## 🔌 Complete REST API Summary

| Method | Endpoint | Description | Module |
|:---|:---|:---|:---|
| `GET` | `/health` | Server health check | Infrastructure |
| `GET` | `/api/dashboard/summary` | Top-level KPI counts, resolution SLA, active alerts | Module 7 |
| `GET` | `/api/dashboard/complaints-by-type` | Grouped breakdown by category | Module 7 |
| `GET` | `/api/dashboard/complaints-by-severity` | Grouped breakdown by priority | Module 7 |
| `GET` | `/api/dashboard/complaint-trends` | 30/90 day daily complaint inflow | Module 7 |
| `GET` | `/api/dashboard/ward-risks` | Ward prioritization ranking | Module 7 |
| `GET` | `/api/complaints` | Paginated grievances with ward/type/status filters | Core Data |
| `GET` | `/api/complaints/{id}` | Single complaint audit details | Core Data |
| `GET` | `/api/wards` | 38 Nagpur wards with zone & coordinates | Module 1/2 |
| `GET` | `/api/alerts` | Filterable alert stream (critical, high, medium) | Module 5 |
| `POST` | `/api/alerts` | Broadcast early warning alert | Module 5 |
| `PATCH` | `/api/alerts/{id}/acknowledge`| Acknowledge alert | Module 5 |
| `PATCH` | `/api/alerts/{id}/resolve` | Mark alert resolved | Module 5 |
| `GET` | `/api/incidents` | Filterable incident ticket list | Module 6 |
| `POST` | `/api/incidents` | Create incident ticket & crew dispatch | Module 6 |
| `PATCH` | `/api/incidents/{id}/status` | Advance lifecycle status & notes | Module 6 |
| `GET` | `/api/predictions/risk` | Batch ML ward risk predictions | Module 3/4 |
| `POST` | `/api/predictions/risk` | Single complaint risk scoring | Module 3/4 |
