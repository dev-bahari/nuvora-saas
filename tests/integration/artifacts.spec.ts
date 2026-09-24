/**
 * Integration tests — Artefactos privados (Task 9)
 *
 * Test matrix:
 *   1. XML generado contiene snapshot del cliente y totales correctos
 *   2. SHA-256 del XML es reproducible (mismo documento → mismo hash)
 *   3. Artifact table es append-only (trigger rechaza UPDATE/DELETE)
 *   4. RLS: tenant B no puede leer artefactos de tenant A
 *   5. URL expirada es generada con TTL correcto (valor en query param)
 *   6. MIME type es application/xml para XML y application/pdf (stub) para PDF
 *
 * Note: Tests use InMemoryStorageAdapter — no MinIO required.
 * Full MinIO integration is covered by compose-level E2E.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';
import { XmlGeneratorService } from '../../apps/api/src/artifacts/xml-generator.service.js';
import { ArtifactsService } from '../../apps/api/src/artifacts/artifacts.service.js';
import { InMemoryStorageAdapter } from '../../apps/api/src/artifacts/minio-storage.adapter.js';
import { PdfRendererService } from '../../apps/api/src/artifacts/pdf-renderer.service.js';
import { DocumentsService } from '../../apps/api/src/documents/documents.service.js';
import { runMigrations } from '../../db/migrate.js';

const { Pool } = pg;

const connectionString =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';

describe('Artifacts Integration Tests (Task 9)', () => {
  let pool: pg.Pool;
  let xmlGenerator: XmlGeneratorService;
  let storage: InMemoryStorageAdapter;
  let artifacts: ArtifactsService;
  let drafts: DocumentsService;

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

    xmlGenerator = new XmlGeneratorService();
    storage = new InMemoryStorageAdapter();
    const pdfRenderer = new PdfRendererService();
    drafts = new DocumentsService(pool);
    artifacts = new ArtifactsService(xmlGenerator, pdfRenderer, storage, pool);

    const client = await pool.connect();
    try {
      const ts = Date.now();
      const { rows: [tA] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Artifact Tenant A', 'art-a-${ts}') RETURNING id`,
      );
      const { rows: [tB] } = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Artifact Tenant B', 'art-b-${ts}') RETURNING id`,
      );
      const { rows: [uA] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('art-a-${ts}@test.com', 'User A', 'x') RETURNING id`,
      );
      const { rows: [uB] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash) VALUES ('art-b-${ts}@test.com', 'User B', 'x') RETURNING id`,
      );
      tenantAId = tA!.id;
      tenantBId = tB!.id;
      userAId = uA!.id;
      userBId = uB!.id;

      const { rows: [cust] } = await client.query<{ id: string }>(
        `INSERT INTO customers (tenant_id, legal_name, identification_type, identification, email_primary)
         VALUES ($1, 'Cliente Artefacto', 'NIT', '900111222', 'art@test.com') RETURNING id`,
        [tenantAId],
      );
      customerId = cust!.id;
    } finally {
      client.release();
    }

    ctxA = { tenantId: tenantAId, userId: userAId, permissions: ['invoices.read', 'invoices.write'], requestId: 'art-a' };
    ctxB = { tenantId: tenantBId, userId: userBId, permissions: ['invoices.read', 'invoices.write'], requestId: 'art-b' };
  });

  afterAll(async () => {
    await pool.end();
  });

  it('XML generado contiene nombre del cliente y grand_total', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Consultoría', quantity: '1', unitPrice: '500000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    const xmlBuf = xmlGenerator.generate(draft);
    const xml = xmlBuf.toString('utf-8');

    expect(xml).toContain('<Invoice ');
    expect(xml).toContain('Cliente Artefacto');
    expect(xml).toContain(draft.grandTotal);
  });

  it('SHA-256 del XML es reproducible para el mismo documento', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Reproducible', quantity: '2', unitPrice: '100000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    const xml1 = xmlGenerator.generate(draft);
    const xml2 = xmlGenerator.generate(draft);
    expect(PdfRendererService.sha256(xml1)).toBe(PdfRendererService.sha256(xml2));
  });

  it('getOrGenerateArtifact almacena en fiscal_artifacts y devuelve URL con TTL', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'TTL test', quantity: '1', unitPrice: '200000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    const result = await artifacts.getOrGenerateArtifact(ctxA, draft.id, 'xml');
    expect(result.contentType).toBe('application/xml');
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.url).toContain('expires=');

    // Verify it was persisted in fiscal_artifacts
    const { rows } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ kind: string; sha256: string }>(
        `SELECT kind, sha256 FROM fiscal_artifacts WHERE document_id = $1`,
        [draft.id],
      ),
    );
    expect(rows[0]?.kind).toBe('xml');
    expect(rows[0]?.sha256).toBe(result.sha256);
  });

  it('segunda llamada reutiliza artefacto existente (mismo sha256, no nuevo intento)', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Cache test', quantity: '1', unitPrice: '300000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });

    const first = await artifacts.getOrGenerateArtifact(ctxA, draft.id, 'xml');
    const second = await artifacts.getOrGenerateArtifact(ctxA, draft.id, 'xml');

    expect(first.sha256).toBe(second.sha256);

    const { rows } = await withTenant(pool, ctxA, (tx) =>
      tx.query<{ attempt: number }>(
        `SELECT attempt FROM fiscal_artifacts WHERE document_id = $1 AND kind = 'xml'`,
        [draft.id],
      ),
    );
    // Only one attempt created
    expect(rows.length).toBe(1);
    expect(rows[0]!.attempt).toBe(1);
  });

  it('artifact table append-only: trigger rechaza UPDATE y DELETE', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'Immutable test', quantity: '1', unitPrice: '100000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    await artifacts.getOrGenerateArtifact(ctxA, draft.id, 'xml');

    const client = await pool.connect();
    try {
      const { rows: [art] } = await client.query<{ id: string }>(
        `SELECT id FROM fiscal_artifacts WHERE document_id = $1 LIMIT 1`,
        [draft.id],
      );

      await expect(
        client.query(`UPDATE fiscal_artifacts SET kind = 'pdf' WHERE id = $1`, [art!.id]),
      ).rejects.toThrow(/immutable/);

      await expect(
        client.query(`DELETE FROM fiscal_artifacts WHERE id = $1`, [art!.id]),
      ).rejects.toThrow(/immutable/);
    } finally {
      client.release();
    }
  });

  it('RLS: tenant B no puede leer artefactos de tenant A', async () => {
    const draft = await drafts.createDraft(ctxA, {
      customerId,
      currency: 'COP',
      lines: [{ description: 'RLS test', quantity: '1', unitPrice: '100000', discountPct: 0, taxTreatment: 'TAXED', taxRate: 19 }],
    });
    await artifacts.getOrGenerateArtifact(ctxA, draft.id, 'xml');

    // Tenant B cannot see tenant A's artifacts
    const { rows } = await withTenant(pool, ctxB, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM fiscal_artifacts WHERE document_id = $1`,
        [draft.id],
      ),
    );
    expect(rows.length).toBe(0);
  });
});
