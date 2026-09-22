-- T14: DIAN technical key for CUFE computation
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS dian_technical_key TEXT;
