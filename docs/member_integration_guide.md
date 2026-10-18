# JalWatch integration and handoff guide

## Current ownership

Member 3 owns the FastAPI operations API, alert and incident workflows, and dashboard. Member 2 will replace the current map preview with validated ward, locality, pipe, node, and complaint layers. Member 1 will train and validate the incident model. The UI deliberately keeps those two unfinished integrations separate from measured operations data.

The bundled SQLite data is **synthetic demonstration data**: 38 wards, 10,000 seeded complaints, 30 seeded alerts, and 20 seeded incidents. It is useful for UI development and contract testing. It is not live telemetry or an official municipal feed.

## Run locally

From the project root:

```powershell
python -m pip install -r requirements.txt
Copy-Item backend\.env.example .env
# Edit .env: set a unique administrator password and a random 32+ character secret.
python -m backend.app.seed
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`, then sign in with `JALWATCH_ADMIN_PASSWORD`. All data endpoints require an eight-hour, HTTP-only administrator session cookie. `/health` returns 503 until credentials are configured. For HTTPS deployment, set `JALWATCH_COOKIE_SECURE=true` and `JALWATCH_CORS_ORIGINS` to the exact frontend origin. Use an institutional identity provider and managed migrations before multi-user or public deployment.

Run checks from the project root:

```powershell
python -m unittest discover -s tests -v
Set-Location frontend
npm run build
npm run lint
```

## Member 3 API contract

All paths below start with `/api` and require the administrator session unless marked public.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | Public sign-in with `{ "password": "..." }` |
| `GET` | `/auth/me` | Check the current session |
| `POST` | `/auth/logout` | Clear the session cookie |
| `GET` | `/incidents` | Recent incidents; filters: `status`, `severity`, `ward_id`, `page`, `page_size` |
| `POST` | `/incidents` | Create and optionally assign a ticket |
| `GET` | `/incidents/{incident_id}` | Read one ticket |
| `PATCH` | `/incidents/{incident_id}/status` | Advance one lifecycle stage |
| `GET` | `/incidents/{incident_id}/events` | Append-only status history |
| `GET` | `/alerts` | Recent alerts with status, severity, ward, and pagination filters |
| `GET` | `/alerts/active-count` | Accurate active count, independent of list pagination |
| `POST` | `/alerts` | Create a manual ward alert |
| `POST` | `/alerts/evaluate` | Evaluate a validated model signal |
| `PATCH` | `/alerts/{id}` | Acknowledge, resolve, or dismiss |
| `GET` | `/alerts/{id}/events` | Append-only status history |
| `GET` | `/dashboard/summary` | Measured city totals and average complaint resolution time |
| `GET` | `/dashboard/complaints-by-type` | Complaint type counts |
| `GET` | `/dashboard/complaints-by-severity` | Complaint severity counts |
| `GET` | `/dashboard/daily-trend?days=30` | Daily series including zero-report days |
| `GET` | `/dashboard/ward-priorities?days=30` | Recent reports and active alerts by ward |

Incident creation example:

```json
{
  "title": "Feeder main rupture",
  "description": "Reported near the north junction",
  "ward_id": "W001",
  "latitude": 21.2,
  "longitude": 79.085,
  "incident_type": "pipe_burst",
  "severity": "high",
  "assigned_to": "Zone Response Crew",
  "related_alert_id": null,
  "related_complaint_ids": []
}
```

Coordinates are required and never silently replaced with the city center. `ward_id` and linked records are validated. Providing `assigned_to` creates the ticket in `assigned`; otherwise it starts in `reported`. New IDs are opaque `INC-...` values; clients must use the returned `incident_id`.

The permitted status sequence is `reported → open → assigned → in_progress → resolved → closed`. Assignment requires a crew. Resolution requires nonempty notes. A repeated request for the current status is idempotent; skipping or reversing a stage returns 409. Each accepted change creates an event record.

Manual alert creation sets `source=manual`. Alert statuses are `active → acknowledged → resolved`, with direct `active → resolved` and dismissal from active or acknowledged also allowed. Invalid reversals return 409. Creating an alert only records it in JalWatch; external SMS or email broadcast is not implemented.

## Member 1 model handoff

Member 1 should provide calibrated incident risk in the range **0.0–1.0**, a severity, model version, UTC timestamp, and explainable factors. The operations API accepts this shape at `POST /api/alerts/evaluate`:

```json
{
  "ward_id": "W001",
  "risk_score": 0.86,
  "severity_prediction": "high",
  "model_version": "incident-risk-v1",
  "contributing_factors": ["Recent complaint cluster"],
  "generated_at": "2026-10-18T10:00:00Z"
}
```

Only `high` or `critical` signals with score at least `0.70` create an alert. Signals older than 24 hours or more than five minutes in the future are rejected. An active or acknowledged model alert for the same ward suppresses another alert until the first is closed. The endpoint returns `{ alert_created, reason, alert }` so the caller can distinguish a new alert from a suppressed one. Members 1 and 3 should agree on calibration and threshold changes using evaluation results before changing this rule.

The existing `/predictions/risk` router is still Member 1's prototype and is **not** used for dashboard priorities. Its present values are not a validated model. Member 1 should replace its implementation and UI only after model evaluation.

## Member 2 data and GIS handoff

Keep `ward_id` stable across complaints, alerts, incidents, predictions, and network features. Validate locality IDs, coordinates, missing values, and source provenance before loading. The current `boundary_geojson` values in the ward CSV are references to a PDF, not usable GeoJSON polygons.

The map currently shows ward representative points and sampled complaint pins. Member 2 should add validated boundary polygons and GeoJSON endpoints for `/api/network/nodes` and `/api/network/pipes`, then connect them to the map. The provided node and pipe CSV rows are marked `synthetic` and must be labeled as a preview unless replaced by verified data.

## Deployment limits

This is a single-administrator implementation. It has no per-user roles, external dispatch integration, notification transport, validated ML model, or verified network geometry yet. Those capabilities should be added and tested before treating JalWatch as a live municipal operations system.
