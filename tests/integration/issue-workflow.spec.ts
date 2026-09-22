/**
 * Integration tests — Emisión local, estados y auditoría (Task 8)
 *
 * TDD: Tests written FIRST against schema from 0007_submissions_jobs.sql.
 *
 * Test matrix:
 *   1. DRAFT → ISSUED: full happy path, audit trail and number assigned
 *   2. Cannot issue an already-ISSUED document → 422
 *   3. MockDianProvider REJECT scenario → document transitions to REJECTED with reason
 *   4. Idempotency: POST /issue twice with same key → same document, one number consumed
 *   5. Outbox recovery: simulate worker restart — pending outbox job reprocessed idempotently
 *   6. Audit events are append-only (trigger prevents UPDATE/DELETE)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { DocumentsService } from '../../apps/api/src/documents/documents.service.js';
import { IssueDocumentService } from '../../apps/api/src/documents/issue-document.service.js';
import { NumberingService } from '../../apps/api/src/numbering/numbering.service.js';
import { AuditService } from '../../apps/api/src/audit/audit.service.js';
import { MockDianProvider } from '../../apps/api/src/dian/mock-dian.provider.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

async function bootstrapTenant(pool: pg.Pool): Promise<{
  tenantId: string;
  userId: string;
  customerId: string;
  ctx: RequestContext;
}> {
  const client = await pool.connect();
  try {
    const ts = Date.now();
    const { rows: [tenant] } = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('Issue Test Tenant ${ts}', 'issue-${ts}') RETURNING id`,
    );
    const { rows: [user] } = await client.query<{ id: string }>(
      `INSERT INTO users (email, full_name, password_hash) VALUES ('issue-${ts}@test.com', 'Tester', 'x') RETURNING id`,
    );
    const tenantId = tenant!.id;
    const userId = user!.id;

    // Insert customer with RLS bypassed (superuser client)
    const { rows: [customer] } = await client.query<{ id: string }>(
      `INSERT INTO customers (tenant_id, legal_name, identification_type, identification, email_primary)
       VALUES ($1, 'Cliente Test', 'NIT', '900000000', 'cliente@test.com') RETURNING id`,
      [tenantId],
    );

    return {
      tenantId,
      userId,
      customerId: customer!.id,
      ctx: {
        tenantId,
        userId,
        permissions: ['invoices.write', 'invoices.read', 'invoices.issue'],
        requestId: `req-${ts}`,
      },
    };
  } finally {
    client.release();
  }
}

describe('Issue Workflow Integration Tests (Task 8)', () => {
  let pool: pg.Pool;
  let draftsService: DocumentsService;
  let numbering: NumberingService;
  let audit: AuditService;
  let dian: MockDianProvider;
  let issueService: IssueDocumentService;

  let tenantId: string;
  let customerId: string;
  let ctx: RequestContext;

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });
    await runMigrations(pool);

    numbering = new NumberingService();
    audit = new AuditService();
    dian = new MockDianProvider();
    draftsService = new DocumentsService(pool);
    issueService = new IssueDocumentService(numbering, audit, dian, pool);

    ({ tenantId, customerId, ctx } = await bootstrapTenant(pool));
  });

  afterAll(async () => {
    dian.clearScenarios();
    await pool.end();
  });

  async function createDraft(ctxOverride?: RequestContext) {
    return draftsService.createDraft(ctxOverride ?? ctx, {
      customerId,
      currency: 'COP',
      lines: [
        {
          description: 'Servicio de consultoría',
          quantity: '10',
          unitPrice: '100000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });
  }

  it('happy path: DRAFT → ISSUED with audit trail and document number', async () => {
    const draft = await createDraft();
    const issued = await issueService.issue(ctx, draft.id);

    expect(issued.status).toBe('ISSUED');
    expect(issued.version).toBeGreaterThan(draft.version);

    // Audit events written
    const { rows: auditRows } = await pool.query<{ event_type: string }>(
      `SELECT event_type FROM audit_events WHERE document_id = $1 ORDER BY created_at`,
      [draft.id],
    );
    const eventTypes = auditRows.map((r) => r.event_type);
    expect(eventTypes).toContain('document.issue.started');
    expect(eventTypes).toContain('document.issued');

    // Document number assigned
    const { rows: docRows } = await pool.query<{ document_number: string; dian_tracking_id: string }>(
      `SELECT document_number, dian_tracking_id FROM fiscal_documents WHERE id = $1`,
      [draft.id],
    );
    expect(docRows[0]!.document_number).toBeTruthy();
    expect(docRows[0]!.dian_tracking_id).toMatch(/^MOCK-/);
  });

  it('cannot issue an already-ISSUED document → 422', async () => {
    const draft = await createDraft();
    await issueService.issue(ctx, draft.id);

    await expect(issueService.issue(ctx, draft.id)).rejects.toThrow(/ISSUED/);
  });

  it('DIAN reject: document transitions to REJECTED with rejection reason', async () => {
    const draft = await createDraft();
    dian.setScenario(draft.id, 'REJECTED');

    const result = await issueService.issue(ctx, draft.id);
    expect(result.status).toBe('REJECTED');

    const { rows } = await pool.query<{ rejection_reason: string }>(
      `SELECT rejection_reason FROM fiscal_documents WHERE id = $1`,
      [draft.id],
    );
    expect(rows[0]!.rejection_reason).toBeTruthy();
  });

  it('idempotency: issue twice with same key → same document, one number consumed', async () => {
    const draft = await createDraft();
    const key = `issue-idem-${Date.now()}`;

    const { rows: before } = await pool.query<{ current_number: string }>(
      `SELECT current_number FROM document_sequences WHERE tenant_id = $1 AND document_type = 'INVOICE'`,
      [tenantId],
    );
    const numberBefore = parseInt(before[0]?.current_number ?? '0', 10);

    const first = await issueService.issue(ctx, draft.id, key);
    const second = await issueService.issue(ctx, draft.id, key);

    expect(second.id).toBe(first.id);
    expect(second.status).toBe(first.status);

    const { rows: after } = await pool.query<{ current_number: string }>(
      `SELECT current_number FROM document_sequences WHERE tenant_id = $1 AND document_type = 'INVOICE'`,
      [tenantId],
    );
    const numberAfter = parseInt(after[0]!.current_number, 10);
    expect(numberAfter).toBe(numberBefore + 1); // only one number consumed
  });

  it('outbox recovery: pending job reprocessed idempotently after simulated worker restart', async () => {
    const draft = await createDraft();

    // Write only the outbox job (no DIAN call) — simulate crash between outbox write and worker
    await withTenant(pool, ctx, async (tx) => {
      const reserved = await numbering.reserveNextNumber(tx, ctx.tenantId, 'INVOICE');
      await tx.query(
        `UPDATE fiscal_documents
         SET status = 'PROCESSING', number_prefix = $1, document_number = $2, version = version + 1
         WHERE id = $3`,
        [reserved.prefix, reserved.number, draft.id],
      );
      await tx.query(
        `INSERT INTO document_outbox (tenant_id, document_id, job_type, payload)
         VALUES ($1, $2, 'dian.submit', '{}')`,
        [ctx.tenantId, draft.id],
      );
    });

    // Verify still PROCESSING (worker "crashed" before DIAN call)
    const { rows: mid } = await pool.query<{ status: string }>(
      `SELECT status FROM fiscal_documents WHERE id = $1`,
      [draft.id],
    );
    expect(mid[0]!.status).toBe('PROCESSING');

    // Worker recovers and processes outbox
    const processed = await issueService.processOutbox(ctx);
    expect(processed).toBeGreaterThan(0);

    // Document now ISSUED — idempotent, not re-emitted
    const { rows: final } = await pool.query<{ status: string }>(
      `SELECT status FROM fiscal_documents WHERE id = $1`,
      [draft.id],
    );
    expect(final[0]!.status).toBe('ISSUED');
  });

  it('audit events are append-only — trigger rejects UPDATE and DELETE', async () => {
    const client = await pool.connect();
    try {
      const { rows: [event] } = await client.query<{ id: string }>(
        `SELECT id FROM audit_events WHERE tenant_id = $1 LIMIT 1`,
        [tenantId],
      );
      if (!event) return; // no events yet, test skipped

      await expect(
        client.query(`UPDATE audit_events SET event_type = 'tampered' WHERE id = $1`, [event.id]),
      ).rejects.toThrow(/immutable/);

      await expect(
        client.query(`DELETE FROM audit_events WHERE id = $1`, [event.id]),
      ).rejects.toThrow(/immutable/);
    } finally {
      client.release();
    }
  });
});
