-- 0004_master_data.sql
-- Nuvora SaaS — Master Data: Taxes, Customers, Products

-- -----------------------------------------------
-- 0. Add taxes.read permission (not in 0001)
-- -----------------------------------------------
INSERT INTO permissions (name, description, module) VALUES
  ('taxes.read', 'Consultar catálogo de impuestos', 'taxes')
ON CONFLICT (name) DO NOTHING;

-- Grant taxes.read to OWNER, ADMIN, ACCOUNTANT, BILLING_AGENT, VIEWER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE p.name = 'taxes.read' AND r.name IN ('OWNER','ADMIN','ACCOUNTANT','BILLING_AGENT','VIEWER')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 1. Taxes catalog (per-tenant)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS taxes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            VARCHAR(50) NOT NULL,
  tax_type        VARCHAR(50) NOT NULL,
  rate            NUMERIC(5,4) NOT NULL DEFAULT 0,
  treatment       VARCHAR(20) NOT NULL,
  label           VARCHAR(100) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_taxes ON taxes;
CREATE POLICY tenant_isolation_taxes ON taxes
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 2. Customers
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type                    VARCHAR(20) NOT NULL DEFAULT 'LEGAL_ENTITY',
  identification_type     VARCHAR(10) NOT NULL,
  identification          VARCHAR(50) NOT NULL,
  dv                      VARCHAR(2),
  legal_name              VARCHAR(255) NOT NULL,
  first_name              VARCHAR(100),
  last_name               VARCHAR(100),
  fiscal_responsibilities TEXT[] NOT NULL DEFAULT '{}',
  email_primary           VARCHAR(255) NOT NULL,
  phone                   VARCHAR(30),
  whatsapp                VARCHAR(30),
  address                 TEXT,
  municipality            VARCHAR(100),
  department              VARCHAR(100),
  country                 VARCHAR(3) NOT NULL DEFAULT 'CO',
  contact_name            VARCHAR(255),
  internal_notes          TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_identification UNIQUE (tenant_id, identification_type, identification)
);

CREATE TABLE IF NOT EXISTS customer_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, email)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE customer_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_emails FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_customer_emails ON customer_emails;
CREATE POLICY tenant_isolation_customer_emails ON customer_emails
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 3. Products
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  internal_code       VARCHAR(100) NOT NULL,
  standard_code       VARCHAR(100),
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  type                VARCHAR(20) NOT NULL DEFAULT 'PRODUCT',
  unit_of_measure     VARCHAR(30) NOT NULL DEFAULT 'UNIT',
  base_price          NUMERIC(20,6) NOT NULL DEFAULT 0,
  default_tax_id      UUID REFERENCES taxes(id) ON DELETE SET NULL,
  tax_treatment       VARCHAR(20) NOT NULL DEFAULT 'TAXED',
  income_account_code VARCHAR(50),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, internal_code)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- -----------------------------------------------
-- 4. Grant new tables to app user
-- -----------------------------------------------
GRANT SELECT, INSERT, UPDATE ON taxes TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE ON customers TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE ON customer_emails TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE ON products TO nuvora_app_user;
