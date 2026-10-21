# JalWatch frontend

React and Vite provide the administrator dashboard, complaint map, demo model results, alerts, and incident workflow. The app calls the FastAPI API through Vite's `/api` proxy.

Start the API first, then from this directory run `npm ci` once and `npm run dev`. Open `http://127.0.0.1:5173`. Use `npm run build` and `npm run lint` to check changes.

The bundled data is synthetic. See the [project setup guide](../docs/member_integration_guide.md) for backend setup, credentials, and data limitations.
