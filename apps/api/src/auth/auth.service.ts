import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';

const { Pool } = pg;

// ponytail: in-memory rate limit cache, replaced by DB-only if multi-instance matters
const rateLimitCache = new Map<string, { attempts: number; blockedUntil?: number | undefined }>();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SessionInfo {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  tenantName: string;
}

@Injectable()
export class AuthService {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ??
        'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev',
    });
  }

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // --- Rate limiting ---

  async isBlocked(key: string): Promise<boolean> {
    const cached = rateLimitCache.get(key);
    if (cached?.blockedUntil && Date.now() < cached.blockedUntil) {
      return true;
    }
    // check DB as source of truth
    const res = await this.pool.query<{ blocked_until: Date | null; attempts: number }>(
      `SELECT blocked_until, attempts FROM auth_rate_limits WHERE key = $1`,
      [key],
    );
    if (!res.rows[0]) return false;
    const { blocked_until } = res.rows[0];
    if (blocked_until && new Date(blocked_until) > new Date()) {
      rateLimitCache.set(key, { attempts: res.rows[0].attempts, blockedUntil: new Date(blocked_until).getTime() });
      return true;
    }
    return false;
  }

  async recordFailedAttempt(key: string): Promise<void> {
    const now = new Date();
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    const res = await this.pool.query<{ attempts: number; window_start: Date }>(
      `INSERT INTO auth_rate_limits (key, attempts, window_start)
       VALUES ($1, 1, NOW())
       ON CONFLICT (key) DO UPDATE
         SET attempts = CASE
               WHEN auth_rate_limits.window_start < $2 THEN 1
               ELSE auth_rate_limits.attempts + 1
             END,
             window_start = CASE
               WHEN auth_rate_limits.window_start < $2 THEN NOW()
               ELSE auth_rate_limits.window_start
             END,
             blocked_until = CASE
               WHEN (CASE WHEN auth_rate_limits.window_start < $2 THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= $3
               THEN NOW() + INTERVAL '15 minutes'
               ELSE NULL
             END
       RETURNING attempts, window_start`,
      [key, windowStart, RATE_LIMIT_MAX],
    );

    const attempts = res.rows[0]?.attempts ?? 1;
    const blockedUntil = attempts >= RATE_LIMIT_MAX ? Date.now() + RATE_LIMIT_WINDOW_MS : undefined;
    rateLimitCache.set(key, { attempts, blockedUntil });
    void now; // suppress unused warning
  }

  async clearRateLimit(key: string): Promise<void> {
    rateLimitCache.delete(key);
    await this.pool.query(`DELETE FROM auth_rate_limits WHERE key = $1`, [key]);
  }

  // --- Login ---

  async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ sessionToken: string; csrfToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const ipKey = `login:${ip ?? 'unknown'}`;
    const emailKey = `login:email:${normalizedEmail}`;

    if (await this.isBlocked(ipKey) || await this.isBlocked(emailKey)) {
      throw new UnauthorizedException('Too many attempts. Try again later.');
    }

    // Constant-time lookup to avoid user enumeration via timing
    const userRes = await this.pool.query<{
      id: string;
      password_hash: string;
      status: string;
    }>(
      `SELECT u.id, u.password_hash, u.status
       FROM users u
       WHERE u.email = $1`,
      [normalizedEmail],
    );

    const user = userRes.rows[0];
    let passwordValid = false;

    if (user) {
      try {
        passwordValid = await argon2.verify(user.password_hash, password);
      } catch {
        passwordValid = false;
      }
    } else {
      // Dummy verify to equalize timing — prevents user enumeration
      await argon2.verify(
        '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        password,
      ).catch(() => {});
    }

    if (!user || !passwordValid || user.status !== 'ACTIVE') {
      await Promise.all([
        this.recordFailedAttempt(ipKey),
        this.recordFailedAttempt(emailKey),
      ]);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get the active membership (first one; multi-tenant switching handled in future task)
    const membershipRes = await this.pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM memberships WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [user.id],
    );

    if (!membershipRes.rows[0]) {
      throw new UnauthorizedException('No active tenant membership');
    }

    const tenantId = membershipRes.rows[0].tenant_id;

    const sessionToken = this.generateToken();
    const sessionTokenHash = this.sha256(sessionToken);
    const csrfToken = this.generateToken();
    const csrfTokenHash = this.sha256(csrfToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.pool.query(
      `INSERT INTO sessions (user_id, tenant_id, session_token_hash, expires_at, ip_address, user_agent, csrf_token_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, tenantId, sessionTokenHash, expiresAt, ip ?? null, userAgent ?? null, csrfTokenHash],
    );

    await Promise.all([
      this.clearRateLimit(ipKey),
      this.clearRateLimit(emailKey),
    ]);

    return { sessionToken, csrfToken };
  }

  // --- Session lookup ---

  async getSession(rawToken: string): Promise<SessionInfo> {
    const tokenHash = this.sha256(rawToken);

    const res = await this.pool.query<{
      user_id: string;
      tenant_id: string;
      email: string;
      full_name: string;
      tenant_name: string;
      expires_at: Date;
    }>(
      `SELECT s.user_id, s.tenant_id, u.email, u.full_name, t.name AS tenant_name, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.session_token_hash = $1`,
      [tokenHash],
    );

    const session = res.rows[0];

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (new Date(session.expires_at) < new Date()) {
      await this.pool.query(`DELETE FROM sessions WHERE session_token_hash = $1`, [tokenHash]);
      throw new UnauthorizedException('Session expired');
    }

    // Touch last_active_at
    await this.pool.query(
      `UPDATE sessions SET last_active_at = NOW() WHERE session_token_hash = $1`,
      [tokenHash],
    );

    return {
      userId: session.user_id,
      tenantId: session.tenant_id,
      email: session.email,
      fullName: session.full_name,
      tenantName: session.tenant_name,
    };
  }

  async validateCsrf(rawToken: string, csrfTokenHeader: string): Promise<void> {
    const sessionTokenHash = this.sha256(rawToken);
    const csrfHash = this.sha256(csrfTokenHeader);

    const res = await this.pool.query<{ csrf_token_hash: string }>(
      `SELECT csrf_token_hash FROM sessions WHERE session_token_hash = $1`,
      [sessionTokenHash],
    );

    if (!res.rows[0] || res.rows[0].csrf_token_hash !== csrfHash) {
      throw new UnauthorizedException('CSRF validation failed');
    }
  }

  // --- Logout ---

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.sha256(rawToken);
    await this.pool.query(`DELETE FROM sessions WHERE session_token_hash = $1`, [tokenHash]);
  }

  // --- Password reset ---

  async requestPasswordReset(email: string): Promise<void> {
    // Always return 200 to prevent enumeration
    const userRes = await this.pool.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (!userRes.rows[0]) return; // silent — no enumeration

    const rawToken = this.generateToken();
    const tokenHash = this.sha256(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // Invalidate any existing tokens for this user
    await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userRes.rows[0].id],
    );

    await this.pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userRes.rows[0].id, tokenHash, expiresAt],
    );

    // NOTE: email delivery is out of scope for Task 3 (Task 12)
    // rawToken would be sent via email; it is NOT returned in the response
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.sha256(rawToken);

    const res = await this.pool.query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash],
    );

    const record = res.rows[0];

    if (!record || record.used_at !== null || new Date(record.expires_at) < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, record.user_id]);
      await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [record.id]);
      // Invalidate all sessions for this user
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [record.user_id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => {});
  }
}
