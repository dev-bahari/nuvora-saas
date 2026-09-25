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

interface DocumentStatusRow {
  id: string;
  status: string;
  version: number;
}

@Injectable()
export class IssueDocumentService {
  private readonly logger = new Logger(IssueDocumentService.name);
  private pool: pg.Pool;

  constructor(
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly dian: MockDianProvider,
    // ponytail: optional customPool for test injection; production uses env var
    @Optional() customPool?: pg.Pool,
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

      // Technical keys are encrypted DIAN credentials and must only be opened by
      // the asynchronous DIAN worker.  Issuance writes an immutable request;
      // the worker builds and signs the payload after the transaction commits.
      const computedCufe: string | null = null;

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
        [ctx.tenantId, documentId, JSON.stringify({ schemaVersion: 1, tenantId: ctx.tenantId, requestId: ctx.requestId, entityId: documentId, idempotencyKey: `dian.submit:${ctx.tenantId}:${documentId}`, payload: { documentId } })],
      );

      await this.audit.append(tx, {
        tenantId: ctx.tenantId,
        documentId,
        eventType: 'document.issue.started',
        actorId: ctx.userId,
        requestId: ctx.requestId,
        payload: { prefix: reserved.prefix, number: reserved.number },
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
        ...(updated.number_prefix === null ? {} : { numberPrefix: updated.number_prefix }),
        ...(updated.document_number === null ? {} : { documentNumber: updated.document_number }),
        ...(updated.cude === null ? {} : { cude: updated.cude }),
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

    // Provider I/O begins only after the fiscal transaction has committed.
    await this.processOutbox(ctx);
    const { rows: [current] } = await withTenant(this.pool, ctx, (tx) => tx.query<{
      status: DraftDocument['status']; version: number; dian_tracking_id: string | null; rejection_reason: string | null;
    }>(`SELECT status, version, dian_tracking_id, rejection_reason FROM fiscal_documents WHERE id = $1`, [documentId]));
    const finalized = current ? { ...issued, status: current.status, version: current.version } : issued;

    if (finalized.status === 'ISSUED') {
      this.accounting?.recordIssuance(ctx, finalized).catch((error) =>
        this.logger.warn(`Accounting failed for ${documentId}: ${String(error)}`),
      );
      this.notifications?.dispatch(ctx, 'invoice.issued', documentId, {
        documentNumber: finalized.documentNumber,
        grandTotal: finalized.grandTotal,
      }).catch((error) => this.logger.warn(`Notification failed: ${String(error)}`));
    } else if (finalized.status === 'REJECTED') {
      this.notifications?.dispatch(ctx, 'invoice.rejected', documentId, {
        documentNumber: finalized.documentNumber,
      }).catch((error) => this.logger.warn(`Notification failed: ${String(error)}`));
    }

    return finalized;
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
      const claimed = await withTenant(this.pool, ctx, async (tx) => {
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
          return false;
        }

        await tx.query(
          `UPDATE document_outbox SET status = 'IN_FLIGHT', attempts = attempts + 1, updated_at = NOW() WHERE id = $1`,
          [job.id],
        );
        return true;
      });
      if (!claimed) continue;

      try {
        // Network I/O is deliberately outside the fiscal database transaction.
        const dianResult = await this.dian.submit(job.document_id);
        const finalStatus = dianResult.outcome === 'ACCEPTED' ? 'ISSUED' : 'REJECTED';

        await withTenant(this.pool, ctx, async (tx) => {
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
          requestId: (typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload as { requestId?: string }).requestId,
          payload: { trackingId: dianResult.trackingId },
        });
        });
      } catch (error) {
        await withTenant(this.pool, ctx, (tx) => tx.query(
          `UPDATE document_outbox
           SET status = CASE WHEN attempts >= max_attempts THEN 'DEAD' ELSE 'PENDING' END,
               error = $2,
               next_attempt = NOW() + INTERVAL '30 seconds',
               updated_at = NOW()
           WHERE id = $1`,
          [job.id, error instanceof Error ? error.message : String(error)],
        ));
        throw error;
      }
      processed++;
    }

    return processed;
  }
}
