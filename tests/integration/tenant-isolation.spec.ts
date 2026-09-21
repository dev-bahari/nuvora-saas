import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { PermissionGuard } from '../../apps/api/src/tenancy/permission.guard.js';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

const { Pool } = pg;

const connectionString =
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev';

describe('Tenant Isolation & PostgreSQL RLS Integration Tests (Ruling B1)', () => {
  let pool: pg.Pool;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;

  let ctxTenantA: RequestContext;
  let ctxTenantB: RequestContext;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    const runId = Date.now().toString();

    // Seed test tenants and users for isolation testing
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
      // Clean up test probes and audit logs safely
      await pool.query(
        'TRUNCATE tenancy_isolation_probe, audit_logs, memberships, sessions CASCADE',
      );
      if (tenantAId || tenantBId) {
        await pool.query('DELETE FROM tenants WHERE id IN ($1, $2)', [
          tenantAId,
          tenantBId,
        ]);
      }
      if (userAId || userBId) {
        await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [
          userAId,
          userBId,
        ]);
      }
      await pool.end();
    }
  });

  it('1. withTenant sets transaction-local context and isolates data by tenant (Ruling B1)', async () => {
    // Under Tenant A, insert probe A
    const probeA = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(
        `INSERT INTO tenancy_isolation_probe (tenant_id, payload) VALUES ($1, $2) RETURNING id, tenant_id, payload`,
        [ctxTenantA.tenantId, 'alpha_payload'],
      );
      return res.rows[0];
    });

    expect(probeA.tenant_id).toBe(tenantAId);
    expect(probeA.payload).toBe('alpha_payload');

    // Under Tenant B, insert probe B
    const probeB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(
        `INSERT INTO tenancy_isolation_probe (tenant_id, payload) VALUES ($1, $2) RETURNING id, tenant_id, payload`,
        [ctxTenantB.tenantId, 'beta_payload'],
      );
      return res.rows[0];
    });

    expect(probeB.tenant_id).toBe(tenantBId);
    expect(probeB.payload).toBe('beta_payload');

    // Under Tenant A, querying all probes MUST ONLY return probe A
    const probesSeenByA = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(`SELECT * FROM tenancy_isolation_probe`);
      return res.rows;
    });

    expect(probesSeenByA.length).toBe(1);
    expect(probesSeenByA[0].id).toBe(probeA.id);
    expect(probesSeenByA[0].payload).toBe('alpha_payload');

    // Under Tenant B, querying all probes MUST ONLY return probe B
    const probesSeenByB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(`SELECT * FROM tenancy_isolation_probe`);
      return res.rows;
    });

    expect(probesSeenByB.length).toBe(1);
    expect(probesSeenByB[0].id).toBe(probeB.id);
    expect(probesSeenByB[0].payload).toBe('beta_payload');
  });

  it('2. querying an existing ID belonging to another tenant returns zero rows (zero data leakage)', async () => {
    // First get probe B's id from Tenant B
    const probeB = await withTenant(pool, ctxTenantB, async (tx) => {
      const res = await tx.query(`SELECT id FROM tenancy_isolation_probe LIMIT 1`);
      return res.rows[0];
    });

    // Now Tenant A queries explicitly for probe B's ID
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
    // Under Tenant A context, attempt to write a row specifying Tenant B's tenant_id
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
      // Direct query without withTenant context
      const res = await rawClient.query(`SELECT * FROM tenancy_isolation_probe`);
      expect(res.rows.length).toBe(0);
    } finally {
      await rawClient.query('RESET ROLE');
      rawClient.release();
    }
  });

  it('5. audit_logs enforces append-only immutability via database trigger (prohibits UPDATE/DELETE)', async () => {
    // Insert audit log under Tenant A
    const logEntry = await withTenant(pool, ctxTenantA, async (tx) => {
      const res = await tx.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, entity_type, entity_id)
         VALUES ($1, $2, 'INVOICE_CREATED', 'invoice', 'inv-001')
         RETURNING id`,
        [tenantAId, userAId],
      );
      return res.rows[0];
    });

    // Attempt to UPDATE the audit log
    await expect(
      withTenant(pool, ctxTenantA, async (tx) => {
        await tx.query(
          `UPDATE audit_logs SET event_type = 'TAMPERED' WHERE id = $1`,
          [logEntry.id],
        );
      }),
    ).rejects.toThrow(/audit_logs are immutable and append-only/i);

    // Attempt to DELETE the audit log
    await expect(
      withTenant(pool, ctxTenantA, async (tx) => {
        await tx.query(`DELETE FROM audit_logs WHERE id = $1`, [logEntry.id]);
      }),
    ).rejects.toThrow(/audit_logs are immutable and append-only/i);
  });

  it('6. PermissionGuard grants access when permission exists and throws ForbiddenException when missing', () => {
    const reflector = new Reflector();
    const guard = new PermissionGuard(reflector);

    const mockExecutionContext = (
      reqCtx: RequestContext,
    ): ExecutionContext => {
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

    // Spy on reflector to require 'invoices.create'
    reflector.getAllAndOverride = ((key: string) => {
      if (key === 'required_permission') return 'invoices.create';
      return undefined;
    }) as any;

    // Tenant A has 'invoices.create' -> should pass
    const executionCtxA = mockExecutionContext(ctxTenantA);
    expect(guard.canActivate(executionCtxA)).toBe(true);

    // Tenant B only has ['invoices.read', 'audit.read'], NOT 'invoices.create' -> throws
    const executionCtxB = mockExecutionContext(ctxTenantB);
    expect(() => guard.canActivate(executionCtxB)).toThrow(
      /Missing required permission: invoices.create/,
    );
  });
});
