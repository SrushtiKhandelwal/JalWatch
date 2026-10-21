-- JalWatch Database Extensions
-- Required for production spatial queries and index acceleration in PostgreSQL

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
