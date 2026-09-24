-- T13: Tenant settings & metrics support

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  legal_name         TEXT NOT NULL DEFAULT '',
  nit                TEXT NOT NULL DEFAULT '',
  address            TEXT,
  city               TEXT,
  phone              TEXT,
  email              TEXT,
  tax_regime         TEXT NOT NULL DEFAULT 'SIMPLIFICADO'
                       CHECK (tax_regime IN ('COMUN', 'SIMPLIFICADO', 'NO_APLICA')),
  dian_environment   TEXT NOT NULL DEFAULT 'HABILITACION'
                       CHECK (dian_environment IN ('HABILITACION', 'PRODUCCION')),
  dian_software_id   TEXT,
  dian_software_pin  TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_settings_isolation ON tenant_settings
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

GRANT SELECT, INSERT, UPDATE ON tenant_settings TO nuvora_app;

INSERT INTO permissions (name, description, module) VALUES
  ('tenant.settings', 'Manage tenant company settings', 'settings')
ON CONFLICT (name) DO NOTHING;
