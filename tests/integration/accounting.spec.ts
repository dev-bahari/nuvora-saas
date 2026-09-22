/**
 * Integration tests — Contabilidad básica inmutable (Task 11)
 *
 * Test matrix:
 *   1. Emisión de factura genera asiento debit=cuentas por cobrar, credit=ingresos+IVA
 *   2. Debit = Credit (asiento cuadrado)
 *   3. journal_entries y journal_lines son inmutables (trigger rechaza UPDATE/DELETE)
 *   4. RLS: tenant B no ve asientos de tenant A
 *   5. NC genera asiento inverso (debit ingresos, credit cuentas por cobrar)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { DocumentsService } from '../../apps/api/src/documents/documents.service.js';
import { IssueDocumentService } from '../../apps/api/src/documents/issue-document.service.js';
import { AccountingService } from '../../apps/api/src/accounting/accounting.service.js';
import { NumberingService } from '../../apps/api/src/numbering/numbering.service.js';
import { AuditService } from '../../apps/api/src/audit/audit.service.js';
import { MockDianProvider } from '../../apps/api/src/dian/mock-dian.provider.js';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Accounting Integration Tests (Task 11)', () => {
  let pool: pg.Pool;
  let drafts: DocumentsService;
  let issuer: IssueDocumentService;
  let accounting: AccountingService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let customerId: string;
  let ctxA: RequestContext;
  let ctxB: RequestContext;

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });
    await runMigrations(pool);

    accounting = new AccountingService(pool);
    drafts = new DocumentsService(pool);
    issuer = new IssueDocumentService(
      new NumberingService(),
      new AuditService(),
      new MockDianProvider(),
      pool,
      accounting,
    );

    const client = await pool.connect();
    try {
      const ts = Date.now();
      const { rows: [tA] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Acct Tenant A', 'acct-a-${ts}') RETURNING id`,
      );
      const { rows: [tB] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Acct Tenant B', 'acct-b-${ts}') RETURNING id`,
      );
      const { rows: [uA] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('acct-a-${ts}@t.com', 'A', 'x') RETURNING id`,
      );
      const { rows: [uB] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('acct-b-${ts}@t.com', 'B', 'x') RETURNING id`,
      );
      tenantAId = tA!.id;
      tenantBId = tB!.id;
      userAId = uA!.id;
      userBId = uB!.id;

      const { rows: [cust] } = await client.query<{ id: string }>(
        `INSERT INTO customers (tenant_id, legal_name, identification_type, identification, email_primary)
         VALUES ($1, 'Cliente Contable', 'NIT', '900555666', 'acc@test.com') RETURNING id`,
        [tenantAId],
      );
      customerId = cust!.id;
    } finally {
      client.release();
    }

    ctxA = { tenantId: tenantAId, userId: userAId, permissions: ['invoices.read', 'invoices.write', 'invoices.issue', 'accounting.read'], requestId: 'acct-a' };
    ctxB = { tenantId: tenantBId, userId: userBId, permissions: ['accounting.read'], requestId: 'acct-b' };
  });

  afterAll(async () => {
    await pool.end();
  });

  it('emisión genera asiento con cuentas correctas (1305, 4135, 2408)', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Consultoría', quantity: '2', unitPrice: '500000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    const issued = await issuer.issue(ctxA, draft.id);

    // Allow fire-and-forget accounting to complete
    await new Promise((r) => setTimeout(r, 100));

    const entries = await accounting.listForDocument(ctxA, issued.id);
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const entry = entries[0]!;
    const codes = entry.lines.map((l) => l.accountCode);
    expect(codes).toContain('1305');
    expect(codes).toContain('4135');
    expect(codes).toContain('2408');
  });

  it('asiento cuadrado: suma debits === suma credits', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Balanceo', quantity: '1', unitPrice: '800000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    const issued = await issuer.issue(ctxA, draft.id);
    await new Promise((r) => setTimeout(r, 100));

    const entries = await accounting.listForDocument(ctxA, issued.id);
    const entry = entries[0]!;

    const totalDebit = entry.lines.reduce((s, l) => s + parseFloat(l.debit), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + parseFloat(l.credit), 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  it('journal_entries inmutable: trigger rechaza UPDATE y DELETE', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Inmutable', quantity: '1', unitPrice: '100000', discountPct: 0, taxTreatment: 'EXCLUDED', taxRate: 0 }],
    });
    const issued = await issuer.issue(ctxA, draft.id);
    await new Promise((r) => setTimeout(r, 100));

    const entries = await accounting.listForDocument(ctxA, issued.id);
    const entryId = entries[0]!.id;

    const client = await pool.connect();
    try {
      await expect(
        client.query(`UPDATE journal_entries SET description = 'hack' WHERE id = $1`, [entryId]),
      ).rejects.toThrow(/immutable/);

      await expect(
        client.query(`DELETE FROM journal_entries WHERE id = $1`, [entryId]),
      ).rejects.toThrow(/immutable/);
    } finally {
      client.release();
    }
  });

  it('RLS: tenant B no ve asientos de tenant A', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'RLS test', quantity: '1', unitPrice: '200000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    const issued = await issuer.issue(ctxA, draft.id);
    await new Promise((r) => setTimeout(r, 100));

    const { rows } = await withTenant(pool, ctxB, (tx) =>
      tx.query(`SELECT id FROM journal_entries WHERE document_id = $1`, [issued.id]),
    );
    expect(rows.length).toBe(0);
  });
});
