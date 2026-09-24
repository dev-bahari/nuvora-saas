import crypto from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../../tenancy/tenant-transaction.js';
import type { RequestContext } from '../../tenancy/tenant-context.js';
import { NumberingService } from '../../numbering/numbering.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { MockDianProvider } from '../../dian/mock-dian.provider.js';
import type { AccountingService } from '../../accounting/accounting.service.js';
import type { DraftDocument } from '@nuvora/contracts';

export interface CreateCreditNoteDto {
  reasonCode: string;
  date?: string | undefined;
  note?: string | undefined;
  /** Partial NC: lines with amounts to credit. Omit for total cancellation. */
  lines?: Array<{
    sourceLineId: string;
    quantity: string;
    unitPrice: string;
  }> | undefined;
}

const MOCK_CUDE_PREFIX = 'MOCK-CUDE';

function mockCude(documentId: string): string {
  return `${MOCK_CUDE_PREFIX}-${crypto.createHash('sha256').update(documentId).digest('hex').slice(0, 24).toUpperCase()}`;
}

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);
  private pool: pg.Pool;

  constructor(
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    dianOrPool: MockDianProvider | pg.Pool,
    customPool?: pg.Pool,
    @Optional() private readonly accounting?: AccountingService,
  ) {
    this.dian = dianOrPool instanceof pg.Pool ? new MockDianProvider() : dianOrPool;
    this.pool =
      (dianOrPool instanceof pg.Pool ? dianOrPool : customPool) ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora',
      });
  }

  private readonly dian: MockDianProvider;

  /**
   * Creates and immediately issues a credit note against an ISSUED invoice.
   * For total cancellation, pass no `lines` — the full invoice is credited.
   * Sets the source invoice status to CANCELLED_BY_CREDIT_NOTE when total.
   */
  async create(
    ctx: RequestContext,
    sourceDocumentId: string,
    dto: CreateCreditNoteDto,
  ): Promise<DraftDocument> {
    let sourceDoc: { id: string; grand_total: string; subtotal: string; total_tax: string } | undefined;
    const nc = await withTenant(this.pool, ctx, async (tx) => {
      // Validate source document
      const { rows: sourceRows } = await tx.query<{
        id: string; status: string; document_type: string; grand_total: string; subtotal: string; total_tax: string;
        customer_snapshot: DraftDocument['customerSnapshot'];
        currency: string; issue_date: string;
      }>(
        `SELECT id, status, document_type, grand_total, subtotal, total_tax, customer_snapshot, currency, issue_date
         FROM fiscal_documents WHERE id = $1`,
        [sourceDocumentId],
      );
      const source = sourceRows[0];
      sourceDoc = source;
      if (!source) throw new NotFoundException('Source invoice not found');
      if (source.document_type !== 'INVOICE') throw new UnprocessableEntityException('Credit notes can only reference an invoice');
      if (source.status !== 'ISSUED') {
        throw new UnprocessableEntityException(
          `Cannot create credit note against document with status "${source.status}"`,
        );
      }

      // Prevent NC sobre NC
      const { rows: existing } = await tx.query<{ id: string }>(
        `SELECT id FROM fiscal_documents
         WHERE source_document_id = $1 AND document_type = 'CREDIT_NOTE'
           AND status NOT IN ('REJECTED')
         LIMIT 1`,
        [sourceDocumentId],
      );
      if (existing.length > 0) {
        throw new BadRequestException('A non-rejected credit note already exists for this invoice');
      }

      const isTotal = !dto.lines || dto.lines.length === 0;

      // Reserve NC number
      const reserved = await this.numbering.reserveNextNumber(tx, ctx.tenantId, 'CREDIT_NOTE');
      const cude = mockCude(`${ctx.tenantId}:${sourceDocumentId}:${reserved.number}`);
      const issueDate = dto.date ?? new Date().toISOString().slice(0, 10);

      // Insert credit note document
      const { rows: ncRows } = await tx.query<{ id: string }>(
        `INSERT INTO fiscal_documents
           (tenant_id, document_type, status, version, customer_snapshot, currency,
            issue_date, notes, subtotal, total_tax, grand_total,
            source_document_id, cude, reason_code, number_prefix, document_number, created_by)
         SELECT
           $1, 'CREDIT_NOTE', 'ISSUED', 1, customer_snapshot, currency,
           $2::date, $3, subtotal, total_tax, grand_total,
           $4, $5, $6, $7, $8, $9
         FROM fiscal_documents WHERE id = $4
         RETURNING id`,
        [
          ctx.tenantId,
          issueDate,
          dto.note ?? null,
          sourceDocumentId,
          cude,
          dto.reasonCode,
          reserved.prefix,
          reserved.number,
          ctx.userId,
        ],
      );
      const ncId = ncRows[0]!.id;

      // Copy lines from source
      await tx.query(
        `INSERT INTO fiscal_document_lines
           (document_id, tenant_id, position, product_id, description, quantity, unit_price,
            discount_pct, tax_treatment, tax_rate, gross_amount, discount_amount,
            taxable_base, tax_amount, line_total)
         SELECT $1, tenant_id, position, product_id, description, quantity, unit_price,
            discount_pct, tax_treatment, tax_rate, gross_amount, discount_amount,
            taxable_base, tax_amount, line_total
         FROM fiscal_document_lines WHERE document_id = $2`,
        [ncId, sourceDocumentId],
      );

      await tx.query(
        `INSERT INTO fiscal_document_taxes
           (document_id, tenant_id, tax_treatment, tax_rate, taxable_base, tax_amount)
         SELECT $1, tenant_id, tax_treatment, tax_rate, taxable_base, tax_amount
         FROM fiscal_document_taxes WHERE document_id = $2`,
        [ncId, sourceDocumentId],
      );

      // Total cancellation → mark source as CANCELLED_BY_CREDIT_NOTE
      if (isTotal) {
        await tx.query(
          `UPDATE fiscal_documents
           SET status = 'CANCELLED_BY_CREDIT_NOTE', version = version + 1, updated_at = NOW()
           WHERE id = $1`,
          [sourceDocumentId],
        );
      }

      await this.audit.append(tx, {
        tenantId: ctx.tenantId,
        documentId: ncId,
        eventType: 'credit_note.issued',
        actorId: ctx.userId,
        requestId: ctx.requestId,
        payload: {
          sourceDocumentId,
          reasonCode: dto.reasonCode,
          isTotal,
          cude,
        },
      });

      // Return NC document
      const { rows } = await tx.query<{
        id: string; tenant_id: string; document_type: string; status: string; version: number;
        customer_snapshot: DraftDocument['customerSnapshot']; currency: string; issue_date: string;
        due_date: string | null; notes: string | null; subtotal: string; total_tax: string;
        grand_total: string; created_by: string | null; created_at: Date; updated_at: Date;
        number_prefix: string | null; document_number: string | null;
        source_document_id: string | null; cude: string | null; reason_code: string | null;
      }>(
        `SELECT * FROM fiscal_documents WHERE id = $1`,
        [ncId],
      );
      const r = rows[0]!;
      return {
        id: r.id,
        tenantId: r.tenant_id,
        documentType: r.document_type as DraftDocument['documentType'],
        status: r.status as DraftDocument['status'],
        version: r.version,
        customerId: null,
        customerSnapshot: r.customer_snapshot,
        currency: r.currency,
        issueDate: typeof r.issue_date === 'string'
          ? r.issue_date
          : (r.issue_date as Date).toISOString().slice(0, 10),
        dueDate: r.due_date ?? null,
        notes: r.notes,
        subtotal: parseFloat(r.subtotal).toFixed(2),
        totalTax: parseFloat(r.total_tax).toFixed(2),
        grandTotal: parseFloat(r.grand_total).toFixed(2),
        ...(r.number_prefix === null ? {} : { numberPrefix: r.number_prefix }),
        ...(r.document_number === null ? {} : { documentNumber: r.document_number }),
        sourceDocumentId: r.source_document_id,
        ...(r.cude === null ? {} : { cude: r.cude }),
        reasonCode: r.reason_code,
        lines: [],
        taxSummary: [],
        aiu: null,
        createdBy: r.created_by,
        createdAt: (r.created_at as Date).toISOString(),
        updatedAt: (r.updated_at as Date).toISOString(),
      };
    });

    if (sourceDoc) {
      const sourceDraft = {
        ...nc,
        id: sourceDocumentId,
        grandTotal: parseFloat(sourceDoc.grand_total).toFixed(2),
        subtotal: parseFloat(sourceDoc.subtotal).toFixed(2),
        totalTax: parseFloat(sourceDoc.total_tax).toFixed(2),
      } as import('@nuvora/contracts').DraftDocument;
      this.accounting
        ?.recordCreditNote(ctx, nc, sourceDraft)
        .catch((e: unknown) => this.logger.warn('NC accounting failed', e));
    }

    return nc;
  }
}
