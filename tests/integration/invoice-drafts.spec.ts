/**
 * Integration tests — Invoice Drafts (Task 6)
 *
 * TDD: These tests are written FIRST. Run against empty schema → RED.
 * Apply db/migrations/0005_fiscal_documents.sql → GREEN.
 *
 * Test matrix:
 *   1. Create draft → persists with correctly calculated totals
 *   2. Patch draft → recalculates and persists updated totals
 *   3. Optimistic concurrency → second concurrent PATCH with same version gets 409
 *   4. Cannot mutate ISSUED document → 422
 *   5. Customer snapshot is immutable — changing customer name after draft creation preserves original
 *   6. RLS isolation → Tenant B cannot read or mutate Tenant A drafts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { DocumentsService } from '../../apps/api/src/documents/documents.service.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Invoice Drafts Integration Tests (Task 6)', () => {
  let pool: pg.Pool;
  let service: DocumentsService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let customerAId: string;

  let ctxA: RequestContext;
  let ctxB: RequestContext;

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });

    // Ensure migrations are applied
    const tableCheck = await pool.query(
      `SELECT to_regclass('public.fiscal_documents') as table_exists;`,
    );
    if (!tableCheck.rows[0]?.table_exists) {
      await runMigrations();
    }

    service = new DocumentsService(pool);

    const runId = Date.now().toString();

    // Seed tenants
    const tA = await pool.query(
      `INSERT INTO tenants (name, tax_id) VALUES ($1, $2) RETURNING id`,
      [`TenantA Facturas ${runId}`, `900100${runId.slice(-6)}-1`],
    );
    tenantAId = tA.rows[0].id as string;

    const tB = await pool.query(
      `INSERT INTO tenants (name, tax_id) VALUES ($1, $2) RETURNING id`,
      [`TenantB Facturas ${runId}`, `900200${runId.slice(-6)}-2`],
    );
    tenantBId = tB.rows[0].id as string;

    // Seed users
    const uA = await pool.query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'hash_a', 'Alice Test') RETURNING id`,
      [`alice_${runId}@nuvora.test`],
    );
    userAId = uA.rows[0].id as string;

    const uB = await pool.query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'hash_b', 'Bob Test') RETURNING id`,
      [`bob_${runId}@nuvora.test`],
    );
    userBId = uB.rows[0].id as string;

    // Seed customer for Tenant A
    const cA = await pool.query(
      `INSERT INTO customers (
        tenant_id, type, identification_type, identification,
        legal_name, email_primary
      ) VALUES ($1, 'LEGAL_ENTITY', 'NIT', $2, $3, $4) RETURNING id`,
      [tenantAId, `9001${runId.slice(-5)}`, `Empresa Test ${runId}`, `facturacion_${runId}@test.co`],
    );
    customerAId = cA.rows[0].id as string;

    ctxA = {
      tenantId: tenantAId,
      userId: userAId,
      permissions: ['invoices.read', 'invoices.write'],
      requestId: 'req-draft-test-a',
    };

    ctxB = {
      tenantId: tenantBId,
      userId: userBId,
      permissions: ['invoices.read', 'invoices.write'],
      requestId: 'req-draft-test-b',
    };
  });

  afterAll(async () => {
    if (pool) {
      // Scoped cleanup: only touch records created in this test run
      if (tenantAId || tenantBId) {
        const ids = [tenantAId, tenantBId].filter(Boolean);
        if (ids.length > 0) {
          await pool.query(
            `DELETE FROM fiscal_document_aiu WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(
            `DELETE FROM fiscal_document_taxes WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(
            `DELETE FROM fiscal_document_lines WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(
            `DELETE FROM fiscal_documents WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(
            `DELETE FROM customers WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(
            `DELETE FROM memberships WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(
            `DELETE FROM sessions WHERE tenant_id = ANY($1::uuid[])`,
            [ids],
          );
          await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userAId, userBId]);
          await pool.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [ids]);
        }
      }
      await pool.end();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Create draft — persists with correct calculated totals
  // ─────────────────────────────────────────────────────────────────────────
  it('creates a draft invoice and persists calculated totals', async () => {
    const draft = await service.createDraft(ctxA, {
      customerId: customerAId,
      lines: [
        {
          description: 'Consultoría IT',
          quantity: '2',
          unitPrice: '500000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
        {
          description: 'Soporte técnico',
          quantity: '1',
          unitPrice: '200000',
          discountPct: 0,
          taxTreatment: 'EXEMPT',
          taxRate: 0,
        },
      ],
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe('DRAFT');
    expect(draft.version).toBe(1);
    expect(draft.tenantId).toBe(tenantAId);
    expect(draft.lines).toHaveLength(2);

    // Line 1: 2 × 500000 = 1000000, IVA 19% = 190000, total = 1190000
    const line1 = draft.lines.find((l) => l.description === 'Consultoría IT')!;
    expect(line1).toBeDefined();
    expect(line1.grossAmount).toBe('1000000.00');
    expect(line1.taxAmount).toBe('190000.00');
    expect(line1.lineTotal).toBe('1190000.00');

    // Line 2: 1 × 200000 = 200000, exempt 0 tax, total = 200000
    const line2 = draft.lines.find((l) => l.description === 'Soporte técnico')!;
    expect(line2).toBeDefined();
    expect(line2.taxAmount).toBe('0.00');
    expect(line2.lineTotal).toBe('200000.00');

    // Document totals: subtotal = 1200000, totalTax = 190000, grandTotal = 1390000
    expect(draft.subtotal).toBe('1200000.00');
    expect(draft.totalTax).toBe('190000.00');
    expect(draft.grandTotal).toBe('1390000.00');

    // Customer snapshot captured
    expect(draft.customerSnapshot.id).toBe(customerAId);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Patch draft — recalculates and updates totals
  // ─────────────────────────────────────────────────────────────────────────
  it('patches a draft and recalculates totals correctly', async () => {
    // Create a simple draft first
    const created = await service.createDraft(ctxA, {
      customerId: customerAId,
      lines: [
        {
          description: 'Producto A',
          quantity: '1',
          unitPrice: '100000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });
    expect(created.version).toBe(1);

    // Patch with new quantity
    const patched = await service.patchDraft(ctxA, created.id, {
      version: 1,
      lines: [
        {
          description: 'Producto A',
          quantity: '5', // changed from 1 to 5
          unitPrice: '100000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });

    expect(patched.version).toBe(2);
    // 5 × 100000 = 500000, IVA 19% = 95000, total = 595000
    expect(patched.subtotal).toBe('500000.00');
    expect(patched.totalTax).toBe('95000.00');
    expect(patched.grandTotal).toBe('595000.00');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Optimistic concurrency — second PATCH with stale version gets 409
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects a concurrent PATCH with a stale version (409 Conflict)', async () => {
    const draft = await service.createDraft(ctxA, {
      customerId: customerAId,
      lines: [
        {
          description: 'Concurrencia test',
          quantity: '1',
          unitPrice: '50000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });
    expect(draft.version).toBe(1);

    // First PATCH succeeds → version becomes 2
    await service.patchDraft(ctxA, draft.id, {
      version: 1,
      lines: [
        {
          description: 'Concurrencia test actualizado',
          quantity: '2',
          unitPrice: '50000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });

    // Second PATCH with stale version=1 must fail with 409
    await expect(
      service.patchDraft(ctxA, draft.id, {
        version: 1, // stale!
        lines: [
          {
            description: 'Concurrencia conflicto',
            quantity: '3',
            unitPrice: '50000',
            discountPct: 0,
            taxTreatment: 'TAXED',
            taxRate: 19,
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Cannot mutate ISSUED document
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects PATCH on an ISSUED document with 422', async () => {
    const draft = await service.createDraft(ctxA, {
      customerId: customerAId,
      lines: [
        {
          description: 'Factura emitida test',
          quantity: '1',
          unitPrice: '100000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });

    // Force status to ISSUED directly in DB (simulating emission)
    await pool.query(
      `UPDATE fiscal_documents SET status = 'ISSUED' WHERE id = $1`,
      [draft.id],
    );

    await expect(
      service.patchDraft(ctxA, draft.id, {
        version: draft.version,
        notes: 'intentando modificar factura emitida',
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Customer snapshot is immutable after draft creation
  // ─────────────────────────────────────────────────────────────────────────
  it('preserves customer snapshot even after customer record is updated', async () => {
    const draft = await service.createDraft(ctxA, {
      customerId: customerAId,
      lines: [
        {
          description: 'Snapshot test',
          quantity: '1',
          unitPrice: '100000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });

    const originalName = draft.customerSnapshot.legalName;

    // Update customer name directly in DB (bypassing tenant context for test setup)
    await pool.query(
      `UPDATE customers SET legal_name = 'Nombre Modificado XYZ' WHERE id = $1`,
      [customerAId],
    );

    // Reload the draft
    const reloaded = await service.getDraft(ctxA, draft.id);

    // Snapshot must still have the original name
    expect(reloaded.customerSnapshot.legalName).toBe(originalName);
    expect(reloaded.customerSnapshot.legalName).not.toBe('Nombre Modificado XYZ');

    // Restore customer name
    await pool.query(
      `UPDATE customers SET legal_name = $1 WHERE id = $2`,
      [originalName, customerAId],
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: RLS isolation — Tenant B cannot read or mutate Tenant A drafts
  // ─────────────────────────────────────────────────────────────────────────
  it('prevents Tenant B from reading or patching Tenant A drafts (RLS)', async () => {
    const draftA = await service.createDraft(ctxA, {
      customerId: customerAId,
      lines: [
        {
          description: 'RLS isolation test',
          quantity: '1',
          unitPrice: '300000',
          discountPct: 0,
          taxTreatment: 'TAXED',
          taxRate: 19,
        },
      ],
    });

    // Tenant B trying to read Tenant A's draft → 404 (not visible through RLS)
    await expect(service.getDraft(ctxB, draftA.id)).rejects.toMatchObject({ status: 404 });

    // Tenant B trying to patch Tenant A's draft → 404
    await expect(
      service.patchDraft(ctxB, draftA.id, {
        version: 1,
        notes: 'cross-tenant attack',
      }),
    ).rejects.toMatchObject({ status: 404 });

    // Verify document still exists and is intact via Tenant A
    const intact = await service.getDraft(ctxA, draftA.id);
    expect(intact.id).toBe(draftA.id);
    expect(intact.notes).toBeNull();
  });
});
