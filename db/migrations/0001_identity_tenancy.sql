-- 0001_identity_tenancy.sql
-- Nuvora SaaS — Base Schema: Identity, Tenancy, Permissions, Sessions & Audit Logs

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants (Companies)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  module VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 6. Memberships (User in Tenant with a Role)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_memberships_tenant_user UNIQUE (tenant_id, user_id)
);

-- 7. Membership Permissions (Explicit overrides per user membership)
CREATE TABLE IF NOT EXISTS membership_permissions (
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (membership_id, permission_id)
);

-- 8. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Audit Logs (Immutable append-only ledger)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: Prohibit UPDATE and DELETE on audit_logs (permits scoped test maintenance when explicitly flagged)
CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.maintenance_mode', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs are immutable and append-only: % operation prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_logs_mutation();

-- ----------------------------------------------------
-- SEED DATA: Roles and Explicit Permissions
-- ----------------------------------------------------

INSERT INTO roles (name, description, is_system) VALUES
  ('OWNER', 'Propietario del tenant con control total', TRUE),
  ('ADMIN', 'Administrador de operaciones del tenant', TRUE),
  ('ACCOUNTANT', 'Contador con acceso a libros contables y reportes', TRUE),
  ('BILLING_AGENT', 'Operador de facturación y emisión de documentos', TRUE),
  ('VIEWER', 'Visualizador de solo lectura', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, module) VALUES
  ('customers.read', 'Consultar clientes', 'customers'),
  ('customers.write', 'Crear y editar clientes', 'customers'),
  ('products.read', 'Consultar productos y servicios', 'products'),
  ('products.write', 'Crear y editar productos y servicios', 'products'),
  ('invoices.read', 'Consultar facturas', 'invoices'),
  ('invoices.create', 'Crear y editar borradores de facturas', 'invoices'),
  ('invoices.issue', 'Emitir facturas electrónicas', 'invoices'),
  ('credit_notes.create', 'Crear notas crédito', 'credit_notes'),
  ('credit_notes.issue', 'Emitir notas crédito', 'credit_notes'),
  ('debit_notes.create', 'Crear notas débito', 'debit_notes'),
  ('debit_notes.issue', 'Emitir notas débito', 'debit_notes'),
  ('dian.configure', 'Configurar parámetros y certificados DIAN', 'dian'),
  ('accounting.read', 'Consultar libros y asientos contables', 'accounting'),
  ('accounting.write', 'Gestionar reglas y periodos contables', 'accounting'),
  ('users.manage', 'Gestionar usuarios y membresías', 'users'),
  ('tenant.settings', 'Configurar perfil y ajustes de empresa', 'settings'),
  ('audit.read', 'Consultar registros de auditoría', 'audit')
ON CONFLICT (name) DO NOTHING;

-- Map OWNER permissions (all 17)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'OWNER'
ON CONFLICT DO NOTHING;

-- Map ADMIN permissions (all 17)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Map ACCOUNTANT permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ACCOUNTANT' AND p.name IN (
  'customers.read', 'products.read', 'invoices.read',
  'credit_notes.create', 'debit_notes.create',
  'accounting.read', 'accounting.write', 'audit.read'
)
ON CONFLICT DO NOTHING;

-- Map BILLING_AGENT permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'BILLING_AGENT' AND p.name IN (
  'customers.read', 'customers.write', 'products.read', 'products.write',
  'invoices.read', 'invoices.create', 'invoices.issue',
  'credit_notes.create', 'credit_notes.issue',
  'debit_notes.create', 'debit_notes.issue'
)
ON CONFLICT DO NOTHING;

-- Map VIEWER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'VIEWER' AND p.name IN (
  'customers.read', 'products.read', 'invoices.read',
  'accounting.read', 'audit.read'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------
-- 10. Effective Permissions Resolver Function
-- Computes effective permissions for an active tenant membership
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION get_effective_permissions(p_tenant_id UUID, p_user_id UUID)
RETURNS TABLE (permission_name VARCHAR(100)) AS $$
BEGIN
  RETURN QUERY
  WITH active_membership AS (
    SELECT m.id AS membership_id, m.role_id
    FROM memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = p_user_id
      AND m.status = 'ACTIVE'
  ),
  role_perms AS (
    SELECT p.name AS permission_name
    FROM active_membership am
    JOIN role_permissions rp ON rp.role_id = am.role_id
    JOIN permissions p ON p.id = rp.permission_id
  ),
  custom_grants AS (
    SELECT p.name AS permission_name
    FROM active_membership am
    JOIN membership_permissions mp ON mp.membership_id = am.membership_id
    JOIN permissions p ON p.id = mp.permission_id
    WHERE mp.granted = TRUE
  ),
  custom_revocations AS (
    SELECT p.name AS permission_name
    FROM active_membership am
    JOIN membership_permissions mp ON mp.membership_id = am.membership_id
    JOIN permissions p ON p.id = mp.permission_id
    WHERE mp.granted = FALSE
  )
  (
    SELECT rp.permission_name FROM role_perms rp
    UNION
    SELECT cg.permission_name FROM custom_grants cg
  )
  EXCEPT
  SELECT cr.permission_name FROM custom_revocations cr;
END;
$$ LANGUAGE plpgsql STABLE;
