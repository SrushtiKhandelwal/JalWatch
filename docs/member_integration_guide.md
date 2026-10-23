# JalWatch setup and integration guide

## What is integrated

JalWatch connects a citizen portal and NMC administrator portal through one FastAPI backend. The local seed loads 38 wards, 860 named localities, 800 network nodes, 1,450 pipes, and 50,000 historical sample complaints. It also creates 30 example internal alerts and 20 example incidents. Citizen accounts, submitted complaints, service notices, and subsequent updates are persisted alongside these samples.

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

Open `http://127.0.0.1:5173`. Choose **NMC admin** and sign in with the password from `.env`, or choose **Citizen** to register with a valid ward and locality. The database is seeded only when empty. **Do not use `--force` on a database containing work you want to retain**; it drops all tables, including citizen accounts and notices.

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
4. An administrator can explicitly scan these demo scores into internal risk signals on the **Risk signals** page (the backend calls them alerts). If the source data is more than seven days old, the API requires `allow_stale_demo_data=true`. Repeated scans do not create duplicate open model signals.
5. Citizens register with a self-selected ward and locality, submit a complaint, and see its status and update history. Their map marker uses the ward representative point, not their address. A citizen can see only their own complaints; admin endpoints require a separate signed session.
6. Administrators review both citizen submissions and supplied samples. The dashboard reports their counts separately. Related-report suggestions group unresolved citizen submissions with the same locality and category within 48 hours. Every suggested group lists its contributing complaint IDs and is only a prompt for investigation.
7. Administrators may create incidents from complaints, suggestions, or risk results, link an existing incident, assign a crew, add notes, and advance the incident. The incident form places the map marker at the source report's map point when available, or at the selected ward's representative point; the form labels this location as approximate and does not ask staff to type coordinates. Linked complaints receive the corresponding status updates. Internal risk alerts remain in the admin portal.
8. Citizen-facing service notices are separate from internal risk alerts. An admin can save a draft, publish immediately, schedule publication, edit, or cancel. Targeting supports specific wards, zones, or explicit citywide messages. Eligible citizens can mark each revision as read. Scheduled notices become visible when the API is next accessed after their publication time; no background scheduler or external delivery service is configured.

## API and verification

Admin operations require an eight-hour HTTP-only administrator session. Public area-directory and citizen authentication routes are exceptions. Citizen complaint and notice routes require a separate signed citizen session. Useful endpoints include:

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
| `POST /api/auth/citizen/register`, `POST /api/auth/citizen/login` | Citizen account access |
| `POST /api/citizen/complaints`, `GET /api/citizen/complaints` | Submit and track own complaints |
| `PATCH /api/complaints/{id}/status`, `POST /api/complaints/{id}/incident` | Admin review and linkage |
| `GET /api/clusters` | Explainable related-report suggestions |
| `GET/POST /api/service-notices`, `PUT /api/service-notices/{id}` | Admin service notices |
| `GET /api/citizen/notices`, `POST /api/citizen/notices/{id}/read` | Targeted citizen notices |

Run the checks from the repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Set-Location frontend
npm run build
npm run lint
```

## Limits before real deployment

The current bundle is a **local demonstration**, not a live municipal warning service. Real use requires verified incident outcome labels, fresh complaint feeds, actual ward polygons and locality geometry, a verified network, field validation of model thresholds, managed database migrations, and an institutional identity provider. The local administrator password is a single shared role, not individual staff accounts. The model metrics measure agreement with synthetic labels only. No SMS or email is sent by this application. New tables are created automatically for local use; schema changes to existing tables need a managed migration before production deployment.

### Related-report scaling

The current **Related reports** rule groups eligible citizen complaints by ward, locality, and category, then checks each group's submission times for 48-hour windows. It does not compare every complaint with every other complaint: it makes passes over the fetched records, with database and output sorting as additional work. The endpoint currently reads at most the newest 5,000 eligible complaints in the selected 1–90-day window and returns at most 100 suggestions. At higher volume, those caps can omit valid older groups, and repeating the query for every page load can become expensive. This is a demonstration limit, not a production-scale guarantee.

For a larger audience, retain the transparent locality/category/time rule and move its work closer to ingestion: add a composite database index for eligible complaint lookup, update cluster candidates incrementally when complaints arrive or change status, and page the review results. Measure query latency and candidate volume at the expected citywide load. An algorithm such as DBSCAN would serve a different requirement—grouping by measured physical distance—and would need reliable street-level coordinates that this dataset does not provide. Switching to a clustering algorithm alone would not solve the database workload.
