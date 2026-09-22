import crypto from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../../tenancy/tenant-transaction.js';
import type { RequestContext } from '../../tenancy/tenant-context.js';
import { NumberingService } from '../../numbering/numbering.service.js';
import { AuditService } from '../../audit/audit.service.js';
import type { DraftDocument } from '@nuvora/contracts';

// Reason codes that are valid for debit notes
const VALID_DEBIT_REASONS = new Set([
  'INTEREST',    // intereses de mora
  'EXTRA_COSTS', // gastos adicionales acordados
  'CORRECTION',  // corrección de errores en la factura original
]);

// If the purpose is "mayor valor" (higher value), recommend creating a new invoice instead
const HIGHER_VALUE_REASONS = new Set(['HIGHER_VALUE', 'PRICE_INCREASE']);

export interface CreateDebitNoteDto {
  reasonCode: string;
  date?: string | undefined;
  note?: string | undefined;
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxTreatment: string;
    taxRate: number;
  }>;
}

function mockCude(documentId: string): string {
  return `MOCK-CUDE-${crypto.createHash('sha256').update(documentId).digest('hex').slice(0, 24).toUpperCase()}`;
}

@Injectable()
export class DebitNotesService {
  private pool: pg.Pool;

  constructor(
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    customPool?: pg.Pool,
  ) {
    this.pool =
      customPool ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora',
      });
  }

  async create(
    ctx: RequestContext,
    sourceDocumentId: string,
    dto: CreateDebitNoteDto,
  ): Promise<DraftDocument> {
    if (HIGHER_VALUE_REASONS.has(dto.reasonCode)) {
      throw new BadRequestException(
        `Para mayor valor usa "Crear factura adicional" en lugar de nota débito (motivo: ${dto.reasonCode})`,
      );
    }
    if (!VALID_DEBIT_REASONS.has(dto.reasonCode)) {
      throw new BadRequestException(
        `Motivo "${dto.reasonCode}" no válido. Usa: ${[...VALID_DEBIT_REASONS].join(', ')}`,
      );
    }

    return withTenant(this.pool, ctx, async (tx) => {
      const { rows: sourceRows } = await tx.query<{
        id: string; status: string; customer_snapshot: DraftDocument['customerSnapshot']; currency: string;
      }>(
        `SELECT id, status, customer_snapshot, currency FROM fiscal_documents WHERE id = $1`,
        [sourceDocumentId],
      );
      const source = sourceRows[0];
      if (!source) throw new NotFoundException('Source invoice not found');
      if (source.status !== 'ISSUED') {
        throw new UnprocessableEntityException(
          `Cannot create debit note against document with status "${source.status}"`,
        );
      }

      const reserved = await this.numbering.reserveNextNumber(tx, ctx.tenantId, 'DEBIT_NOTE');
      const cude = mockCude(`${ctx.tenantId}:${sourceDocumentId}:${reserved.number}`);
      const issueDate = dto.date ?? new Date().toISOString().slice(0, 10);

      const { rows: ndRows } = await tx.query<{ id: string }>(
        `INSERT INTO fiscal_documents
           (tenant_id, document_type, status, version, customer_snapshot, currency,
            issue_date, notes, subtotal, total_tax, grand_total,
            source_document_id, cude, reason_code, number_prefix, document_number, created_by)
         VALUES ($1, 'DEBIT_NOTE', 'ISSUED', 1, $2, $3, $4::date, $5, 0, 0, 0, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          ctx.tenantId,
          JSON.stringify(source.customer_snapshot),
          source.currency,
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
      const ndId = ndRows[0]!.id;

      await this.audit.append(tx, {
        tenantId: ctx.tenantId,
        documentId: ndId,
        eventType: 'debit_note.issued',
        actorId: ctx.userId,
        requestId: ctx.requestId,
        payload: { sourceDocumentId, reasonCode: dto.reasonCode, cude },
      });

      const { rows } = await tx.query<{
        id: string; tenant_id: string; document_type: string; status: string; version: number;
        customer_snapshot: DraftDocument['customerSnapshot']; currency: string; issue_date: string;
        due_date: string | null; notes: string | null; subtotal: string; total_tax: string;
        grand_total: string; created_by: string | null; created_at: Date; updated_at: Date;
        number_prefix: string | null; document_number: string | null;
        source_document_id: string | null; cude: string | null; reason_code: string | null;
      }>(
        `SELECT * FROM fiscal_documents WHERE id = $1`,
        [ndId],
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
  }
}
