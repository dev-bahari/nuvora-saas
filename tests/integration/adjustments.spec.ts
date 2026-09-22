/**
 * Integration tests — Notas crédito y débito (Task 10)
 *
 * Test matrix:
 *   1. NC total: cancela factura, status → CANCELLED_BY_CREDIT_NOTE
 *   2. NC parcial: factura permanece ISSUED, NC tiene source_document_id correcto
 *   3. NC-sobre-NC: rechazado con 422
 *   4. NC sobre documento no ISSUED: rechazado con 422
 *   5. ND con reason code válido: creada correctamente
 *   6. ND con HIGHER_VALUE / PRICE_INCREASE: rechazado con 422
 *   7. RLS: tenant B no puede crear NC/ND sobre documentos de tenant A
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { UnprocessableEntityException } from '@nestjs/common';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { DocumentsService } from '../../apps/api/src/documents/documents.service.js';
import { IssueDocumentService } from '../../apps/api/src/documents/issue-document.service.js';
import { CreditNotesService } from '../../apps/api/src/documents/credit-notes/credit-notes.service.js';
import { DebitNotesService } from '../../apps/api/src/documents/debit-notes/debit-notes.service.js';
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

describe('Adjustments Integration Tests (Task 10)', () => {
  let pool: pg.Pool;
  let drafts: DocumentsService;
  let issuer: IssueDocumentService;
  let creditNotes: CreditNotesService;
  let debitNotes: DebitNotesService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let customerId: string;
  let ctxA: RequestContext;
  let ctxB: RequestContext;

  async function createIssuedInvoice() {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Servicio', quantity: '1', unitPrice: '1000000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    return issuer.issue(ctxA, draft.id);
  }

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });
    await runMigrations(pool);

    const numbering = new NumberingService();
    const audit = new AuditService();
    const dian = new MockDianProvider();
    drafts = new DocumentsService(pool);
    issuer = new IssueDocumentService(numbering, audit, dian, pool);
    creditNotes = new CreditNotesService(numbering, audit, pool);
    debitNotes = new DebitNotesService(numbering, audit, pool);

    const client = await pool.connect();
    try {
      const ts = Date.now();
      const { rows: [tA] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Adj Tenant A', 'adj-a-${ts}') RETURNING id`,
      );
      const { rows: [tB] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Adj Tenant B', 'adj-b-${ts}') RETURNING id`,
      );
      const { rows: [uA] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('adj-a-${ts}@t.com', 'A', 'x') RETURNING id`,
      );
      const { rows: [uB] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('adj-b-${ts}@t.com', 'B', 'x') RETURNING id`,
      );
      tenantAId = tA!.id;
      tenantBId = tB!.id;
      userAId = uA!.id;
      userBId = uB!.id;

      const { rows: [cust] } = await client.query<{ id: string }>(
        `INSERT INTO customers (tenant_id, legal_name, identification_type, identification, email_primary)
         VALUES ($1, 'Cliente NC', 'NIT', '900333444', 'nc@test.com') RETURNING id`,
        [tenantAId],
      );
      customerId = cust!.id;
    } finally {
      client.release();
    }

    ctxA = { tenantId: tenantAId, userId: userAId, permissions: ['invoices.read', 'invoices.write', 'invoices.issue', 'credit_notes.create', 'debit_notes.create'], requestId: 'adj-a' };
    ctxB = { tenantId: tenantBId, userId: userBId, permissions: ['invoices.read', 'invoices.write', 'credit_notes.create', 'debit_notes.create'], requestId: 'adj-b' };
  });

  afterAll(async () => {
    await pool.end();
  });

  // ── Credit notes ──────────────────────────────────────────────────────────

  it('NC total: source → CANCELLED_BY_CREDIT_NOTE', async () => {
    const invoice = await createIssuedInvoice();

    await creditNotes.create(ctxA, invoice.id, {});

    const { rows: [updated] } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ status: string }>(
        `SELECT status FROM fiscal_documents WHERE id = $1`,
        [invoice.id],
      ),
    );
    expect(updated!.status).toBe('CANCELLED_BY_CREDIT_NOTE');
  });

  it('NC parcial: source permanece ISSUED, NC tiene source_document_id', async () => {
    const invoice = await createIssuedInvoice();

    const nc = await creditNotes.create(ctxA, invoice.id, {
      lines: [{ description: 'Ajuste parcial', quantity: '1', unitPrice: '100000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    expect(nc.sourceDocumentId).toBe(invoice.id);
    expect(nc.documentType).toBe('CREDIT_NOTE');

    const { rows: [source] } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ status: string }>(
        `SELECT status FROM fiscal_documents WHERE id = $1`,
        [invoice.id],
      ),
    );
    expect(source!.status).toBe('ISSUED');
  });

  it('NC tiene CUDE con formato MOCK-CUDE-{hex}', async () => {
    const invoice = await createIssuedInvoice();
    const nc = await creditNotes.create(ctxA, invoice.id, {});

    expect(nc.cude).toMatch(/^MOCK-CUDE-[0-9A-F]{24}$/);
  });

  it('NC sobre NC: rechazado con UnprocessableEntityException', async () => {
    const invoice = await createIssuedInvoice();
    const nc = await creditNotes.create(ctxA, invoice.id, {
      lines: [{ description: 'Parcial', quantity: '1', unitPrice: '100000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    await expect(
      creditNotes.create(ctxA, nc.id, {}),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('NC sobre documento DRAFT: rechazado con UnprocessableEntityException', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Draft', quantity: '1', unitPrice: '100000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    await expect(
      creditNotes.create(ctxA, draft.id, {}),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('RLS: tenant B no puede crear NC sobre factura de tenant A', async () => {
    const invoice = await createIssuedInvoice();

    await expect(
      creditNotes.create(ctxB, invoice.id, {}),
    ).rejects.toThrow();
  });

  // ── Debit notes ───────────────────────────────────────────────────────────

  it('ND con reason code INTEREST: creada correctamente', async () => {
    const invoice = await createIssuedInvoice();

    const nd = await debitNotes.create(ctxA, invoice.id, {
      reasonCode: 'INTEREST',
      lines: [{ description: 'Intereses mora', quantity: '1', unitPrice: '50000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    expect(nd.documentType).toBe('DEBIT_NOTE');
    expect(nd.sourceDocumentId).toBe(invoice.id);
    expect(nd.reasonCode).toBe('INTEREST');
  });

  it('ND con EXTRA_COSTS: creada correctamente', async () => {
    const invoice = await createIssuedInvoice();

    const nd = await debitNotes.create(ctxA, invoice.id, {
      reasonCode: 'EXTRA_COSTS',
      lines: [{ description: 'Gastos adicionales', quantity: '1', unitPrice: '30000', discountPct: 0, taxTreatment: 'EXCLUDED', taxRate: 0 }],
    });

    expect(nd.reasonCode).toBe('EXTRA_COSTS');
  });

  it('ND con HIGHER_VALUE: rechazado con UnprocessableEntityException', async () => {
    const invoice = await createIssuedInvoice();

    await expect(
      debitNotes.create(ctxA, invoice.id, {
        reasonCode: 'HIGHER_VALUE',
        lines: [{ description: 'Mayor valor', quantity: '1', unitPrice: '200000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('ND con PRICE_INCREASE: rechazado con UnprocessableEntityException', async () => {
    const invoice = await createIssuedInvoice();

    await expect(
      debitNotes.create(ctxA, invoice.id, {
        reasonCode: 'PRICE_INCREASE',
        lines: [],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('RLS: tenant B no puede crear ND sobre factura de tenant A', async () => {
    const invoice = await createIssuedInvoice();

    await expect(
      debitNotes.create(ctxB, invoice.id, {
        reasonCode: 'INTEREST',
        lines: [{ description: 'X', quantity: '1', unitPrice: '10000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
      }),
    ).rejects.toThrow();
  });
});
