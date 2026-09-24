CREATE TABLE dian_credentials (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  secret_ciphertext BYTEA NOT NULL,
  secret_iv BYTEA NOT NULL,
  secret_auth_tag BYTEA NOT NULL,
  software_id TEXT NOT NULL,
  certificate_fingerprint TEXT NOT NULL,
  certificate_expires_at TIMESTAMPTZ NOT NULL,
  test_set_id TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIGURED' CHECK (status IN ('CONFIGURED','READY','SUBMITTING','ACCEPTED','REJECTED','PENDING','ERROR')),
  last_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dian_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE dian_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY dian_credentials_tenant ON dian_credentials
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON dian_credentials TO nuvora_app_user;

CREATE UNIQUE INDEX document_outbox_one_active_dian_job
  ON document_outbox (tenant_id, document_id, job_type)
  WHERE job_type IN ('dian.submit','dian.poll') AND status IN ('PENDING','IN_FLIGHT');
