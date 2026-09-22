-- T10: Notas crédito, anulación y notas débito
-- ─────────────────────────────────────────────

-- Extend fiscal_documents for adjustment documents
ALTER TABLE fiscal_documents
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES fiscal_documents(id),
  ADD COLUMN IF NOT EXISTS cude               TEXT,
  ADD COLUMN IF NOT EXISTS reason_code        TEXT;

-- Validate: CREDIT_NOTE and DEBIT_NOTE must reference a source document
ALTER TABLE fiscal_documents
  ADD CONSTRAINT chk_adjustment_source
    CHECK (
      document_type = 'INVOICE'
      OR (document_type IN ('CREDIT_NOTE','DEBIT_NOTE') AND source_document_id IS NOT NULL)
    );

-- Index for quick lookup of all adjustments referencing an invoice
CREATE INDEX idx_fiscal_docs_source ON fiscal_documents (source_document_id)
  WHERE source_document_id IS NOT NULL;

-- Permissions for credit/debit notes
INSERT INTO permissions (name, description) VALUES
  ('credit_notes.create', 'Create credit notes'),
  ('credit_notes.issue',  'Issue credit notes'),
  ('debit_notes.create',  'Create debit notes'),
  ('debit_notes.issue',   'Issue debit notes')
ON CONFLICT (name) DO NOTHING;

-- Seed role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name IN ('credit_notes.create','credit_notes.issue','debit_notes.create','debit_notes.issue')
  AND r.name IN ('OWNER','ADMIN','ACCOUNTANT')
ON CONFLICT DO NOTHING;
