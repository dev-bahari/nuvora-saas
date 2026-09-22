-- T8: Emisión local, auditoría y outbox de jobs
-- ─────────────────────────────────────────────

-- Eventos de auditoría inmutables (append-only por trigger)
CREATE TABLE audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID,
  event_type  TEXT        NOT NULL,
  actor_id    UUID,
  request_id  TEXT,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY ae_tenant ON audit_events
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT ON audit_events TO nuvora_app_user;

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are immutable';
END;
$$;

CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Outbox de jobs (escritura atómica en la transacción de emisión)
-- ponytail: simple outbox sin pg-boss; migrar cuando se necesiten workers multi-proceso
CREATE TABLE document_outbox (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id  UUID        NOT NULL REFERENCES fiscal_documents(id),
  job_type     TEXT        NOT NULL CHECK (job_type IN ('dian.submit','dian.poll','pdf.generate')),
  payload      JSONB       NOT NULL DEFAULT '{}',
  status       TEXT        NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','IN_FLIGHT','COMPLETED','FAILED','DEAD')),
  attempts     INT         NOT NULL DEFAULT 0,
  max_attempts INT         NOT NULL DEFAULT 5,
  next_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_outbox_pending ON document_outbox (next_attempt)
  WHERE status IN ('PENDING','IN_FLIGHT');

ALTER TABLE document_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY do_tenant ON document_outbox
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON document_outbox TO nuvora_app_user;

-- Columna de referencia DIAN y motivo de rechazo en documentos
ALTER TABLE fiscal_documents
  ADD COLUMN IF NOT EXISTS dian_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
