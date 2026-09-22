import { Injectable } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import type { DraftDocument } from '@nuvora/contracts';

export interface JournalEntry {
  readonly id: string;
  readonly documentId: string | null;
  readonly entryDate: string;
  readonly description: string;
  readonly lines: readonly JournalLine[];
}

export interface JournalLine {
  readonly id: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly debit: string;
  readonly credit: string;
}

type DbLine = {
  id: string;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
};

/**
 * AccountingService — records double-entry journal entries on document events.
 *
 * Entries are append-only (DB trigger prevents UPDATE/DELETE).
 * All monetary values come pre-calculated from DraftDocument (strings).
 *
 * ponytail: simple double-entry only; multi-currency conversion and
 * full PUC (Plan Único de Cuentas) mapping belong in T14/T15.
 */
@Injectable()
export class AccountingService {
  constructor(private readonly customPool?: pg.Pool) {}

  async recordIssuance(ctx: RequestContext, doc: DraftDocument): Promise<JournalEntry> {
    return withTenant(this.customPool ?? new pg.Pool(), ctx, async (tx) => {
      const entryDate = doc.issueDate;
      const description = `Emisión ${doc.documentType} ${doc.numberPrefix ?? ''}${doc.documentNumber ?? doc.id.slice(0, 8)}`;

      const { rows: [entry] } = await tx.query<{ id: string }>(
        `INSERT INTO journal_entries (tenant_id, document_id, entry_date, description)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [ctx.tenantId, doc.id, entryDate, description],
      );
      const entryId = entry!.id;

      // Debit: Cuentas por cobrar (1305); Credit: Ingresos por ventas (4135)
      const lines: Array<{ code: string; name: string; debit: string; credit: string }> = [
        { code: '1305', name: 'Clientes nacionales', debit: doc.grandTotal, credit: '0' },
        { code: '4135', name: 'Comercio al por menor', debit: '0', credit: doc.subtotal },
      ];
      if (parseFloat(doc.totalTax) > 0) {
        lines.push({ code: '2408', name: 'IVA por pagar', debit: '0', credit: doc.totalTax });
      }

      for (const l of lines) {
        await tx.query(
          `INSERT INTO journal_lines (entry_id, account_code, account_name, debit, credit)
           VALUES ($1, $2, $3, $4, $5)`,
          [entryId, l.code, l.name, l.debit, l.credit],
        );
      }

      const { rows: dbLines } = await tx.query<DbLine>(
        `SELECT id, account_code, account_name, debit, credit FROM journal_lines WHERE entry_id = $1`,
        [entryId],
      );

      return {
        id: entryId,
        documentId: doc.id,
        entryDate,
        description,
        lines: dbLines.map((r) => ({
          id: r.id,
          accountCode: r.account_code,
          accountName: r.account_name,
          debit: r.debit,
          credit: r.credit,
        })),
      };
    });
  }

  async recordCreditNote(ctx: RequestContext, nc: DraftDocument, source: DraftDocument): Promise<JournalEntry> {
    return withTenant(this.customPool ?? new pg.Pool(), ctx, async (tx) => {
      const description = `NC ${nc.numberPrefix ?? ''}${nc.documentNumber ?? nc.id.slice(0, 8)} sobre ${source.numberPrefix ?? ''}${source.documentNumber ?? source.id.slice(0, 8)}`;

      const { rows: [entry] } = await tx.query<{ id: string }>(
        `INSERT INTO journal_entries (tenant_id, document_id, entry_date, description)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [ctx.tenantId, nc.id, nc.issueDate, description],
      );
      const entryId = entry!.id;

      // Reverse: Debit income, credit receivable
      const lines = [
        { code: '4135', name: 'Comercio al por menor (reversa)', debit: nc.subtotal, credit: '0' },
        { code: '1305', name: 'Clientes nacionales (reversa)', debit: '0', credit: nc.grandTotal },
      ];
      if (parseFloat(nc.totalTax) > 0) {
        lines.push({ code: '2408', name: 'IVA por pagar (reversa)', debit: nc.totalTax, credit: '0' });
      }

      for (const l of lines) {
        await tx.query(
          `INSERT INTO journal_lines (entry_id, account_code, account_name, debit, credit)
           VALUES ($1, $2, $3, $4, $5)`,
          [entryId, l.code, l.name, l.debit, l.credit],
        );
      }

      const { rows: dbLines } = await tx.query<DbLine>(
        `SELECT id, account_code, account_name, debit, credit FROM journal_lines WHERE entry_id = $1`,
        [entryId],
      );

      return {
        id: entryId,
        documentId: nc.id,
        entryDate: nc.issueDate,
        description,
        lines: dbLines.map((r) => ({
          id: r.id,
          accountCode: r.account_code,
          accountName: r.account_name,
          debit: r.debit,
          credit: r.credit,
        })),
      };
    });
  }

  async listForDocument(ctx: RequestContext, documentId: string): Promise<JournalEntry[]> {
    return withTenant(this.customPool ?? new pg.Pool(), ctx, async (tx) => {
      const { rows: entries } = await tx.query<{ id: string; document_id: string; entry_date: string; description: string }>(
        `SELECT id, document_id, entry_date::text, description FROM journal_entries WHERE document_id = $1 ORDER BY created_at`,
        [documentId],
      );

      const result: JournalEntry[] = [];
      for (const e of entries) {
        const { rows: dbLines } = await tx.query<DbLine>(
          `SELECT id, account_code, account_name, debit::text, credit::text FROM journal_lines WHERE entry_id = $1`,
          [e.id],
        );
        result.push({
          id: e.id,
          documentId: e.document_id,
          entryDate: e.entry_date,
          description: e.description,
          lines: dbLines.map((r) => ({
            id: r.id,
            accountCode: r.account_code,
            accountName: r.account_name,
            debit: r.debit,
            credit: r.credit,
          })),
        });
      }
      return result;
    });
  }
}
