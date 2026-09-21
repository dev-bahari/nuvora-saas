-- colombia.sql
-- Reusable seed: Colombia default tax catalog per tenant.
-- Call: SELECT seed_colombia_taxes('<tenant_uuid>');

CREATE OR REPLACE FUNCTION seed_colombia_taxes(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO taxes (tenant_id, code, tax_type, rate, treatment, label) VALUES
    (p_tenant_id, 'IVA_19',    'IVA', 0.1900, 'TAXED',     'IVA 19%'),
    (p_tenant_id, 'IVA_5',     'IVA', 0.0500, 'TAXED',     'IVA 5%'),
    (p_tenant_id, 'IVA_0_EX',  'IVA', 0.0000, 'EXEMPT',    'IVA 0% Exento'),
    (p_tenant_id, 'EXCLUDED',  'IVA', 0.0000, 'EXCLUDED',  'Excluido de IVA'),
    (p_tenant_id, 'NON_TAXED', 'IVA', 0.0000, 'NON_TAXED', 'No gravado / No sujeto')
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;
