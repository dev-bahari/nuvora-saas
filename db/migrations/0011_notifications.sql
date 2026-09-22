-- Migration 0011: Notificaciones — email, webhooks y WhatsApp V1
-- notification_channels: configuración por tenant
-- notification_log: registro append-only de envíos

CREATE TABLE notification_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type  TEXT NOT NULL CHECK (channel_type IN ('EMAIL','WEBHOOK','WHATSAPP')),
  config        JSONB NOT NULL DEFAULT '{}',
  -- EMAIL: {"to": ["a@b.com"], "from": "billing@co.com"}
  -- WEBHOOK: {"url": "https://...", "secret": "<hmac-secret>"}
  -- WHATSAPP: {"phone": "+57300...", "provider": "meta", "token": "..."}
  events        TEXT[] NOT NULL DEFAULT '{}',
  -- e.g. ['invoice.issued', 'invoice.rejected', 'credit_note.created']
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_channels
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON notification_channels TO nuvora_app;

CREATE TABLE notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id    UUID REFERENCES notification_channels(id),
  document_id   UUID REFERENCES fiscal_documents(id),
  event_type    TEXT NOT NULL,
  channel_type  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('SENT','FAILED','SKIPPED')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_log
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Append-only
CREATE OR REPLACE FUNCTION prevent_notification_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'notification_log is immutable (append-only)';
END;
$$;

CREATE TRIGGER notification_log_immutable
  BEFORE UPDATE OR DELETE ON notification_log
  FOR EACH ROW EXECUTE FUNCTION prevent_notification_log_mutation();

GRANT SELECT, INSERT ON notification_log TO nuvora_app;

CREATE INDEX ON notification_log (tenant_id, document_id);
CREATE INDEX ON notification_log (tenant_id, sent_at DESC);

-- Permissions
INSERT INTO permissions (name, description) VALUES
  ('notifications.manage', 'Gestionar canales de notificación'),
  ('notifications.read',   'Ver historial de notificaciones')
ON CONFLICT (name) DO NOTHING;
