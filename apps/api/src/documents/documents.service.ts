/**
 * DocumentsService — Invoice Draft management.
 *
 * Architecture rules:
 *   - All fiscal calculation delegated to @nuvora/calculation-engine (pure)
 *   - All DB access via withTenant() — no raw pool queries outside it
 *   - Inputs and results persisted together in a single transaction
 *   - Only DRAFT documents can be mutated; others are immutable
 *   - Optimistic concurrency: version must match current DB version
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { calculateInvoice } from '@nuvora/calculation-engine';
import { DomainError } from '@nuvora/contracts';
import type {
  CreateDraftDto,
  PatchDraftDto,
  DraftDocument,
  DraftLine,
  DraftTaxSummary,
  DraftAIU,
  DraftListItem,
  PagedDraftResult,
  DraftCustomerSnapshot,
} from '@nuvora/contracts';
import { CreateDraftSchema, PatchDraftSchema } from '@nuvora/contracts';

// ─────────────────────────────────────────────
// Internal DB row types
// ─────────────────────────────────────────────

interface DocumentRow {
  id: string;
  tenant_id: string;
  document_type: string;
  status: string;
  version: number;
  customer_id: string | null;
  customer_snapshot: DraftCustomerSnapshot;
  currency: string;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  subtotal: string;
  total_tax: string;
  grand_total: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  number_prefix?: string | null;
  document_number?: string | null;
  cude?: string | null;
  source_document_id?: string | null;
  reason_code?: string | null;
}

interface LineRow {
  id: string;
  document_id: string;
  tenant_id: string;
  position: number;
  product_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  tax_treatment: string;
  tax_rate: string;
  gross_amount: string;
  discount_amount: string;
  taxable_base: string;
  tax_amount: string;
  line_total: string;
}

interface TaxRow {
  id: string;
  document_id: string;
  tenant_id: string;
  tax_treatment: string;
  tax_rate: string;
  taxable_base: string;
  tax_amount: string;
}

interface AIURow {
  id: string;
  document_id: string;
  tenant_id: string;
  base: string;
  administracion_pct: string;
  imprevistos_pct: string;
  utilidad_pct: string;
  iva_on_utilidad_pct: string;
  mode: string;
  minimum_base_limit: string | null;
  aiu_amount: string;
  u_amount: string;
  iva_amount: string;
  total: string;
  below_minimum: boolean;
}

interface CustomerRow {
  id: string;
  legal_name: string;
  identification_type: string;
  identification: string;
  dv: string | null;
  email_primary: string;
  address: string | null;
  municipality: string | null;
  department: string | null;
  country: string;
}

// ─────────────────────────────────────────────
// Mappers: DB rows → contract interfaces
// ─────────────────────────────────────────────

function toMoney(v: string): string {
  // Ensure 2 decimal places for Money display values
  const n = parseFloat(v);
  return n.toFixed(2);
}

function mapLine(row: LineRow, idx: number): DraftLine {
  return {
    id: row.id,
    position: row.position ?? idx,
    productId: row.product_id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: toMoney(row.unit_price),
    discountPct: parseFloat(row.discount_pct),
    taxTreatment: row.tax_treatment,
    taxRate: parseFloat(row.tax_rate),
    grossAmount: toMoney(row.gross_amount),
    discountAmount: toMoney(row.discount_amount),
    taxableBase: toMoney(row.taxable_base),
    taxAmount: toMoney(row.tax_amount),
    lineTotal: toMoney(row.line_total),
  };
}

function mapTaxSummary(row: TaxRow): DraftTaxSummary {
  return {
    taxTreatment: row.tax_treatment,
    taxRate: parseFloat(row.tax_rate),
    taxableBase: toMoney(row.taxable_base),
    taxAmount: toMoney(row.tax_amount),
  };
}

function mapAIU(row: AIURow): DraftAIU {
  return {
    base: toMoney(row.base),
    administracionPct: parseFloat(row.administracion_pct),
    imprevistoPct: parseFloat(row.imprevistos_pct),
    utilidadPct: parseFloat(row.utilidad_pct),
    ivaOnUtilidadPct: parseFloat(row.iva_on_utilidad_pct),
    mode: row.mode,
    minimumBaseLimit: row.minimum_base_limit ? toMoney(row.minimum_base_limit) : null,
    aiuAmount: toMoney(row.aiu_amount),
    uAmount: toMoney(row.u_amount),
    ivaAmount: toMoney(row.iva_amount),
    total: toMoney(row.total),
    belowMinimum: row.below_minimum,
  };
}

function mapDocument(
  doc: DocumentRow,
  lines: LineRow[],
  taxes: TaxRow[],
  aiu: AIURow | null,
): DraftDocument {
  return {
    id: doc.id,
    tenantId: doc.tenant_id,
    documentType: doc.document_type as DraftDocument['documentType'],
    status: doc.status as DraftDocument['status'],
    version: doc.version,
    customerId: doc.customer_id,
    customerSnapshot: doc.customer_snapshot,
    currency: doc.currency,
    issueDate: typeof doc.issue_date === 'string'
      ? doc.issue_date
      : (doc.issue_date as Date).toISOString().slice(0, 10),
    dueDate: doc.due_date
      ? (typeof doc.due_date === 'string'
          ? doc.due_date
          : (doc.due_date as unknown as Date).toISOString().slice(0, 10))
      : null,
    notes: doc.notes,
    subtotal: toMoney(doc.subtotal),
    totalTax: toMoney(doc.total_tax),
    grandTotal: toMoney(doc.grand_total),
    lines: lines.map((l, i) => mapLine(l, i)),
    taxSummary: taxes.map(mapTaxSummary),
    aiu: aiu ? mapAIU(aiu) : null,
    ...(doc.number_prefix ? { numberPrefix: doc.number_prefix } : {}),
    ...(doc.document_number ? { documentNumber: doc.document_number } : {}),
    ...(doc.cude ? { cude: doc.cude } : {}),
    sourceDocumentId: doc.source_document_id ?? null,
    reasonCode: doc.reason_code ?? null,
    createdBy: doc.created_by,
    createdAt: doc.created_at.toISOString(),
    updatedAt: doc.updated_at.toISOString(),
  };
}

// ─────────────────────────────────────────────
// Cursor-based pagination helpers
// ─────────────────────────────────────────────

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      id: string;
      createdAt: string;
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

@Injectable()
export class DocumentsService {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool =
      customPool ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ??
          'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev',
      });
  }

  // ─────────────────────────────────────────────
  // createDraft
  // ─────────────────────────────────────────────

  async createDraft(ctx: RequestContext, dto: CreateDraftDto): Promise<DraftDocument> {
    const parsed = CreateDraftSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }

    // Compute calculations BEFORE the transaction (pure, no side-effects)
    let calcResult;
    try {
      calcResult = calculateInvoice({
        lines: parsed.data.lines,
        aiu: parsed.data.aiu,
        currency: parsed.data.currency,
      });
    } catch (err) {
      if (err instanceof DomainError) {
        throw new BadRequestException(`Calculation error: ${err.message}`);
      }
      throw err;
    }

    return withTenant(this.pool, ctx, async (tx) => {
      // 1. Load and snapshot the customer
      const custRes = await tx.query<CustomerRow>(
        `SELECT id, legal_name, identification_type, identification, dv,
                email_primary, address, municipality, department, country
         FROM customers WHERE id = $1`,
        [parsed.data.customerId],
      );
      if (!custRes.rows[0]) {
        throw new NotFoundException(`Customer ${parsed.data.customerId} not found`);
      }
      const cust = custRes.rows[0];
      const snapshot: DraftCustomerSnapshot = {
        id: cust.id,
        legalName: cust.legal_name,
        identificationType: cust.identification_type,
        identification: cust.identification,
        dv: cust.dv,
        emailPrimary: cust.email_primary,
        address: cust.address,
        municipality: cust.municipality,
        department: cust.department,
        country: cust.country,
      };

      // 2. Insert fiscal_document
      const docRes = await tx.query<DocumentRow>(
        `INSERT INTO fiscal_documents (
          tenant_id, document_type, status, version,
          customer_id, customer_snapshot, currency,
          issue_date, due_date, notes,
          subtotal, total_tax, grand_total, created_by
        ) VALUES (
          $1, 'INVOICE', 'DRAFT', 1,
          $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11
        ) RETURNING *`,
        [
          ctx.tenantId,
          parsed.data.customerId,
          JSON.stringify(snapshot),
          parsed.data.currency ?? 'COP',
          parsed.data.issueDate ?? new Date().toISOString().slice(0, 10),
          parsed.data.dueDate ?? null,
          parsed.data.notes ?? null,
          calcResult.subtotal,
          calcResult.totalTax,
          calcResult.grandTotal,
          ctx.userId,
        ],
      );
      const doc = docRes.rows[0]!;

      // 3. Insert lines
      const lineRows: LineRow[] = [];
      for (let i = 0; i < calcResult.lines.length; i++) {
        const inputLine = parsed.data.lines[i]!;
        const calcLine = calcResult.lines[i]!;
        const lRes = await tx.query<LineRow>(
          `INSERT INTO fiscal_document_lines (
            document_id, tenant_id, position,
            description, quantity, unit_price, discount_pct,
            tax_treatment, tax_rate,
            gross_amount, discount_amount, taxable_base, tax_amount, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            doc.id, ctx.tenantId, i,
            inputLine.description,
            inputLine.quantity,
            inputLine.unitPrice,
            inputLine.discountPct ?? 0,
            inputLine.taxTreatment,
            inputLine.taxRate ?? 0,
            calcLine.grossAmount,
            calcLine.discountAmount,
            calcLine.taxableBase,
            calcLine.taxAmount,
            calcLine.lineTotal,
          ],
        );
        lineRows.push(lRes.rows[0]!);
      }

      // 4. Insert tax summaries
      const taxRows: TaxRow[] = [];
      for (const ts of calcResult.taxSummary) {
        const tRes = await tx.query<TaxRow>(
          `INSERT INTO fiscal_document_taxes (
            document_id, tenant_id, tax_treatment, tax_rate, taxable_base, tax_amount
          ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [doc.id, ctx.tenantId, ts.taxTreatment, ts.taxRate, ts.taxableBase, ts.taxAmount],
        );
        taxRows.push(tRes.rows[0]!);
      }

      // 5. Insert AIU if present
      let aiuRow: AIURow | null = null;
      if (calcResult.aiu && parsed.data.aiu) {
        const aiu = calcResult.aiu;
        const aiuInput = parsed.data.aiu;
        const aRes = await tx.query<AIURow>(
          `INSERT INTO fiscal_document_aiu (
            document_id, tenant_id,
            base, administracion_pct, imprevistos_pct, utilidad_pct, iva_on_utilidad_pct,
            mode, minimum_base_limit,
            aiu_amount, u_amount, iva_amount, total, below_minimum
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            doc.id, ctx.tenantId,
            aiuInput.base,
            aiuInput.administracionPct,
            aiuInput.imprevistosPct,
            aiuInput.utilidadPct,
            aiuInput.ivaOnUtilidadPct ?? 0,
            aiuInput.mode ?? 'SPECIAL',
            aiuInput.minimumBaseLimit ?? null,
            aiu.aiuAmount,
            aiu.uAmount,
            aiu.ivaAmount,
            aiu.total,
            aiu.belowMinimum,
          ],
        );
        aiuRow = aRes.rows[0]!;
      }

      return mapDocument(doc, lineRows, taxRows, aiuRow);
    });
  }

  // ─────────────────────────────────────────────
  // getDraft
  // ─────────────────────────────────────────────

  async getDraft(ctx: RequestContext, id: string): Promise<DraftDocument> {
    return withTenant(this.pool, ctx, async (tx) => {
      const docRes = await tx.query<DocumentRow>(
        `SELECT * FROM fiscal_documents WHERE id = $1`,
        [id],
      );
      if (!docRes.rows[0]) throw new NotFoundException(`Invoice ${id} not found`);

      const doc = docRes.rows[0];
      const lineRes = await tx.query<LineRow>(
        `SELECT * FROM fiscal_document_lines WHERE document_id = $1 ORDER BY position`,
        [doc.id],
      );
      const taxRes = await tx.query<TaxRow>(
        `SELECT * FROM fiscal_document_taxes WHERE document_id = $1`,
        [doc.id],
      );
      const aiuRes = await tx.query<AIURow>(
        `SELECT * FROM fiscal_document_aiu WHERE document_id = $1`,
        [doc.id],
      );

      return mapDocument(doc, lineRes.rows, taxRes.rows, aiuRes.rows[0] ?? null);
    });
  }

  // ─────────────────────────────────────────────
  // listDrafts
  // ─────────────────────────────────────────────

  async listDrafts(
    ctx: RequestContext,
    opts: { cursor?: string | undefined; limit?: number | undefined; status?: string | undefined },
  ): Promise<PagedDraftResult> {
    const limit = Math.min(opts.limit ?? 20, 100);
    return withTenant(this.pool, ctx, async (tx) => {
      const cursorData = opts.cursor ? decodeCursor(opts.cursor) : null;
      const params: unknown[] = [];
      let where = 'WHERE 1=1';

      if (opts.status) {
        params.push(opts.status);
        where += ` AND fd.status = $${params.length}`;
      }

      if (cursorData) {
        params.push(cursorData.createdAt, cursorData.id);
        where += ` AND (fd.created_at, fd.id) < ($${params.length - 1}, $${params.length})`;
      }

      const countRes = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM fiscal_documents fd ${where}`,
        params,
      );
      const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

      params.push(limit + 1);
      const dataRes = await tx.query<
        DocumentRow & { customer_name: string }
      >(
        `SELECT fd.*,
                COALESCE((fd.customer_snapshot->>'legalName')::text, 'Sin cliente') AS customer_name
         FROM fiscal_documents fd
         ${where}
         ORDER BY fd.created_at DESC, fd.id DESC
         LIMIT $${params.length}`,
        params,
      );

      const rows = dataRes.rows;
      let nextCursor: string | null = null;
      if (rows.length > limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = encodeCursor(last.id, last.created_at);
      }

      const data: DraftListItem[] = rows.map((r) => ({
        id: r.id,
        documentType: r.document_type as DraftListItem['documentType'],
        status: r.status as DraftListItem['status'],
        version: r.version,
        customerName: r.customer_name,
        currency: r.currency,
        grandTotal: toMoney(r.grand_total),
        issueDate: typeof r.issue_date === 'string'
          ? r.issue_date
          : (r.issue_date as unknown as Date).toISOString().slice(0, 10),
        createdAt: r.created_at.toISOString(),
      }));

      return { data, cursor: nextCursor, total };
    });
  }

  // ─────────────────────────────────────────────
  // patchDraft
  // ─────────────────────────────────────────────

  async patchDraft(ctx: RequestContext, id: string, dto: PatchDraftDto): Promise<DraftDocument> {
    const parsed = PatchDraftSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }

    return withTenant(this.pool, ctx, async (tx) => {
      // 1. Load document with lock
      const docRes = await tx.query<DocumentRow>(
        `SELECT * FROM fiscal_documents WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!docRes.rows[0]) throw new NotFoundException(`Invoice ${id} not found`);

      const doc = docRes.rows[0];

      // 2. Guard: only DRAFT can be mutated
      if (doc.status !== 'DRAFT') {
        throw new UnprocessableEntityException(
          `Cannot modify invoice in status '${doc.status}'. Only DRAFT invoices can be edited.`,
        );
      }

      // 3. Guard: optimistic concurrency check
      if (doc.version !== parsed.data.version) {
        throw new ConflictException(
          `Version conflict: document is at version ${doc.version}, you sent version ${parsed.data.version}. Please reload and try again.`,
        );
      }

      // 4. Build updated inputs by merging patch onto current state
      const currentLineRes = await tx.query<LineRow>(
        `SELECT * FROM fiscal_document_lines WHERE document_id = $1 ORDER BY position`,
        [id],
      );

      const newLines = parsed.data.lines
        ? parsed.data.lines
        : currentLineRes.rows.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unit_price,
            discountPct: parseFloat(l.discount_pct),
            taxTreatment: l.tax_treatment as 'TAXED' | 'EXEMPT' | 'EXCLUDED' | 'NON_TAXED',
            taxRate: parseFloat(l.tax_rate),
          }));

      // Load current AIU if not provided in patch
      const currentAIURes = await tx.query<AIURow>(
        `SELECT * FROM fiscal_document_aiu WHERE document_id = $1`,
        [id],
      );
      const currentAIU = currentAIURes.rows[0] ?? null;

      const newAIU =
        parsed.data.aiu !== undefined
          ? parsed.data.aiu
          : currentAIU
          ? {
              base: currentAIU.base,
              administracionPct: parseFloat(currentAIU.administracion_pct),
              imprevistosPct: parseFloat(currentAIU.imprevistos_pct),
              utilidadPct: parseFloat(currentAIU.utilidad_pct),
              ivaOnUtilidadPct: parseFloat(currentAIU.iva_on_utilidad_pct),
              mode: currentAIU.mode as 'SPECIAL' | 'INFORMATIVE' | 'NONE',
              minimumBaseLimit: currentAIU.minimum_base_limit ?? undefined,
            }
          : undefined;

      // 5. Recalculate
      let calcResult;
      try {
        calcResult = calculateInvoice({
          lines: newLines,
          aiu: newAIU ?? undefined,
          currency: doc.currency,
        });
      } catch (err) {
        if (err instanceof DomainError) {
          throw new BadRequestException(`Calculation error: ${err.message}`);
        }
        throw err;
      }

      // 6. Update main document (increment version)
      const newVersion = doc.version + 1;
      const fieldsToUpdate: string[] = [
        'subtotal = $1',
        'total_tax = $2',
        'grand_total = $3',
        'version = $4',
        'updated_at = NOW()',
      ];
      const updateParams: unknown[] = [
        calcResult.subtotal,
        calcResult.totalTax,
        calcResult.grandTotal,
        newVersion,
      ];
      let paramIdx = 5;

      if (parsed.data.notes !== undefined) {
        fieldsToUpdate.push(`notes = $${paramIdx++}`);
        updateParams.push(parsed.data.notes);
      }
      if (parsed.data.issueDate !== undefined) {
        fieldsToUpdate.push(`issue_date = $${paramIdx++}`);
        updateParams.push(parsed.data.issueDate);
      }
      if (parsed.data.dueDate !== undefined) {
        fieldsToUpdate.push(`due_date = $${paramIdx++}`);
        updateParams.push(parsed.data.dueDate);
      }

      // Customer snapshot update if customerId changes
      if (parsed.data.customerId) {
        const custRes = await tx.query<CustomerRow>(
          `SELECT id, legal_name, identification_type, identification, dv,
                  email_primary, address, municipality, department, country
           FROM customers WHERE id = $1`,
          [parsed.data.customerId],
        );
        if (!custRes.rows[0]) {
          throw new NotFoundException(`Customer ${parsed.data.customerId} not found`);
        }
        const cust = custRes.rows[0];
        const newSnapshot: DraftCustomerSnapshot = {
          id: cust.id,
          legalName: cust.legal_name,
          identificationType: cust.identification_type,
          identification: cust.identification,
          dv: cust.dv,
          emailPrimary: cust.email_primary,
          address: cust.address,
          municipality: cust.municipality,
          department: cust.department,
          country: cust.country,
        };
        fieldsToUpdate.push(`customer_id = $${paramIdx++}`);
        updateParams.push(parsed.data.customerId);
        fieldsToUpdate.push(`customer_snapshot = $${paramIdx++}`);
        updateParams.push(JSON.stringify(newSnapshot));
      }

      updateParams.push(id);
      const updatedDocRes = await tx.query<DocumentRow>(
        `UPDATE fiscal_documents SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        updateParams,
      );
      const updatedDoc = updatedDocRes.rows[0]!;

      // 7. Replace lines (delete old, insert new)
      await tx.query(`DELETE FROM fiscal_document_lines WHERE document_id = $1`, [id]);
      const lineRows: LineRow[] = [];
      for (let i = 0; i < calcResult.lines.length; i++) {
        const inputLine = newLines[i]!;
        const calcLine = calcResult.lines[i]!;
        const lRes = await tx.query<LineRow>(
          `INSERT INTO fiscal_document_lines (
            document_id, tenant_id, position,
            description, quantity, unit_price, discount_pct,
            tax_treatment, tax_rate,
            gross_amount, discount_amount, taxable_base, tax_amount, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            id, ctx.tenantId, i,
            inputLine.description,
            inputLine.quantity,
            inputLine.unitPrice,
            inputLine.discountPct ?? 0,
            inputLine.taxTreatment,
            inputLine.taxRate ?? 0,
            calcLine.grossAmount,
            calcLine.discountAmount,
            calcLine.taxableBase,
            calcLine.taxAmount,
            calcLine.lineTotal,
          ],
        );
        lineRows.push(lRes.rows[0]!);
      }

      // 8. Replace tax summaries
      await tx.query(`DELETE FROM fiscal_document_taxes WHERE document_id = $1`, [id]);
      const taxRows: TaxRow[] = [];
      for (const ts of calcResult.taxSummary) {
        const tRes = await tx.query<TaxRow>(
          `INSERT INTO fiscal_document_taxes (
            document_id, tenant_id, tax_treatment, tax_rate, taxable_base, tax_amount
          ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [id, ctx.tenantId, ts.taxTreatment, ts.taxRate, ts.taxableBase, ts.taxAmount],
        );
        taxRows.push(tRes.rows[0]!);
      }

      // 9. Replace AIU
      await tx.query(`DELETE FROM fiscal_document_aiu WHERE document_id = $1`, [id]);
      let aiuRow: AIURow | null = null;
      if (calcResult.aiu && newAIU) {
        const aiu = calcResult.aiu;
        const aRes = await tx.query<AIURow>(
          `INSERT INTO fiscal_document_aiu (
            document_id, tenant_id,
            base, administracion_pct, imprevistos_pct, utilidad_pct, iva_on_utilidad_pct,
            mode, minimum_base_limit,
            aiu_amount, u_amount, iva_amount, total, below_minimum
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            id, ctx.tenantId,
            newAIU.base,
            newAIU.administracionPct,
            newAIU.imprevistosPct,
            newAIU.utilidadPct,
            newAIU.ivaOnUtilidadPct ?? 0,
            newAIU.mode ?? 'SPECIAL',
            newAIU.minimumBaseLimit ?? null,
            aiu.aiuAmount,
            aiu.uAmount,
            aiu.ivaAmount,
            aiu.total,
            aiu.belowMinimum,
          ],
        );
        aiuRow = aRes.rows[0]!;
      }

      return mapDocument(updatedDoc, lineRows, taxRows, aiuRow);
    });
  }
}
