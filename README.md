# JalWatch

JalWatch is a demonstration with separate citizen and NMC administrator portals. Citizens can register, submit complaints, track updates, and read service notices for their area. Administrators can review reports, inspect related-report suggestions and map layers, manage incidents, and publish area-targeted notices.

The bundled historical complaints, network geometry, and model labels are synthetic. Local development stores citizen submissions and operational actions in SQLite; the Vercel deployment is configured to use PostgreSQL.

The three team modules are connected: data loading and map layers, complaint model and anomaly rule, and the administrator response workflow. See the [setup and integration guide](docs/member_integration_guide.md) for local setup and limitations, and the [Vercel deployment guide](docs/vercel_deployment.md) for demo hosting.
