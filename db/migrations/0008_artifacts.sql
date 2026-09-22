-- T9: Artefactos privados inmutables (PDF, XML)
-- ─────────────────────────────────────────────

CREATE TABLE fiscal_artifacts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id  UUID        NOT NULL REFERENCES fiscal_documents(id),
  kind         TEXT        NOT NULL CHECK (kind IN ('pdf','xml')),
  attempt      INT         NOT NULL DEFAULT 1,
  sha256       TEXT        NOT NULL,
  storage_key  TEXT        NOT NULL,
  content_type TEXT        NOT NULL,
  size_bytes   BIGINT      NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, kind, attempt),
  UNIQUE (document_id, kind, sha256)
);

ALTER TABLE fiscal_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_artifacts FORCE ROW LEVEL SECURITY;

CREATE POLICY fa_tenant ON fiscal_artifacts
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Append-only: never overwrite an artifact
CREATE OR REPLACE FUNCTION prevent_artifact_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'fiscal_artifacts are immutable';
END;
$$;

CREATE TRIGGER artifacts_immutable
  BEFORE UPDATE OR DELETE ON fiscal_artifacts
  FOR EACH ROW EXECUTE FUNCTION prevent_artifact_mutation();

GRANT SELECT, INSERT ON fiscal_artifacts TO nuvora_app_user;

-- Ephemeral render tokens (one-use, short TTL, no internal IDs in public URLs)
CREATE TABLE render_tokens (
  token_hash   TEXT        PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id  UUID        NOT NULL REFERENCES fiscal_documents(id),
  used         BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON render_tokens TO nuvora_app_user;
