# JalWatch setup and integration guide

## What is integrated

JalWatch now connects the FastAPI operations workflow, React dashboard, synthetic GIS preview, and a complaint risk model. The local seed loads 38 wards, 860 named localities, 800 network nodes, 1,450 pipes, and all 50,000 complaints. It also creates 30 example alerts and 20 example incidents.

The supplied complaints, labels, and network geometry are **synthetic demonstration data**. The model estimates the supplied `synthetic_heuristic` label. Its score has not been validated as a probability of a future water incident. The latest bundled complaint was reported on 2026-10-01, so this dataset must not trigger unattended operational warnings.

## Minimal local setup (Windows PowerShell)

From the repository root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-app.txt
Copy-Item backend\.env.example .env
```

Edit `.env` to provide a unique `JALWATCH_ADMIN_PASSWORD` and a random `JALWATCH_SESSION_SECRET` of at least 32 characters. The `.env` file is ignored by Git. Set `DATABASE_URL=sqlite:///./jalwatch_demo.db` to use a separate demo database; the default points to `jalwatch.db`. Then run:

```powershell
.\.venv\Scripts\python.exe -m backend.app.seed
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` and sign in with the password from `.env`. The demo database is seeded only when empty. **Do not use `--force` on a database containing work you want to retain**; it drops all tables.

The checked-in model JSON is ready to use. Retraining it needs only Python's standard library:

```powershell
.\.venv\Scripts\python.exe -m ml.train
.\.venv\Scripts\python.exe -m ml.evaluate
```

The larger `requirements.txt` is for optional GIS preprocessing and PostgreSQL work. It is not needed to run or train the local demo. Rebuild the GIS artifacts only when the source CSVs change; see [GIS README](../gis/README.md).

## Application flow

1. The data seeder validates ward and locality links while loading complaints and the synthetic network into SQLite.
2. The map displays ward representative markers, a sample of complaint coordinates, network nodes and pipes, and the named localities for a selected ward. The locality source has ward representative coordinates, so localities are listed rather than plotted as precise points. The ward source has no usable boundary polygons.
3. The model scores a complaint from its type, severity, ward, and locality. The model view ranks wards by the average score of complaints in the latest 30 days **of the available data**. A seven-day count rule compares each ward with its previous four weeks.
4. An administrator can explicitly scan these demo scores into alerts. If the source data is more than seven days old, the API requires `allow_stale_demo_data=true`. Repeated scans do not create duplicate open model alerts.
5. Administrators acknowledge or resolve alerts, create and advance incident tickets, and inspect the dashboard. Status changes are recorded in append-only event history.

## API and verification

All `/api` endpoints except `POST /api/auth/login` require an eight-hour HTTP-only administrator session. Useful endpoints include:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Database and credential readiness |
| `GET /api/dashboard/summary` | Complaint and response totals |
| `GET /api/wards/{ward_id}/localities` | Named localities and geometry precision |
| `GET /api/network/nodes`, `/api/network/pipes` | Synthetic network GeoJSON |
| `GET /api/predictions/model` | Saved chronological holdout report |
| `POST /api/predictions/risk` | Score one complaint at intake |
| `GET /api/predictions/risk` | Ranked ward snapshots |
| `GET /api/predictions/anomalies` | Complaint count spikes |
| `POST /api/predictions/scan-alerts` | Explicit, deduplicated demo alert scan |
| `GET /api/alerts`, `PATCH /api/alerts/{id}` | Alert workflow |
| `GET /api/incidents`, `POST /api/incidents`, `PATCH /api/incidents/{id}/status` | Incident workflow |

Run the checks from the repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Set-Location frontend
npm run build
npm run lint
```

## Limits before real deployment

The current bundle is a complete **local demonstration**, not a live municipal warning service. Real use requires verified incident outcome labels, fresh complaint feeds, actual ward polygons and locality geometry, a verified network, field validation of model thresholds, a real notification channel, role-based access, managed database migrations, and an institutional identity provider. The model metrics measure agreement with synthetic labels only. No SMS or email is sent by this application.
