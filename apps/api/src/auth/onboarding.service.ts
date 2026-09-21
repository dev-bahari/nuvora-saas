import { Injectable, ConflictException } from '@nestjs/common';
import argon2 from 'argon2';
import pg from 'pg';

const { Pool } = pg;

export interface OnboardingResult {
  userId: string;
  tenantId: string;
}

@Injectable()
export class OnboardingService {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool ?? new Pool({
      connectionString:
        process.env['DATABASE_URL'] ??
        'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev',
    });
  }

  async onboard(
    email: string,
    password: string,
    fullName: string,
    tenantName: string,
    ip?: string,
  ): Promise<OnboardingResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email before starting the transaction
    const existing = await this.pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [normalizedEmail],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create tenant
      const tenantRes = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, timezone, currency) VALUES ($1, 'America/Bogota', 'COP') RETURNING id`,
        [tenantName],
      );
      const tenantId = tenantRes.rows[0]!.id;

      // 2. Create user
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
        [normalizedEmail, passwordHash, fullName],
      );
      const userId = userRes.rows[0]!.id;

      // 3. Create OWNER membership
      const ownerRoleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'OWNER'`,
      );
      const ownerRoleId = ownerRoleRes.rows[0]!.id;

      await client.query(
        `INSERT INTO memberships (tenant_id, user_id, role_id, status) VALUES ($1, $2, $3, 'ACTIVE')`,
        [tenantId, userId, ownerRoleId],
      );

      // 4. Audit log (bypass RLS via superuser connection)
      await client.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, entity_type, entity_id, ip_address, metadata)
         VALUES ($1, $2, 'TENANT_CREATED', 'tenant', $3, $4, $5)`,
        [tenantId, userId, tenantId, ip ?? null, JSON.stringify({ tenantName, email: normalizedEmail })],
      );

      await client.query('COMMIT');

      return { userId, tenantId };
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
