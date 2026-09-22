-- T7: Numeración de documentos e idempotencia concurrente
-- ─────────────────────────────────────────────────────────

-- Secuencias por (tenant, tipo de documento)
CREATE TABLE document_sequences (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_type  TEXT        NOT NULL CHECK (document_type IN ('INVOICE','CREDIT_NOTE','DEBIT_NOTE')),
  prefix         TEXT        NOT NULL DEFAULT '',
  current_number BIGINT      NOT NULL DEFAULT 0,
  min_number     BIGINT      NOT NULL DEFAULT 1,
  max_number     BIGINT      NOT NULL DEFAULT 999999999,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_type)
);

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY ds_tenant ON document_sequences
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON document_sequences TO nuvora_app_user;

-- Claves de idempotencia por (tenant, key_hash)
CREATE TABLE idempotency_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash      TEXT        NOT NULL,
  operation     TEXT        NOT NULL,
  request_hash  TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'IN_FLIGHT'
                              CHECK (status IN ('IN_FLIGHT','COMPLETED','FAILED')),
  response_body JSONB,
  document_id   UUID,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key_hash)
);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY ik_tenant ON idempotency_keys
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON idempotency_keys TO nuvora_app_user;

-- Añadir columnas de numeración a fiscal_documents
ALTER TABLE fiscal_documents
  ADD COLUMN IF NOT EXISTS number_prefix  TEXT,
  ADD COLUMN IF NOT EXISTS document_number BIGINT;

-- Permisos requeridos para esta tarea
INSERT INTO permissions (name, description) VALUES
  ('numbering.manage', 'Manage document numbering sequences')
ON CONFLICT (name) DO NOTHING;
