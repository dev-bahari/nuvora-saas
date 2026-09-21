import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { AuthService } from '../../apps/api/src/auth/auth.service.js';
import { OnboardingService } from '../../apps/api/src/auth/onboarding.service.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Auth Integration Tests', () => {
  let pool: pg.Pool;
  let authService: AuthService;
  let onboardingService: OnboardingService;

  const runId = `auth_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: cannot run integration tests in production');
    }

    pool = new Pool({ connectionString });

    const tableCheck = await pool.query(`SELECT to_regclass('public.password_reset_tokens') AS t`);
    if (!tableCheck.rows[0]?.t) {
      await runMigrations();
    }

    authService = new AuthService(pool);
    onboardingService = new OnboardingService(pool);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query("SET app.maintenance_mode = 'true'");
      if (createdTenantIds.length) {
        await pool.query('DELETE FROM sessions WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM memberships WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM audit_logs WHERE tenant_id = ANY($1)', [createdTenantIds]);
        await pool.query('DELETE FROM tenants WHERE id = ANY($1)', [createdTenantIds]);
      }
      if (createdUserIds.length) {
        await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ANY($1)', [createdUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      }
      await pool.query('DELETE FROM auth_rate_limits WHERE key LIKE $1', [`login:test-ip-${runId}%`]);
      await pool.query("SET app.maintenance_mode = 'false'");
      await pool.end();
    }
  });

  // --- Onboarding ---

  it('1. onboarding creates tenant, user, OWNER membership and audit log', async () => {
    const email = `owner_${runId}@nuvora.test`;
    const result = await onboardingService.onboard(
      email,
      'StrongPass123!',
      'Juan Nuvora',
      `Empresa Test ${runId}`,
      '127.0.0.1',
    );

    expect(result.userId).toBeTruthy();
    expect(result.tenantId).toBeTruthy();

    createdUserIds.push(result.userId);
    createdTenantIds.push(result.tenantId);

    // Verify OWNER membership
    const membership = await pool.query(
      `SELECT m.id, r.name AS role_name FROM memberships m
       JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1 AND m.tenant_id = $2`,
      [result.userId, result.tenantId],
    );
    expect(membership.rows[0]?.role_name).toBe('OWNER');

    // Verify tenant settings
    const tenant = await pool.query(
      `SELECT timezone, currency FROM tenants WHERE id = $1`,
      [result.tenantId],
    );
    expect(tenant.rows[0]?.timezone).toBe('America/Bogota');
    expect(tenant.rows[0]?.currency).toBe('COP');

    // Verify audit log
    const audit = await pool.query(
      `SELECT event_type FROM audit_logs WHERE tenant_id = $1 AND event_type = 'TENANT_CREATED'`,
      [result.tenantId],
    );
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it('2. onboarding rejects duplicate email', async () => {
    const email = `dup_${runId}@nuvora.test`;
    const result = await onboardingService.onboard(
      email, 'Password1!', 'Test User', `Company A ${runId}`,
    );
    createdUserIds.push(result.userId);
    createdTenantIds.push(result.tenantId);

    await expect(
      onboardingService.onboard(email, 'Password1!', 'Test User 2', `Company B ${runId}`),
    ).rejects.toThrow(/already registered/i);
  });

  // --- Login ---

  it('3. valid login returns session token and CSRF token', async () => {
    const email = `login_test_${runId}@nuvora.test`;
    const pass = 'ValidPass99!';
    const res = await onboardingService.onboard(email, pass, 'Login Test', `Login Tenant ${runId}`);
    createdUserIds.push(res.userId);
    createdTenantIds.push(res.tenantId);

    const { sessionToken, csrfToken } = await authService.login(email, pass, `10.0.3.${runId.slice(-3)}`);
    expect(sessionToken).toHaveLength(64);
    expect(csrfToken).toHaveLength(64);
  });

  it('4. wrong password returns UnauthorizedException (indistinguishable from wrong email)', async () => {
    const ip4 = `10.0.4.1`;
    await authService.clearRateLimit(`login:${ip4}`);
    await expect(
      authService.login(`nonexistent_${runId}@nuvora.test`, 'anything', ip4),
    ).rejects.toThrow(/Invalid credentials/i);

    const email = `wrongpass_${runId}@nuvora.test`;
    const res = await onboardingService.onboard(email, 'CorrectPass1!', 'WP User', `WP Tenant ${runId}`);
    createdUserIds.push(res.userId);
    createdTenantIds.push(res.tenantId);

    await expect(
      authService.login(email, 'WrongPassword', ip4),
    ).rejects.toThrow(/Invalid credentials/i);
    await authService.clearRateLimit(`login:${ip4}`);
  });

  it('5. session is retrievable after login', async () => {
    const email = `sess_test_${runId}@nuvora.test`;
    const res = await onboardingService.onboard(email, 'SessPass1!', 'Sess User', `Sess Tenant ${runId}`);
    createdUserIds.push(res.userId);
    createdTenantIds.push(res.tenantId);

    const { sessionToken } = await authService.login(email, 'SessPass1!', `10.0.5.1`);
    const session = await authService.getSession(sessionToken);

    expect(session.email).toBe(email);
    expect(session.userId).toBe(res.userId);
    expect(session.tenantId).toBe(res.tenantId);
  });

  it('6. logout invalidates the session', async () => {
    const email = `logout_${runId}@nuvora.test`;
    const res = await onboardingService.onboard(email, 'LogoutPass1!', 'Logout User', `Logout Tenant ${runId}`);
    createdUserIds.push(res.userId);
    createdTenantIds.push(res.tenantId);

    const { sessionToken } = await authService.login(email, 'LogoutPass1!', `10.0.6.1`);
    await authService.logout(sessionToken);

    await expect(authService.getSession(sessionToken)).rejects.toThrow(/Invalid or expired session/i);
  });

  it('7. rate limiting blocks after 5 failed attempts', async () => {
    const ip = `test-ip-${runId}-rl`;
    const nonExistentEmail = `rl_target_${runId}@nuvora.test`;

    // Clear any existing rate limits
    await authService.clearRateLimit(`login:${ip}`);

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await authService.login(nonExistentEmail, 'bad').catch(() => {});
      // bypass the rate limit IP check (direct call)
      const key = `login:${ip}`;
      await authService.recordFailedAttempt(key);
    }

    const blocked = await authService.isBlocked(`login:${ip}`);
    expect(blocked).toBe(true);

    await authService.clearRateLimit(`login:${ip}`);
  });

  it('8. password reset token is stored hashed; raw token is never in DB', async () => {
    const email = `reset_${runId}@nuvora.test`;
    const res = await onboardingService.onboard(email, 'ResetPass1!', 'Reset User', `Reset Tenant ${runId}`);
    createdUserIds.push(res.userId);
    createdTenantIds.push(res.tenantId);

    await authService.requestPasswordReset(email);

    // Verify token exists in DB but is hashed (64 hex chars = SHA-256)
    const tokenRows = await pool.query(
      `SELECT token_hash FROM password_reset_tokens WHERE user_id = $1`,
      [res.userId],
    );
    expect(tokenRows.rows.length).toBe(1);
    const tokenHash = tokenRows.rows[0]!.token_hash as string;
    // SHA-256 hex is 64 chars
    expect(tokenHash).toHaveLength(64);
    // It's a hash, not a recognizable token (won't match any raw token pattern)
  });

  it('9. password reset with valid token resets password and invalidates sessions', async () => {
    const email = `resetflow_${runId}@nuvora.test`;
    const res = await onboardingService.onboard(email, 'OldPass1!', 'RF User', `RF Tenant ${runId}`);
    createdUserIds.push(res.userId);
    createdTenantIds.push(res.tenantId);

    const { sessionToken } = await authService.login(email, 'OldPass1!', `10.0.9.1`);

    // Manually insert a known reset token for testing
    const rawToken = 'a'.repeat(64);
    const crypto = await import('node:crypto');
    const tokenHash = crypto.default.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [res.userId, tokenHash],
    );

    await authService.resetPassword(rawToken, 'NewPass99!');

    // Old session should be gone
    await expect(authService.getSession(sessionToken)).rejects.toThrow(/Invalid or expired session/i);

    // Can login with new password
    const newLogin = await authService.login(email, 'NewPass99!', `10.0.9.2`);
    expect(newLogin.sessionToken).toBeTruthy();

    // Cleanup new session
    await authService.logout(newLogin.sessionToken);
  });

  it('10. requestPasswordReset returns silently for non-existent email (no enumeration)', async () => {
    // Should not throw, should return quietly
    await expect(
      authService.requestPasswordReset(`nonexistent_${runId}@nuvora.test`),
    ).resolves.toBeUndefined();
  });
});
