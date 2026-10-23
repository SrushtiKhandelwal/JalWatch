# JalWatch Vercel deployment

This hosts the synthetic-data demonstration as two Vercel projects from the same repository. The API project uses the repository root; the Vite frontend project uses `frontend/`. The database is a separate managed PostgreSQL service.

The current deployments are [jalwatch-api.vercel.app](https://jalwatch-api.vercel.app) and [jalwatch-web.vercel.app](https://jalwatch-web.vercel.app) in the `srushti-khandelwals-projects` Vercel team. They were deployed from the local checkout with Vercel CLI. Their Git connection is not active, so a GitHub push alone does not update them.

## 1. Prepare a database

Create a PostgreSQL database through Vercel Marketplace (for example, Neon). Use a pooled connection URL for the API and keep the database in a region close to the API function. Put that URL in the backend project's `DATABASE_URL` environment variable. The app accepts `postgresql://` URLs and selects psycopg 3 automatically. Do not use the repository's SQLite setting on Vercel.

The repository's `vercel.json` places the API function in Singapore (`sin1`) to match the JalWatch Neon database created there. If you choose a different database region, update that setting before deploying.

Use a separate database for preview deployments if previews will accept writes. Never point untrusted previews at the production database.

## 2. Import the API project

In Vercel, import this repository as a project named, for example, `jalwatch-api`. Keep **Root Directory** at the repository root. The root `app.py` exposes the FastAPI application; `requirements.txt` contains its runtime packages and `.python-version` selects Python 3.13. Do not set a frontend build command or output directory on this project.

Set these backend environment variables before deploying:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL pooled connection URL |
| `JALWATCH_ADMIN_PASSWORD` | Unique administrator password, at least 12 characters |
| `JALWATCH_SESSION_SECRET` | Random signing secret, at least 32 characters |
| `JALWATCH_COOKIE_SECURE` | `true` |

Vercel does not need a copied `.env` file. Keep all secrets in project settings. The first deployment can return 503 from `/health` until the database is seeded.

## 3. Initialize the database once

Run `python -m backend.app.seed` from a trusted local checkout, with `DATABASE_URL` set to the managed PostgreSQL URL and the Python packages installed from `requirements.txt`. This creates the schema and imports the synthetic wards, localities, network, complaints, alerts, and incidents. Do **not** run this during every build. Do **not** use `--force` after anyone has submitted data; it drops the tables.

Check `https://<api-project>.vercel.app/health` and `https://<api-project>.vercel.app/api/public/wards`. The latter should return 38 wards. Retain a backup or snapshot before any future schema change; table creation is not a migration system.

## 4. Import the frontend project

Import the same repository again as a second Vercel project, with **Root Directory** set to `frontend`. Choose the Vite framework preset, `npm run build`, and output directory `dist`. Set `JALWATCH_API_ORIGIN` to the backend project's stable HTTPS origin, for example `https://jalwatch-api.vercel.app`. Do not include `/api`, a path, or a trailing path segment. The value is used during deployment to generate a same-origin `/api/*` rewrite, so browser sessions remain on the frontend domain. The frontend needs no database credentials.

Deploy after the API has a stable URL. A changed environment variable takes effect only on a new deployment. The Vite local development server still proxies `/api` to `127.0.0.1:8000` without this variable.

For the current CLI deployment, sign in with `npx --yes vercel@65.2.0 login` once. Run `npx --yes vercel@65.2.0 deploy --prod --yes --scope srushti-khandelwals-projects` from the repository root to update the API. To update the frontend from PowerShell, run these commands from `frontend/`:

```powershell
$env:JALWATCH_API_ORIGIN = 'https://jalwatch-api.vercel.app'
npx --yes vercel@65.2.0 deploy --prod --yes --scope srushti-khandelwals-projects
Remove-Item Env:JALWATCH_API_ORIGIN
```

The local environment variable is needed because Vercel CLI evaluates `frontend/vercel.mjs` before uploading the project. Keep the same `JALWATCH_API_ORIGIN` value in the frontend project's Production environment variables as well. The `.vercel/` project links and local `.env` files stay outside Git and deployment uploads.

## 5. Verify the deployed demonstration

Open the frontend URL. Register a citizen, submit a complaint, sign in as admin, review related reports, create or update an incident, and publish a service notice. Refresh both portals and confirm that submitted data remains present. Check browser Network requests to `/api/*` for successful responses and session cookies. If a request fails, inspect the corresponding Vercel deployment's function logs.

This deployment uses synthetic historical data and a shared administrator password. Keep it as a demonstration; real municipal use needs verified data, individual staff identity, migrations, and operational monitoring.
