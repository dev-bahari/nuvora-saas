import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

export interface TaxRow {
  id: string;
  tenant_id: string;
  code: string;
  tax_type: string;
  rate: string; // NUMERIC serialized as string
  treatment: string;
  label: string;
  is_active: boolean;
}

export interface ProductRow {
  id: string;
  tenant_id: string;
  internal_code: string;
  standard_code: string | null;
  name: string;
  description: string | null;
  type: string;
  unit_of_measure: string;
  base_price: string; // NUMERIC(20,6) as string
  default_tax_id: string | null;
  tax_treatment: string;
  income_account_code: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductDto {
  internal_code: string;
  standard_code?: string;
  name: string;
  description?: string;
  type?: string;
  unit_of_measure?: string;
  base_price: string;
  default_tax_id?: string;
  tax_treatment?: string;
  income_account_code?: string;
}

export interface PatchProductDto {
  internal_code?: string;
  standard_code?: string;
  name?: string;
  description?: string;
  type?: string;
  unit_of_measure?: string;
  base_price?: string;
  default_tax_id?: string;
  tax_treatment?: string;
  income_account_code?: string;
  is_active?: boolean;
}

export interface PagedResult<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { id: string; createdAt: string };
  } catch {
    return null;
  }
}

@Injectable()
export class ProductsService {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool ?? new pg.Pool({
      connectionString:
        process.env['DATABASE_URL'] ??
        'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev',
    });
  }

  async listTaxes(ctx: RequestContext): Promise<TaxRow[]> {
    return withTenant(this.pool, ctx, async (tx) => {
      const res = await tx.query<TaxRow>(
        `SELECT id, tenant_id, code, tax_type, rate::text AS rate, treatment, label, is_active
         FROM taxes WHERE is_active = true ORDER BY treatment, rate DESC`,
      );
      return res.rows;
    });
  }

  async list(
    ctx: RequestContext,
    opts: { cursor?: string; limit?: number; search?: string; active?: boolean },
  ): Promise<PagedResult<ProductRow>> {
    const limit = Math.min(opts.limit ?? 20, 100);
    // Default active=true for selector usage
    const activeOnly = opts.active !== false;

    return withTenant(this.pool, ctx, async (tx) => {
      const cursorData = opts.cursor ? decodeCursor(opts.cursor) : null;
      const search = opts.search?.trim();

      const params: unknown[] = [];
      let where = activeOnly ? 'WHERE is_active = true' : 'WHERE 1=1';

      if (cursorData) {
        params.push(cursorData.createdAt, cursorData.id);
        where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
      }

      if (search) {
        params.push(`%${search}%`);
        const i = params.length;
        where += ` AND (name ILIKE $${i} OR internal_code ILIKE $${i})`;
      }

      const countRes = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM products ${where}`,
        params,
      );
      const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

      params.push(limit + 1);
      const dataRes = await tx.query<ProductRow>(
        `SELECT id, tenant_id, internal_code, standard_code, name, description, type,
                unit_of_measure, base_price::text AS base_price, default_tax_id, tax_treatment,
                income_account_code, is_active, created_at, updated_at
         FROM products ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
        params,
      );

      const rows = dataRes.rows;
      let nextCursor: string | null = null;
      if (rows.length > limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = encodeCursor(last.id, last.created_at);
      }

      return { data: rows, nextCursor, total };
    });
  }

  async findOne(ctx: RequestContext, id: string): Promise<ProductRow> {
    return withTenant(this.pool, ctx, async (tx) => {
      const res = await tx.query<ProductRow>(
        `SELECT id, tenant_id, internal_code, standard_code, name, description, type,
                unit_of_measure, base_price::text AS base_price, default_tax_id, tax_treatment,
                income_account_code, is_active, created_at, updated_at
         FROM products WHERE id = $1`,
        [id],
      );
      if (!res.rows[0]) throw new NotFoundException(`Product ${id} not found`);
      return res.rows[0];
    });
  }

  async create(ctx: RequestContext, dto: CreateProductDto): Promise<ProductRow> {
    return withTenant(this.pool, ctx, async (tx) => {
      try {
        const res = await tx.query<ProductRow>(
          `INSERT INTO products (
            tenant_id, internal_code, standard_code, name, description,
            type, unit_of_measure, base_price, default_tax_id, tax_treatment, income_account_code
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING id, tenant_id, internal_code, standard_code, name, description, type,
                    unit_of_measure, base_price::text AS base_price, default_tax_id, tax_treatment,
                    income_account_code, is_active, created_at, updated_at`,
          [
            ctx.tenantId,
            dto.internal_code,
            dto.standard_code ?? null,
            dto.name,
            dto.description ?? null,
            dto.type ?? 'PRODUCT',
            dto.unit_of_measure ?? 'UNIT',
            dto.base_price,
            dto.default_tax_id ?? null,
            dto.tax_treatment ?? 'TAXED',
            dto.income_account_code ?? null,
          ],
        );
        return res.rows[0]!;
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          throw new ConflictException('Product with this internal_code already exists for this tenant');
        }
        throw err;
      }
    });
  }

  async patch(ctx: RequestContext, id: string, dto: PatchProductDto): Promise<ProductRow> {
    return withTenant(this.pool, ctx, async (tx) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      for (const [key, val] of Object.entries(dto)) {
        if (val !== undefined) {
          fields.push(`${key} = $${i++}`);
          values.push(val);
        }
      }

      if (fields.length === 0) {
        return this.findOne(ctx, id);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await tx.query<ProductRow>(
        `UPDATE products SET ${fields.join(', ')} WHERE id = $${i}
         RETURNING id, tenant_id, internal_code, standard_code, name, description, type,
                   unit_of_measure, base_price::text AS base_price, default_tax_id, tax_treatment,
                   income_account_code, is_active, created_at, updated_at`,
        values,
      );

      if (!res.rows[0]) throw new NotFoundException(`Product ${id} not found`);
      return res.rows[0];
    });
  }
}
