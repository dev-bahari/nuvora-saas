-- Migration 0010: Contabilidad básica inmutable
-- journal_entries: asientos contables append-only ligados a fiscal_documents
-- chart_of_accounts: plan de cuentas por tenant

-- ─── Plan de cuentas ─────────────────────────────────────────────────────────

CREATE TABLE chart_of_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,                     -- e.g. '1105', '4135'
  name          TEXT NOT NULL,
  account_type  TEXT NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chart_of_accounts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON chart_of_accounts TO nuvora_app;

-- ─── Asientos contables ───────────────────────────────────────────────────────

CREATE TABLE journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id   UUID REFERENCES fiscal_documents(id),
  entry_date    DATE NOT NULL,
  description   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code  TEXT NOT NULL,
  account_name  TEXT NOT NULL,
  debit         NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (debit > 0 OR credit > 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journal_entries
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- journal_lines inherits tenant isolation via entry_id JOIN — no RLS needed
GRANT SELECT ON journal_lines TO nuvora_app;

-- Append-only: journal entries and lines are immutable once written
CREATE OR REPLACE FUNCTION prevent_journal_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'journal_entries and journal_lines are immutable (append-only)';
END;
$$;

CREATE TRIGGER journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();

CREATE TRIGGER journal_lines_immutable
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();

GRANT SELECT, INSERT ON journal_entries TO nuvora_app;
GRANT INSERT ON journal_lines TO nuvora_app;

-- Indexes
CREATE INDEX ON journal_entries (tenant_id, document_id);
CREATE INDEX ON journal_entries (tenant_id, entry_date);

-- ─── Permissions ──────────────────────────────────────────────────────────────

INSERT INTO permissions (name, description, module) VALUES
  ('accounting.read',  'Ver asientos contables del tenant', 'accounting'),
  ('accounting.write', 'Crear asientos contables (sólo sistema)', 'accounting')
ON CONFLICT (name) DO NOTHING;
