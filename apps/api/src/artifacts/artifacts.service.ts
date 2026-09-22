import crypto from 'node:crypto';
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { XmlGeneratorService } from './xml-generator.service.js';
import { PdfRendererService } from './pdf-renderer.service.js';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider.js';
import type { DraftDocument } from '@nuvora/contracts';

export interface ArtifactDownloadResult {
  url: string;
  contentType: string;
  sha256: string;
}

interface ArtifactRow {
  id: string;
  document_id: string;
  kind: string;
  attempt: number;
  sha256: string;
  storage_key: string;
  content_type: string;
}

@Injectable()
export class ArtifactsService {
  private pool: pg.Pool;

  constructor(
    private readonly xmlGenerator: XmlGeneratorService,
    private readonly pdfRenderer: PdfRendererService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    customPool?: pg.Pool,
  ) {
    this.pool =
      customPool ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora',
      });
  }

  async getOrGenerateArtifact(
    ctx: RequestContext,
    documentId: string,
    kind: 'pdf' | 'xml',
  ): Promise<ArtifactDownloadResult> {
    return withTenant(this.pool, ctx, async (tx) => {
      // Check for existing artifact (most recent attempt)
      const { rows: existing } = await tx.query<ArtifactRow>(
        `SELECT * FROM fiscal_artifacts
         WHERE document_id = $1 AND kind = $2
         ORDER BY attempt DESC LIMIT 1`,
        [documentId, kind],
      );

      if (existing[0]) {
        const url = await this.storage.createDownloadUrl(existing[0].storage_key, 300);
        return { url, contentType: existing[0].content_type, sha256: existing[0].sha256 };
      }

      // Load document to generate artifact
      const doc = await this.loadDocument(tx, documentId, ctx.tenantId);
      if (!doc) throw new NotFoundException('Document not found');

      const { content, contentType } = kind === 'xml'
        ? { content: this.xmlGenerator.generate(doc), contentType: 'application/xml' }
        : { content: await this.pdfRenderer.render(doc), contentType: 'application/pdf' };

      const sha256 = crypto.createHash('sha256').update(content).digest('hex');
      const key = `${ctx.tenantId}/${documentId}/${kind}/1_${sha256.slice(0, 16)}`;

      const stored = await this.storage.putPrivate({ key, body: content, contentType });

      await tx.query(
        `INSERT INTO fiscal_artifacts
           (tenant_id, document_id, kind, attempt, sha256, storage_key, content_type, size_bytes)
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7)`,
        [ctx.tenantId, documentId, kind, sha256, stored.key, contentType, stored.sizeBytes],
      );

      const url = await this.storage.createDownloadUrl(stored.key, 300);
      return { url, contentType, sha256 };
    });
  }

  /**
   * Creates a one-use render token for the internal PDF render endpoint.
   * The token is stored as a hash — raw value is returned once and not persisted.
   */
  async issueRenderToken(
    ctx: RequestContext,
    documentId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60_000); // 60 seconds

    await withTenant(this.pool, ctx, async (tx) => {
      await tx.query(
        `INSERT INTO render_tokens (token_hash, tenant_id, document_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [tokenHash, ctx.tenantId, documentId, expiresAt.toISOString()],
      );
    });

    return { token: rawToken, expiresAt };
  }

  async validateAndConsumeRenderToken(
    rawToken: string,
    documentId: string,
  ): Promise<{ tenantId: string }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const client = await this.pool.connect();
    try {
      const { rows } = await client.query<{
        tenant_id: string; used: boolean; expires_at: Date;
      }>(
        `UPDATE render_tokens
         SET used = TRUE
         WHERE token_hash = $1 AND document_id = $2 AND used = FALSE AND expires_at > NOW()
         RETURNING tenant_id, used, expires_at`,
        [tokenHash, documentId],
      );
      if (!rows[0]) throw new ForbiddenException('Invalid or expired render token');
      return { tenantId: rows[0].tenant_id };
    } finally {
      client.release();
    }
  }

  private async loadDocument(
    tx: pg.PoolClient,
    documentId: string,
    tenantId: string,
  ): Promise<DraftDocument | null> {
    const { rows } = await tx.query<{
      id: string; tenant_id: string; document_type: string; status: string; version: number;
      customer_snapshot: DraftDocument['customerSnapshot']; currency: string; issue_date: string;
      due_date: string | null; notes: string | null; subtotal: string; total_tax: string;
      grand_total: string; created_by: string | null; created_at: Date; updated_at: Date;
      customer_id: string | null; number_prefix: string | null; document_number: string | null;
      cude: string | null;
    }>(
      `SELECT fd.* FROM fiscal_documents fd WHERE fd.id = $1 AND fd.tenant_id = $2`,
      [documentId, tenantId],
    );

    const row = rows[0];
    if (!row) return null;

    const { rows: lines } = await tx.query(
      `SELECT * FROM fiscal_document_lines WHERE document_id = $1 ORDER BY position`,
      [documentId],
    );
    const { rows: taxes } = await tx.query(
      `SELECT * FROM fiscal_document_taxes WHERE document_id = $1`,
      [documentId],
    );

    return {
      id: row.id,
      tenantId: row.tenant_id,
      documentType: row.document_type as DraftDocument['documentType'],
      status: row.status as DraftDocument['status'],
      version: row.version,
      customerId: row.customer_id,
      customerSnapshot: row.customer_snapshot,
      currency: row.currency,
      issueDate: typeof row.issue_date === 'string'
        ? row.issue_date
        : (row.issue_date as Date).toISOString().slice(0, 10),
      dueDate: row.due_date ?? null,
      notes: row.notes,
      subtotal: parseFloat(row.subtotal).toFixed(2),
      totalTax: parseFloat(row.total_tax).toFixed(2),
      grandTotal: parseFloat(row.grand_total).toFixed(2),
      numberPrefix: row.number_prefix,
      documentNumber: row.document_number ? parseInt(row.document_number, 10) : null,
      cude: row.cude,
      lines: lines.map((l: Record<string, unknown>, i: number) => ({
        id: l['id'] as string,
        position: (l['position'] as number) ?? i,
        productId: l['product_id'] as string | null,
        description: l['description'] as string,
        quantity: l['quantity'] as string,
        unitPrice: parseFloat(l['unit_price'] as string).toFixed(2),
        discountPct: parseFloat(l['discount_pct'] as string),
        taxTreatment: l['tax_treatment'] as string,
        taxRate: parseFloat(l['tax_rate'] as string),
        grossAmount: parseFloat(l['gross_amount'] as string).toFixed(2),
        discountAmount: parseFloat(l['discount_amount'] as string).toFixed(2),
        taxableBase: parseFloat(l['taxable_base'] as string).toFixed(2),
        taxAmount: parseFloat(l['tax_amount'] as string).toFixed(2),
        lineTotal: parseFloat(l['line_total'] as string).toFixed(2),
      })),
      taxSummary: taxes.map((t: Record<string, unknown>) => ({
        taxTreatment: t['tax_treatment'] as string,
        taxRate: parseFloat(t['tax_rate'] as string),
        taxableBase: parseFloat(t['taxable_base'] as string).toFixed(2),
        taxAmount: parseFloat(t['tax_amount'] as string).toFixed(2),
      })),
      aiu: null,
      createdBy: row.created_by,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}
