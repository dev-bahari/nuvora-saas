import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

// ---------- Zod schemas ----------

const customerBaseSchema = z.object({
  type: z.enum(['NATURAL_PERSON', 'LEGAL_ENTITY']).optional(),
  identification_type: z.string().min(1),
  identification: z.string().min(1),
  dv: z.string().optional(),
  legal_name: z.string().min(1),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  fiscal_responsibilities: z.array(z.string()).optional(),
  email_primary: z.string().email(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  municipality: z.string().optional(),
  department: z.string().optional(),
  country: z.string().optional(),
  contact_name: z.string().optional(),
  internal_notes: z.string().optional(),
});

export const createCustomerSchema = customerBaseSchema;
export const patchCustomerSchema = customerBaseSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// Allowlist of patchable columns
const CUSTOMER_PATCH_ALLOWLIST = new Set([
  'type','identification_type','identification','dv','legal_name','first_name','last_name',
  'fiscal_responsibilities','email_primary','phone','whatsapp','address','municipality',
  'department','country','contact_name','internal_notes','is_active',
]);

export interface CustomerRow {
  id: string;
  tenant_id: string;
  type: string;
  identification_type: string;
  identification: string;
  dv: string | null;
  legal_name: string;
  first_name: string | null;
  last_name: string | null;
  fiscal_responsibilities: string[];
  email_primary: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  municipality: string | null;
  department: string | null;
  country: string;
  contact_name: string | null;
  internal_notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCustomerDto {
  type?: string;
  identification_type: string;
  identification: string;
  dv?: string;
  legal_name: string;
  first_name?: string;
  last_name?: string;
  fiscal_responsibilities?: string[];
  email_primary: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  municipality?: string;
  department?: string;
  country?: string;
  contact_name?: string;
  internal_notes?: string;
}

export interface PatchCustomerDto {
  type?: string;
  legal_name?: string;
  first_name?: string;
  last_name?: string;
  fiscal_responsibilities?: string[];
  email_primary?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  municipality?: string;
  department?: string;
  country?: string;
  contact_name?: string;
  internal_notes?: string;
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
export class CustomersService {
  private pool: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool ?? new pg.Pool({
      connectionString:
        process.env['DATABASE_URL'] ??
        'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_dev',
    });
  }

  async list(
    ctx: RequestContext,
    opts: { cursor?: string | undefined; limit?: number | undefined; search?: string | undefined },
  ): Promise<PagedResult<CustomerRow>> {
    const limit = Math.min(opts.limit ?? 20, 100);
    return withTenant(this.pool, ctx, async (tx) => {
      const cursorData = opts.cursor ? decodeCursor(opts.cursor) : null;
      const search = opts.search?.trim();

      const params: unknown[] = [];
      let where = 'WHERE 1=1';

      if (cursorData) {
        params.push(cursorData.createdAt, cursorData.id);
        where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
      }

      if (search) {
        params.push(`%${search}%`);
        const i = params.length;
        where += ` AND (legal_name ILIKE $${i} OR identification ILIKE $${i} OR email_primary ILIKE $${i} OR phone ILIKE $${i})`;
      }

      const countRes = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM customers ${where}`,
        params,
      );
      const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

      params.push(limit + 1);
      const dataRes = await tx.query<CustomerRow>(
        `SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
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

  async findOne(ctx: RequestContext, id: string): Promise<CustomerRow> {
    return withTenant(this.pool, ctx, async (tx) => {
      const res = await tx.query<CustomerRow>('SELECT * FROM customers WHERE id = $1', [id]);
      if (!res.rows[0]) throw new NotFoundException(`Customer ${id} not found`);
      return res.rows[0];
    });
  }

  async create(ctx: RequestContext, dto: CreateCustomerDto): Promise<CustomerRow> {
    const result = createCustomerSchema.safeParse(dto);
    if (!result.success) throw new BadRequestException(result.error.message);
    return withTenant(this.pool, ctx, async (tx) => {
      try {
        const res = await tx.query<CustomerRow>(
          `INSERT INTO customers (
            tenant_id, type, identification_type, identification, dv,
            legal_name, first_name, last_name, fiscal_responsibilities,
            email_primary, phone, whatsapp, address, municipality, department,
            country, contact_name, internal_notes
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
          ) RETURNING *`,
          [
            ctx.tenantId,
            dto.type ?? 'LEGAL_ENTITY',
            dto.identification_type,
            dto.identification,
            dto.dv ?? null,
            dto.legal_name,
            dto.first_name ?? null,
            dto.last_name ?? null,
            dto.fiscal_responsibilities ?? [],
            dto.email_primary,
            dto.phone ?? null,
            dto.whatsapp ?? null,
            dto.address ?? null,
            dto.municipality ?? null,
            dto.department ?? null,
            dto.country ?? 'CO',
            dto.contact_name ?? null,
            dto.internal_notes ?? null,
          ],
        );
        return res.rows[0]!;
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          throw new ConflictException('Customer with this identification already exists for this tenant');
        }
        throw err;
      }
    });
  }

  async patch(ctx: RequestContext, id: string, dto: PatchCustomerDto): Promise<CustomerRow> {
    const result = patchCustomerSchema.safeParse(dto);
    if (!result.success) throw new BadRequestException(result.error.message);
    return withTenant(this.pool, ctx, async (tx) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      for (const [key, val] of Object.entries(dto)) {
        if (val !== undefined && CUSTOMER_PATCH_ALLOWLIST.has(key)) {
          fields.push(`${key} = $${i++}`);
          values.push(val);
        }
      }

      if (fields.length === 0) {
        const res = await tx.query<CustomerRow>('SELECT * FROM customers WHERE id = $1', [id]);
        if (!res.rows[0]) throw new NotFoundException(`Customer ${id} not found`);
        return res.rows[0];
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await tx.query<CustomerRow>(
        `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values,
      );

      if (!res.rows[0]) throw new NotFoundException(`Customer ${id} not found`);
      return res.rows[0];
    });
  }
}
