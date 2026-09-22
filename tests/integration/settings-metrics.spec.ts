/**
 * Integration tests — Settings & Metrics (Task 13)
 *
 * Test matrix:
 *   1. GET /settings returns defaults for new tenant
 *   2. PUT /settings persists and GET returns updated values
 *   3. GET /metrics returns correct invoice count after issuance
 *   4. RLS: tenant B cannot read tenant A settings
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { SettingsService } from '../../apps/api/src/settings/settings.service.js';
import { MetricsService } from '../../apps/api/src/metrics/metrics.service.js';
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

describe('Settings & Metrics Integration Tests (Task 13)', () => {
  let pool: pg.Pool;
  let settings: SettingsService;
  let metrics: MetricsService;
  let drafts: DocumentsService;
  let issuer: IssueDocumentService;

  let tenantAId: string;
  let tenantBId: string;
  let customerId: string;
  let ctxA: RequestContext;
  let ctxB: RequestContext;

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SAFETY ABORT: Integration tests cannot run against production.');
    }

    pool = new Pool({ connectionString });
    await runMigrations(pool);

    settings = new SettingsService(pool);
    metrics = new MetricsService(pool);
    drafts = new DocumentsService(pool);
    issuer = new IssueDocumentService(
      new NumberingService(),
      new AuditService(),
      new MockDianProvider(),
      pool,
    );

    const client = await pool.connect();
    try {
      const ts = Date.now();
      const { rows: [tA] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Settings A', 'settings-a-${ts}') RETURNING id`,
      );
      const { rows: [tB] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Settings B', 'settings-b-${ts}') RETURNING id`,
      );
      const { rows: [uA] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('sa-${ts}@t.com', 'A', 'x') RETURNING id`,
      );
      const { rows: [uB] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('sb-${ts}@t.com', 'B', 'x') RETURNING id`,
      );
      tenantAId = tA!.id;
      tenantBId = tB!.id;

      const { rows: [cust] } = await client.query<{ id: string }>(
        `INSERT INTO customers (tenant_id, legal_name, identification_type, identification, email_primary)
         VALUES ($1, 'Test Customer', 'NIT', '900000001', 'c@t.com') RETURNING id`,
        [tenantAId],
      );
      customerId = cust!.id;

      ctxA = {
        tenantId: tenantAId, userId: uA!.id,
        permissions: ['tenant.settings', 'invoices.read', 'invoices.write', 'invoices.issue'],
        requestId: 'settings-a',
      };
      ctxB = {
        tenantId: tenantBId, userId: uB!.id,
        permissions: ['tenant.settings'],
        requestId: 'settings-b',
      };
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('GET settings returns defaults for new tenant', async () => {
    const s = await settings.get(ctxA);
    expect(s.legalName).toBe('');
    expect(s.taxRegime).toBe('SIMPLIFICADO');
    expect(s.dianEnvironment).toBe('HABILITACION');
  });

  it('PUT settings persists and GET returns updated values', async () => {
    await settings.update(ctxA, {
      legalName: 'Mi Empresa S.A.S.',
      nit: '900123456-7',
      city: 'Bogotá',
      taxRegime: 'COMUN',
    });
    const s = await settings.get(ctxA);
    expect(s.legalName).toBe('Mi Empresa S.A.S.');
    expect(s.nit).toBe('900123456-7');
    expect(s.city).toBe('Bogotá');
    expect(s.taxRegime).toBe('COMUN');
  });

  it('metrics reflect issued invoices', async () => {
    const before = await metrics.getDashboard(ctxA);
    const prevCount = before.invoicesThisMonth;

    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Servicio', quantity: '1', unitPrice: '500000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    await issuer.issue(ctxA, draft.id);

    const after = await metrics.getDashboard(ctxA);
    expect(after.invoicesThisMonth).toBe(prevCount + 1);
    expect(parseFloat(after.revenueThisMonth)).toBeGreaterThan(0);
    expect(after.recentDocuments.length).toBeGreaterThan(0);
  });

  it('RLS: tenant B cannot read tenant A settings', async () => {
    const s = await settings.get(ctxB);
    expect(s.legalName).toBe('');
  });
});
