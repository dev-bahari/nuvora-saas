-- 0003_auth.sql
-- Nuvora SaaS — Auth: session metadata, password reset tokens, rate limiting

-- Extend sessions table with metadata columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS csrf_token_hash VARCHAR(64);

-- Password reset tokens (single-use, expire in 1 hour)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limit buckets keyed by IP or email
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key VARCHAR(255) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
);

-- Grant DELETE on sessions to allow logout via nuvora_app_user
GRANT DELETE ON sessions TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO nuvora_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_rate_limits TO nuvora_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nuvora_app_user;
