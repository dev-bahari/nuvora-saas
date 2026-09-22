import {
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { NumberingService } from '../numbering/numbering.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MockDianProvider } from '../dian/mock-dian.provider.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import type { DraftDocument } from '@nuvora/contracts';
import type { AccountingService } from '../accounting/accounting.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { CufeService } from '../artifacts/cufe.service.js';

interface DocumentStatusRow {
  id: string;
  status: string;
  version: number;
}

@Injectable()
export class IssueDocumentService {
  private readonly logger = new Logger(IssueDocumentService.name);
  private pool: pg.Pool;

  private readonly cufe = new CufeService();

  constructor(
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly dian: MockDianProvider,
    // ponytail: optional customPool for test injection; production uses env var
    customPool?: pg.Pool,
    @Optional() private readonly accounting?: AccountingService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {
    this.pool =
      customPool ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora',
      });
  }

  /**
   * Issues a DRAFT document:
   * 1. Validate status and idempotency key
   * 2. Reserve sequence number (in transaction)
   * 3. Transition DRAFT → PROCESSING and write outbox job
   * 4. Audit event
   * 5. Process outbox synchronously (MockDianProvider is instant)
   */
  async issue(
    ctx: RequestContext,
    documentId: string,
    idempotencyKey?: string,
  ): Promise<DraftDocument> {
    let finalStatus: 'ISSUED' | 'REJECTED' = 'ISSUED';

    const issued = await withTenant(this.pool, ctx, async (tx) => {
      // Idempotency check
      if (idempotencyKey) {
        const replay = await IdempotencyService.begin(
          tx,
          ctx.tenantId,
          'invoices.issue',
          idempotencyKey,
          { documentId },
        );
        if (replay !== null) return replay as DraftDocument;
      }

      // Load and validate document
      const { rows: docRows } = await tx.query<DocumentStatusRow>(
        `SELECT id, status, version FROM fiscal_documents WHERE id = $1`,
        [documentId],
      );
      const doc = docRows[0];
      if (!doc) throw new NotFoundException('Invoice not found');
      if (doc.status !== 'DRAFT') {
        throw new UnprocessableEntityException(
          `Cannot issue document with status "${doc.status}"`,
        );
      }

      // Reserve number
      const reserved = await this.numbering.reserveNextNumber(tx, ctx.tenantId, 'INVOICE');

      // Load financial data + tenant settings to compute CUFE
      const { rows: [finRow] } = await tx.query<{
        subtotal: string; total_tax: string; grand_total: string; issue_date: string;
        customer_snapshot: { identification: string; identificationType?: string };
        tax_treatment_summary: Array<{ tax_treatment: string; tax_amount: string }>;
      }>(
        `SELECT fd.subtotal, fd.total_tax, fd.grand_total, fd.issue_date::text, fd.customer_snapshot,
                COALESCE(
                  json_agg(json_build_object('tax_treatment', fdt.tax_treatment, 'tax_amount', fdt.tax_amount))
                  FILTER (WHERE fdt.id IS NOT NULL), '[]'
                ) AS tax_treatment_summary
         FROM fiscal_documents fd
         LEFT JOIN fiscal_document_taxes fdt ON fdt.document_id = fd.id
         WHERE fd.id = $1
         GROUP BY fd.id`,
        [documentId],
      );

      const { rows: [settingsRow] } = await tx.query<{
        nit: string; dian_environment: string; dian_technical_key: string | null;
      }>(
        `SELECT nit, dian_environment, dian_technical_key FROM tenant_settings WHERE tenant_id = $1`,
        [ctx.tenantId],
      );

      const numFac = `${reserved.prefix ?? ''}${reserved.number}`;
      const horFac = CufeService.colombiaTime();
      const nitOfe = (settingsRow?.nit ?? '').replace(/[^0-9]/g, '');
      const numAdq = (finRow?.customer_snapshot?.identification ?? '').replace(/[^0-9a-zA-Z]/g, '');
      const tipoAmb: '1' | '2' = settingsRow?.dian_environment === 'PRODUCCION' ? '1' : '2';
      const sumTreatment = (treatment: string) =>
        Array.isArray(finRow?.tax_treatment_summary)
          ? (finRow!.tax_treatment_summary as Array<{ tax_treatment: string; tax_amount: string }>)
              .filter((t) => t.tax_treatment === treatment)
              .reduce((a, t) => a + parseFloat(t.tax_amount), 0)
              .toFixed(2)
          : '0.00';

      const computedCufe = finRow && nitOfe
        ? this.cufe.compute({
            numFac,
            fecFac: typeof finRow.issue_date === 'string'
              ? finRow.issue_date
              : new Date().toISOString().slice(0, 10),
            horFac,
            valFac: parseFloat(finRow.subtotal).toFixed(2),
            valImp01: sumTreatment('TAXED'),   // IVA
            valImp02: sumTreatment('INC'),     // Impuesto al Consumo
            valImp03: sumTreatment('ICA'),     // ICA (ext. future)
            valTot: parseFloat(finRow.grand_total).toFixed(2),
            nitOfe,
            numAdq,
            clTec: settingsRow?.dian_technical_key ?? '',
            tipoAmb,
          })
        : null;

      // Transition → PROCESSING and write outbox atomically
      await tx.query(
        `UPDATE fiscal_documents
         SET status = 'PROCESSING',
             number_prefix  = $1,
             document_number = $2,
             cude = COALESCE($5, cude),
             version = version + 1,
             updated_at = NOW()
         WHERE id = $3 AND version = $4`,
        [reserved.prefix, reserved.number, documentId, doc.version, computedCufe],
      );

      await tx.query(
        `INSERT INTO document_outbox (tenant_id, document_id, job_type, payload)
         VALUES ($1, $2, 'dian.submit', $3)`,
        [ctx.tenantId, documentId, JSON.stringify({ requestId: ctx.requestId })],
      );

      await this.audit.append(tx, {
        tenantId: ctx.tenantId,
        documentId,
        eventType: 'document.issue.started',
        actorId: ctx.userId,
        requestId: ctx.requestId,
        payload: { prefix: reserved.prefix, number: reserved.number },
      });

      // Process outbox immediately (MockDianProvider is synchronous)
      const dianResult = await this.dian.submit(documentId);
      finalStatus = dianResult.outcome === 'ACCEPTED' ? 'ISSUED' : 'REJECTED';

      await tx.query(
        `UPDATE fiscal_documents
         SET status = $1,
             dian_tracking_id = $2,
             rejection_reason = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [finalStatus, dianResult.trackingId, dianResult.rejectionReason ?? null, documentId],
      );

      await tx.query(
        `UPDATE document_outbox
         SET status = 'COMPLETED', updated_at = NOW()
         WHERE document_id = $1 AND job_type = 'dian.submit' AND status = 'IN_FLIGHT'`,
        [documentId],
      );

      await this.audit.append(tx, {
        tenantId: ctx.tenantId,
        documentId,
        eventType: `document.${finalStatus.toLowerCase()}`,
        actorId: ctx.userId,
        requestId: ctx.requestId,
        payload: {
          trackingId: dianResult.trackingId,
          rejectionReason: dianResult.rejectionReason,
        },
      });

      // Return updated document
      const { rows: updatedRows } = await tx.query<{
        id: string; tenant_id: string; document_type: string; status: string; version: number;
        customer_snapshot: unknown; currency: string; issue_date: string; due_date: string | null;
        notes: string | null; subtotal: string; total_tax: string; grand_total: string;
        created_by: string | null; created_at: Date; updated_at: Date; customer_id: string | null;
        number_prefix: string | null; document_number: string | null; cude: string | null;
      }>(
        `SELECT fd.* FROM fiscal_documents fd WHERE fd.id = $1`,
        [documentId],
      );

      const updated = updatedRows[0];
      if (!updated) throw new NotFoundException('Invoice not found after issue');

      const result: DraftDocument = {
        id: updated.id,
        tenantId: updated.tenant_id,
        documentType: updated.document_type as DraftDocument['documentType'],
        status: updated.status as DraftDocument['status'],
        version: updated.version,
        customerId: updated.customer_id,
        customerSnapshot: updated.customer_snapshot as DraftDocument['customerSnapshot'],
        currency: updated.currency,
        issueDate: typeof updated.issue_date === 'string'
          ? updated.issue_date
          : (updated.issue_date as Date).toISOString().slice(0, 10),
        dueDate: updated.due_date ?? null,
        notes: updated.notes,
        subtotal: parseFloat(updated.subtotal).toFixed(2),
        totalTax: parseFloat(updated.total_tax).toFixed(2),
        grandTotal: parseFloat(updated.grand_total).toFixed(2),
        numberPrefix: updated.number_prefix,
        documentNumber: updated.document_number ? parseInt(updated.document_number, 10) : null,
        cude: updated.cude,
        lines: [],
        taxSummary: [],
        aiu: null,
        createdBy: updated.created_by,
        createdAt: (updated.created_at as Date).toISOString(),
        updatedAt: (updated.updated_at as Date).toISOString(),
      };

      if (idempotencyKey) {
        await IdempotencyService.complete(
          tx,
          ctx.tenantId,
          'invoices.issue',
          idempotencyKey,
          result,
          documentId,
        );
      }

      return result;
    });

    // Post-transaction side effects (fire-and-forget; do not fail the issuance)
    if (finalStatus === 'ISSUED') {
      this.accounting?.recordIssuance(ctx, issued).catch((e) =>
        this.logger.warn(`Accounting failed for ${documentId}: ${String(e)}`),
      );
      this.notifications?.dispatch(ctx, 'invoice.issued', documentId, {
        documentNumber: issued.documentNumber,
        grandTotal: issued.grandTotal,
      }).catch((e) => this.logger.warn(`Notification failed: ${String(e)}`));
    } else {
      this.notifications?.dispatch(ctx, 'invoice.rejected', documentId, {
        documentNumber: issued.documentNumber,
      }).catch((e) => this.logger.warn(`Notification failed: ${String(e)}`));
    }

    return issued;
  }

  /**
   * Reprocesses any PENDING outbox jobs — used by the worker and by
   * recovery tests to simulate worker restart resilience.
   */
  async processOutbox(ctx: RequestContext): Promise<number> {
    let processed = 0;

    const { rows: pending } = await withTenant(this.pool, ctx, async (tx) => {
      return tx.query<{ id: string; document_id: string; payload: string }>(
        `SELECT id, document_id, payload
         FROM document_outbox
         WHERE tenant_id = $1 AND status = 'PENDING' AND next_attempt <= NOW()
         ORDER BY created_at
         LIMIT 50
         FOR UPDATE SKIP LOCKED`,
        [ctx.tenantId],
      );
    });

    for (const job of pending) {
      await withTenant(this.pool, ctx, async (tx) => {
        // Check if document already processed (idempotent retry)
        const { rows } = await tx.query<{ status: string; dian_tracking_id: string | null }>(
          `SELECT status, dian_tracking_id FROM fiscal_documents WHERE id = $1`,
          [job.document_id],
        );
        const doc = rows[0];
        if (!doc || doc.status === 'ISSUED' || doc.status === 'REJECTED') {
          await tx.query(
            `UPDATE document_outbox SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
            [job.id],
          );
          return;
        }

        // Mark in-flight
        await tx.query(
          `UPDATE document_outbox SET status = 'IN_FLIGHT', attempts = attempts + 1, updated_at = NOW() WHERE id = $1`,
          [job.id],
        );

        const dianResult = await this.dian.submit(job.document_id);
        const finalStatus = dianResult.outcome === 'ACCEPTED' ? 'ISSUED' : 'REJECTED';

        await tx.query(
          `UPDATE fiscal_documents
           SET status = $1, dian_tracking_id = $2, rejection_reason = $3, version = version + 1, updated_at = NOW()
           WHERE id = $4`,
          [finalStatus, dianResult.trackingId, dianResult.rejectionReason ?? null, job.document_id],
        );

        await tx.query(
          `UPDATE document_outbox SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
          [job.id],
        );

        await this.audit.append(tx, {
          tenantId: ctx.tenantId,
          documentId: job.document_id,
          eventType: `document.${finalStatus.toLowerCase()}.worker`,
          requestId: (JSON.parse(job.payload) as { requestId?: string }).requestId,
          payload: { trackingId: dianResult.trackingId },
        });
      });
      processed++;
    }

    return processed;
  }
}
