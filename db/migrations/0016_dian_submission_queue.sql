ALTER TABLE dian_credentials
  ADD COLUMN invoice_authorization TEXT,
  ADD COLUMN authorization_prefix TEXT,
  ADD COLUMN authorization_from BIGINT,
  ADD COLUMN authorization_to BIGINT,
  ADD COLUMN authorization_start_date DATE,
  ADD COLUMN authorization_end_date DATE;

CREATE TABLE dian_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES fiscal_documents(id),
  pg_boss_job_id UUID,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SUBMITTING','PENDING','ACCEPTED','REJECTED','ERROR')),
  attempts INT NOT NULL DEFAULT 0,
  tracking_id TEXT,
  signed_xml BYTEA,
  signed_xml_sha256 TEXT,
  zip_payload BYTEA,
  zip_sha256 TEXT,
  response_xml BYTEA,
  status_code TEXT,
  message TEXT,
  errors JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, document_id)
);

ALTER TABLE dian_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dian_submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY dian_submissions_tenant ON dian_submissions
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON dian_submissions TO nuvora_app_user;

CREATE OR REPLACE FUNCTION protect_dian_submission_artifacts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signed_xml IS NOT NULL AND (
    NEW.signed_xml IS DISTINCT FROM OLD.signed_xml OR
    NEW.zip_payload IS DISTINCT FROM OLD.zip_payload OR
    NEW.signed_xml_sha256 IS DISTINCT FROM OLD.signed_xml_sha256 OR
    NEW.zip_sha256 IS DISTINCT FROM OLD.zip_sha256
  ) THEN RAISE EXCEPTION 'DIAN signed artifacts are immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dian_submission_artifacts_immutable
  BEFORE UPDATE ON dian_submissions FOR EACH ROW EXECUTE FUNCTION protect_dian_submission_artifacts();
