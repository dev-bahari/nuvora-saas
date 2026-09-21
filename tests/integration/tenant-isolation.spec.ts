import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import pg from 'pg';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { PermissionGuard } from '../../apps/api/src/tenancy/permission.guard.js';
import { PermissionsService } from '../../apps/api/src/tenancy/permissions.service.js';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

// Safe test database connection: defaults to nuvora_test to prevent wiping development data
const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Tenant Isolation & PostgreSQL RLS Integration Tests (Ruling B1)', () => {
  let pool: pg.Pool;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let membershipAId: string;
  let _membershipBId: string;

  let ctxTenantA: RequestContext;
  let ctxTenantB: RequestContext;

  beforeAll(async () => {
    // Safety guard against running integration tests against production
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot be run against a production environment.');
    }

    pool = new Pool({ connectionString });

    // Ensure migrations have been applied if running against a clean database
    const tableCheck = await pool.query(
      `SELECT to_regclass('public.tenants') as table_exists;`,
    );
    if (!tableCheck.rows[0]?.table_exists) {
      await runMigrations();
    }

    const runId = Date.now().toString();

    // 1. Seed test tenants
    const tA = await pool.query(
      `INSERT INTO tenants (name, tax_id) VALUES ($1, $2) RETURNING id`,
      [`Empresa Alfa ${runId} SAS`, `900-${runId}-1`],
    );
    tenantAId = tA.rows[0].id;

    const tB = await pool.query(
      `INSERT INTO tenants (name, tax_id) VALUES ($1, $2) RETURNING id`,
      [`Empresa Beta ${runId} SAS`, `900-${runId}-2`],
    );
    tenantBId = tB.rows[0].id;

    // 2. Seed test users
    const uA = await pool.query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'hash_a', 'Admin Alfa') RETURNING id`,
      [`admin_alfa_${runId}@nuvora.test`],
    );
    userAId = uA.rows[0].id;

    const uB = await pool.query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'hash_b', 'Admin Beta') RETURNING id`,
      [`admin_beta_${runId}@nuvora.test`],
    );
    userBId = uB.rows[0].id;

    // 3. Seed active memberships with roles
    const billingAgentRole = await pool.query(`SELECT id FROM roles WHERE name = 'BILLING_AGENT'`);
    const viewerRole = await pool.query(`SELECT id FROM roles WHERE name = 'VIEWER'`);

    const mA = await pool.query(
      `INSERT INTO memberships (tenant_id, user_id, role_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
      [tenantAId, userAId, billingAgentRole.rows[0].id],
    );
    membershipAId = mA.rows[0].id;

    const mB = await pool.query(
      `INSERT INTO memberships (tenant_id, user_id, role_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
      [tenantBId, userBId, viewerRole.rows[0].id],
    );
    _membershipBId = mB.rows[0].id;

    // 4. Seed active session for Tenant A
    await pool.query(
      `INSERT INTO sessions (user_id, tenant_id, session_token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [userAId, tenantAId, `token_hash_${runId}`],
    );

    ctxTenantA = {
      tenantId: tenantAId,
      userId: userAId,
      permissions: ['invoices.read', 'invoices.create', 'audit.read'],
      requestId: 'req-test-alfa',
    };

    ctxTenantB = {
      tenantId: tenantBId,
      userId: userBId,
      permissions: ['invoices.read', 'audit.read'],
      requestId: 'req-test-beta',
    };
  });

  afterAll(async () => {
    if (pool) {
      // Safe cleanup scoped strictly to the generated test IDs (never TRUNCATE entire tables)
      if (tenantAId || tenantBId) {
        await pool.query("SET app.maintenance_mode = 'true'");
        await pool.query('DELETE FROM tenancy_isolation_probe WHERE tenant_id IN ($1, $2)', [tenantAId, tenantBId]);
        await pool.query('DELETE FROM audit_logs WHERE tenant_id IN ($1, $2)', [tenantAId, tenantBId]);
        await pool.query('DELETE FROM membership_permissions WHERE tenant_id IN ($1, $2)', [tenantAId, tenantBId]);
        await pool.query('DELETE FROM sessions WHERE tenant_id IN ($1, $2)', [tenantAId, tenantBId]);
        await pool.query('DELETE FROM memberships WHERE tenant_id IN ($1, $2)', [tenantAId, tenantBId]);
        await pool.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
        await pool.query("SET app.maintenance_mode = 'false'");
      }
      if (userAId || userBId) {
        await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
      }
      await pool.end();
    }
  });

  it('1. withTenant sets transaction-local context and isolates data by tenant (Ruling B1)', async () => {
    const probeA = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(
        `INSERT INTO tenancy_isolation_probe (tenant_id, payload) VALUES ($1, $2) RETURNING id, tenant_id, payload`,
        [ctxTenantA.tenantId, 'alpha_payload'],
      );
      return res.rows[0];
    });

    expect(probeA.tenant_id).toBe(tenantAId);
    expect(probeA.payload).toBe('alpha_payload');

    const probeB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(
        `INSERT INTO tenancy_isolation_probe (tenant_id, payload) VALUES ($1, $2) RETURNING id, tenant_id, payload`,
        [ctxTenantB.tenantId, 'beta_payload'],
      );
      return res.rows[0];
    });

    expect(probeB.tenant_id).toBe(tenantBId);
    expect(probeB.payload).toBe('beta_payload');

    const probesSeenByA = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(`SELECT * FROM tenancy_isolation_probe`);
      return res.rows;
    });

    expect(probesSeenByA.length).toBe(1);
    expect(probesSeenByA[0].id).toBe(probeA.id);

    const probesSeenByB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(`SELECT * FROM tenancy_isolation_probe`);
      return res.rows;
    });

    expect(probesSeenByB.length).toBe(1);
    expect(probesSeenByB[0].id).toBe(probeB.id);
  });

  it('2. querying an existing ID belonging to another tenant returns zero rows (zero data leakage)', async () => {
    const probeB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(`SELECT id FROM tenancy_isolation_probe LIMIT 1`);
      return res.rows[0];
    });

    const leakAttempt = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(
        `SELECT * FROM tenancy_isolation_probe WHERE id = $1`,
        [probeB.id],
      );
      return res.rows;
    });

    expect(leakAttempt.length).toBe(0);
  });

  it('3. attempting to insert a row with another tenant_id is blocked by PostgreSQL RLS WITH CHECK policy', async () => {
    await expect(
      withTenant(pool, ctxTenantA, async (tx) => {
        await tx.query(
          `INSERT INTO tenancy_isolation_probe (tenant_id, payload) VALUES ($1, 'cross_tenant_injection')`,
          [tenantBId],
        );
      }),
    ).rejects.toThrow(/violates row-level security policy/i);
  });

  it('4. querying tenant-scoped tables without app.tenant_id setting returns zero rows', async () => {
    const rawClient = await pool.connect();
    try {
      await rawClient.query('SET ROLE nuvora_app_user');
      const res = await rawClient.query(`SELECT * FROM tenancy_isolation_probe`);
      expect(res.rows.length).toBe(0);
    } finally {
      await rawClient.query('RESET ROLE');
      rawClient.release();
    }
  });

  it('5. audit_logs enforces append-only immutability via database trigger (prohibits UPDATE/DELETE)', async () => {
    const logEntry = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, entity_type, entity_id)
         VALUES ($1, $2, 'INVOICE_CREATED', 'invoice', 'inv-001')
         RETURNING id`,
        [tenantAId, userAId],
      );
      return res.rows[0];
    });

    await expect(
      withTenant(pool, ctxTenantA, async (tx) => {
        await tx.query(
          `UPDATE audit_logs SET event_type = 'TAMPERED' WHERE id = $1`,
          [logEntry.id],
        );
      }),
    ).rejects.toThrow(/audit_logs are immutable and append-only|permission denied for table audit_logs/i);

    await expect(
      withTenant(pool, ctxTenantA, async (tx) => {
        await tx.query(`DELETE FROM audit_logs WHERE id = $1`, [logEntry.id]);
      }),
    ).rejects.toThrow(/audit_logs are immutable and append-only|permission denied for table audit_logs/i);

  });

  it('6. membership_permissions and tenants tables enforce Row Level Security', async () => {
    const permRes = await pool.query(`SELECT id FROM permissions WHERE name = 'dian.configure'`);
    const permId = permRes.rows[0].id;

    // Insert custom membership permission for Tenant A under withTenant
    await withTenant(pool, ctxTenantA, async (tx) => {
      await tx.query(
        `INSERT INTO membership_permissions (membership_id, permission_id, tenant_id, granted)
         VALUES ($1, $2, $3, TRUE)`,
        [membershipAId, permId, tenantAId],
      );
    });

    // Tenant A sees its custom override
    const permsA = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(`SELECT * FROM membership_permissions`);
      return res.rows;
    });
    expect(permsA.length).toBe(1);

    // Tenant B cannot see Tenant A's membership permissions
    const permsB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(`SELECT * FROM membership_permissions`);
      return res.rows;
    });
    expect(permsB.length).toBe(0);

    // Tenants table isolation: Tenant A can only query its own tenant record
    const tenantsSeenByA = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(`SELECT id FROM tenants`);
      return res.rows;
    });
    expect(tenantsSeenByA.length).toBe(1);
    expect(tenantsSeenByA[0].id).toBe(tenantAId);
  });

  it('7. PermissionGuard computes live effective permissions from active database membership', async () => {
    const reflector = new Reflector();
    const permissionsService = new PermissionsService(pool);
    const guard = new PermissionGuard(reflector, permissionsService);

    const mockExecutionContext = (reqCtx: RequestContext): ExecutionContext => {
      return {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: () => ({ context: reqCtx }),
          getResponse: () => ({}),
          getNext: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    // Require 'invoices.create'
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('invoices.create');

    // Tenant A user has BILLING_AGENT role -> includes 'invoices.create' -> returns true
    const executionCtxA = mockExecutionContext(ctxTenantA);
    const canA = await guard.canActivate(executionCtxA);
    expect(canA).toBe(true);

    // Tenant B user has VIEWER role -> does NOT include 'invoices.create' -> throws ForbiddenException
    const executionCtxB = mockExecutionContext(ctxTenantB);
    await expect(guard.canActivate(executionCtxB)).rejects.toThrow(
      /Missing required permission: invoices.create/,
    );
  });
});
