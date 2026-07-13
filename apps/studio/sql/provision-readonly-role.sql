\set ON_ERROR_STOP on

-- Run as a PostgreSQL administrator:
-- psql "$ADMIN_DATABASE_URL" \
--   -v studio_database=zerodrive \
--   -v app_owner=zerodrive_app \
--   -f apps/studio/sql/provision-readonly-role.sql
--
-- This script deliberately creates no password. Set it interactively afterward:
-- \password zerodrive_studio_ro

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zerodrive_studio_ro') THEN
    CREATE ROLE zerodrive_studio_ro
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE zerodrive_studio_ro
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE zerodrive_studio_ro SET default_transaction_read_only = on;
ALTER ROLE zerodrive_studio_ro SET statement_timeout = '10s';
ALTER ROLE zerodrive_studio_ro SET lock_timeout = '2s';
ALTER ROLE zerodrive_studio_ro SET idle_in_transaction_session_timeout = '30s';

REVOKE ALL PRIVILEGES ON DATABASE :"studio_database" FROM zerodrive_studio_ro;
GRANT CONNECT ON DATABASE :"studio_database" TO zerodrive_studio_ro;
REVOKE TEMPORARY ON DATABASE :"studio_database" FROM zerodrive_studio_ro;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM zerodrive_studio_ro;
GRANT USAGE ON SCHEMA public TO zerodrive_studio_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zerodrive_studio_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE :"app_owner" IN SCHEMA public
  GRANT SELECT ON TABLES TO zerodrive_studio_ro;
