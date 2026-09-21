-- 0002_rls.sql
-- Nuvora SaaS — Row Level Security (RLS) Policies & Tenant Isolation Probe (Ruling B1)

-- 1. Fixture/Probe table for tenant isolation verification (Ruling B1)
CREATE TABLE IF NOT EXISTS tenancy_isolation_probe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable and FORCE Row Level Security on all tenant-scoped tables
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE tenancy_isolation_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_isolation_probe FORCE ROW LEVEL SECURITY;

-- 3. Tenant Isolation Policies
-- Rule: Row is visible/writable ONLY when tenant_id matches current transaction setting 'app.tenant_id'

DROP POLICY IF EXISTS tenant_isolation_memberships ON memberships;
CREATE POLICY tenant_isolation_memberships ON memberships
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
CREATE POLICY tenant_isolation_sessions ON sessions
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_probe_policy ON tenancy_isolation_probe;
CREATE POLICY tenant_isolation_probe_policy ON tenancy_isolation_probe
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 4. Restricted application role without BYPASSRLS / SUPERUSER
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nuvora_app_user') THEN
    CREATE ROLE nuvora_app_user WITH LOGIN PASSWORD 'nuvora_local_dev_password' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE nuvora_dev TO nuvora_app_user;
GRANT USAGE ON SCHEMA public TO nuvora_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nuvora_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nuvora_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO nuvora_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO nuvora_app_user;
