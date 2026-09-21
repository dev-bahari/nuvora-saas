-- 0005_fiscal_documents.sql
-- Nuvora SaaS — Fiscal Documents: Invoice Drafts, Lines, Taxes, AIU

-- -----------------------------------------------
-- 0. Permissions for invoices module
-- -----------------------------------------------
INSERT INTO permissions (name, description, module) VALUES
  ('invoices.read',  'Consultar facturas y borradores', 'invoices'),
  ('invoices.write', 'Crear y editar facturas en borrador', 'invoices')
ON CONFLICT (name) DO NOTHING;

-- invoices.read → OWNER, ADMIN, ACCOUNTANT, BILLING_AGENT, VIEWER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'invoices.read'
  AND r.name IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'BILLING_AGENT', 'VIEWER')
ON CONFLICT DO NOTHING;

-- invoices.write → OWNER, ADMIN, ACCOUNTANT, BILLING_AGENT
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'invoices.write'
  AND r.name IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'BILLING_AGENT')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 1. fiscal_documents
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_type    VARCHAR(20)  NOT NULL DEFAULT 'INVOICE'
                   CONSTRAINT chk_document_type CHECK (document_type IN ('INVOICE','CREDIT_NOTE','DEBIT_NOTE')),
  status           VARCHAR(30)  NOT NULL DEFAULT 'DRAFT'
                   CONSTRAINT chk_document_status CHECK (status IN (
                     'DRAFT','READY','PROCESSING','DIAN_PENDING',
                     'DIAN_ACCEPTED','ISSUED','REJECTED','CANCELLED_BY_CREDIT_NOTE'
                   )),
  -- version for optimistic concurrency; clients must echo it back on PATCH
  version          INTEGER      NOT NULL DEFAULT 1,
  -- customer snapshot (immutable after creation)
  customer_id      UUID         REFERENCES customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB       NOT NULL DEFAULT '{}',
  -- document metadata
  currency         VARCHAR(3)   NOT NULL DEFAULT 'COP',
  issue_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  notes            TEXT,
  -- calculated totals (NUMERIC(20,6) per spec)
  subtotal         NUMERIC(20,6) NOT NULL DEFAULT 0,
  total_tax        NUMERIC(20,6) NOT NULL DEFAULT 0,
  grand_total      NUMERIC(20,6) NOT NULL DEFAULT 0,
  -- timestamps
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fiscal_documents ON fiscal_documents;
CREATE POLICY tenant_isolation_fiscal_documents ON fiscal_documents
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 2. fiscal_document_lines
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_document_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID         NOT NULL REFERENCES fiscal_documents(id) ON DELETE CASCADE,
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  position         INTEGER      NOT NULL DEFAULT 0,
  -- product snapshot (optional; manual lines have no product_id)
  product_id       UUID         REFERENCES products(id) ON DELETE SET NULL,
  -- inputs (stored to reproduce calculations)
  description      TEXT         NOT NULL,
  quantity         NUMERIC(20,6) NOT NULL,
  unit_price       NUMERIC(20,6) NOT NULL,
  discount_pct     NUMERIC(7,4)  NOT NULL DEFAULT 0
                   CONSTRAINT chk_line_discount CHECK (discount_pct >= 0 AND discount_pct <= 100),
  tax_treatment    VARCHAR(20)  NOT NULL DEFAULT 'TAXED'
                   CONSTRAINT chk_line_tax_treatment CHECK (tax_treatment IN ('TAXED','EXEMPT','EXCLUDED','NON_TAXED')),
  tax_rate         NUMERIC(7,4) NOT NULL DEFAULT 0,
  -- calculated results
  gross_amount     NUMERIC(20,6) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(20,6) NOT NULL DEFAULT 0,
  taxable_base     NUMERIC(20,6) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(20,6) NOT NULL DEFAULT 0,
  line_total       NUMERIC(20,6) NOT NULL DEFAULT 0
);

ALTER TABLE fiscal_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_document_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fiscal_document_lines ON fiscal_document_lines;
CREATE POLICY tenant_isolation_fiscal_document_lines ON fiscal_document_lines
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 3. fiscal_document_taxes (aggregated tax summary per document)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_document_taxes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID         NOT NULL REFERENCES fiscal_documents(id) ON DELETE CASCADE,
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tax_treatment    VARCHAR(20)  NOT NULL,
  tax_rate         NUMERIC(7,4) NOT NULL DEFAULT 0,
  taxable_base     NUMERIC(20,6) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(20,6) NOT NULL DEFAULT 0
);

ALTER TABLE fiscal_document_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_document_taxes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fiscal_document_taxes ON fiscal_document_taxes;
CREATE POLICY tenant_isolation_fiscal_document_taxes ON fiscal_document_taxes
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 4. fiscal_document_aiu (AIU data when applicable)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_document_aiu (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID         NOT NULL UNIQUE REFERENCES fiscal_documents(id) ON DELETE CASCADE,
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- inputs
  base                NUMERIC(20,6) NOT NULL,
  administracion_pct  NUMERIC(7,4) NOT NULL DEFAULT 0,
  imprevistos_pct     NUMERIC(7,4) NOT NULL DEFAULT 0,
  utilidad_pct        NUMERIC(7,4) NOT NULL DEFAULT 0,
  iva_on_utilidad_pct NUMERIC(7,4) NOT NULL DEFAULT 0,
  mode                VARCHAR(20)  NOT NULL DEFAULT 'SPECIAL'
                      CONSTRAINT chk_aiu_mode CHECK (mode IN ('SPECIAL','INFORMATIVE','NONE')),
  minimum_base_limit  NUMERIC(20,6),
  -- results
  aiu_amount          NUMERIC(20,6) NOT NULL DEFAULT 0,
  u_amount            NUMERIC(20,6) NOT NULL DEFAULT 0,
  iva_amount          NUMERIC(20,6) NOT NULL DEFAULT 0,
  total               NUMERIC(20,6) NOT NULL DEFAULT 0,
  below_minimum       BOOLEAN      NOT NULL DEFAULT FALSE
);

ALTER TABLE fiscal_document_aiu ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_document_aiu FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fiscal_document_aiu ON fiscal_document_aiu;
CREATE POLICY tenant_isolation_fiscal_document_aiu ON fiscal_document_aiu
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 5. Indexes for common queries
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant_status
  ON fiscal_documents (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_document_lines_document
  ON fiscal_document_lines (document_id, position);

-- -----------------------------------------------
-- 6. Grant new tables to app user
-- -----------------------------------------------
GRANT SELECT, INSERT, UPDATE ON fiscal_documents TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fiscal_document_lines TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fiscal_document_taxes TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON fiscal_document_aiu TO nuvora_app_user;
