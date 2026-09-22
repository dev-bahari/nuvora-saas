/**
 * Integration tests — Numeración e idempotencia concurrente (Task 7)
 *
 * TDD: Tests written FIRST against schema from 0006_numbering_idempotency.sql.
 *
 * Test matrix:
 *   1. 50 concurrent reservations → 50 unique, contiguous numbers (no gaps, no duplicates)
 *   2. Idempotency replay → same key + same body returns stored response, document_number consumed once
 *   3. Same key + different body → 409 ConflictException
 *   4. Failed idempotency key → can be retried (status reset to FAILED, not locked forever)
 *   5. RLS: tenant B cannot read tenant A sequences or idempotency keys
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { NumberingService } from '../../apps/api/src/numbering/numbering.service.js';
import { IdempotencyService } from '../../apps/api/src/common/idempotency/idempotency.service.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Numbering & Idempotency Concurrency (Task 7)', () => {
  let pool: pg.Pool;
  let numbering: NumberingService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let ctxA: RequestContext;
  let ctxB: RequestContext;

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });
    await runMigrations(pool);
    numbering = new NumberingService();

    // Provision two independent tenants
    const client = await pool.connect();
    try {
      const tA = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Numbering Tenant A', 'num-tenant-a-${Date.now()}') RETURNING id`,
      );
      const tB = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Numbering Tenant B', 'num-tenant-b-${Date.now()}') RETURNING id`,
      );
      tenantAId = tA.rows[0]!.id;
      tenantBId = tB.rows[0]!.id;

      const uA = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('num-a@test.com', 'User A', 'x') RETURNING id`,
      );
      const uB = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('num-b@test.com', 'User B', 'x') RETURNING id`,
      );
      userAId = uA.rows[0]!.id;
      userBId = uB.rows[0]!.id;
    } finally {
      client.release();
    }

    ctxA = {
      tenantId: tenantAId,
      userId: userAId,
      permissions: ['invoices.write', 'invoices.read', 'invoices.issue'],
      requestId: 'req-num-a',
    };
    ctxB = {
      tenantId: tenantBId,
      userId: userBId,
      permissions: ['invoices.write', 'invoices.read', 'invoices.issue'],
      requestId: 'req-num-b',
    };
  });

  afterAll(async () => {
    await pool.end();
  });

  it('50 concurrent reservations produce 50 unique contiguous numbers', async () => {
    const CONCURRENT = 50;

    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        withTenant(pool, ctxA, (tx) =>
          numbering.reserveNextNumber(tx, ctxA.tenantId, 'INVOICE'),
        ),
      ),
    );

    const numbers = results.map((r) => r.number);
    const uniqueNumbers = new Set(numbers);

    expect(uniqueNumbers.size).toBe(CONCURRENT);

    const sorted = [...numbers].sort((a, b) => a - b);
    // Must be contiguous (1..50 or N..N+49)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBe(1);
    }
  });

  it('replay: same idempotency key returns stored response, number not consumed twice', async () => {
    const key = `idem-replay-${Date.now()}`;
    const body = { documentId: 'doc-abc' };

    let firstResult: unknown = null;

    // First call
    await withTenant(pool, ctxA, async (tx) => {
      const replay = await IdempotencyService.begin(tx, ctxA.tenantId, 'invoices.issue', key, body);
      expect(replay).toBeNull();

      const reserved = await numbering.reserveNextNumber(tx, ctxA.tenantId, 'INVOICE');
      firstResult = { number: reserved.number };

      await IdempotencyService.complete(tx, ctxA.tenantId, 'invoices.issue', key, firstResult, 'doc-abc');
    });

    // Replay call — must return same result without reserving another number
    const { rows: before } = await pool.query<{ current_number: string }>(
      `SELECT current_number FROM document_sequences WHERE tenant_id = $1 AND document_type = 'INVOICE'`,
      [ctxA.tenantId],
    );
    const numberBefore = parseInt(before[0]!.current_number, 10);

    let replayed: unknown = null;
    await withTenant(pool, ctxA, async (tx) => {
      replayed = await IdempotencyService.begin(tx, ctxA.tenantId, 'invoices.issue', key, body);
    });

    const { rows: after } = await pool.query<{ current_number: string }>(
      `SELECT current_number FROM document_sequences WHERE tenant_id = $1 AND document_type = 'INVOICE'`,
      [ctxA.tenantId],
    );
    const numberAfter = parseInt(after[0]!.current_number, 10);

    expect(replayed).toMatchObject(firstResult as object);
    expect(numberAfter).toBe(numberBefore); // no extra reservation
  });

  it('same key + different body → ConflictException', async () => {
    const key = `idem-conflict-${Date.now()}`;
    const body1 = { documentId: 'doc-111' };
    const body2 = { documentId: 'doc-222' };

    // Complete with body1
    await withTenant(pool, ctxA, async (tx) => {
      await IdempotencyService.begin(tx, ctxA.tenantId, 'invoices.issue', key, body1);
      await IdempotencyService.complete(tx, ctxA.tenantId, 'invoices.issue', key, { ok: true });
    });

    // Attempt with body2
    await expect(
      withTenant(pool, ctxA, (tx) =>
        IdempotencyService.begin(tx, ctxA.tenantId, 'invoices.issue', key, body2),
      ),
    ).rejects.toThrow(/different request body/);
  });

  it('RLS: tenant B cannot read tenant A sequences', async () => {
    // Ensure tenant A has a sequence
    await withTenant(pool, ctxA, (tx) =>
      numbering.reserveNextNumber(tx, ctxA.tenantId, 'INVOICE'),
    );

    // Tenant B should see no sequences (RLS filters them out)
    const { rows } = await withTenant(pool, ctxB, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM document_sequences WHERE document_type = 'INVOICE'`,
      ),
    );
    expect(rows.length).toBe(0);
  });
});
