import { Injectable, Optional } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

export interface TenantSettings {
  legalName: string;
  nit: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  taxRegime: 'COMUN' | 'SIMPLIFICADO' | 'NO_APLICA';
  dianEnvironment: 'HABILITACION' | 'PRODUCCION';
  dianSoftwareId: string | null;
}

export interface UpdateSettingsDto {
  legalName?: string;
  nit?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  taxRegime?: TenantSettings['taxRegime'];
  dianEnvironment?: TenantSettings['dianEnvironment'];
  dianSoftwareId?: string | null;
}

@Injectable()
export class SettingsService {
  private pool: pg.Pool;

  constructor(@Optional() customPool?: pg.Pool) {
    this.pool =
      customPool ??
      new pg.Pool({
        connectionString:
          process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora',
      });
  }

  async get(ctx: RequestContext): Promise<TenantSettings> {
    return withTenant(this.pool, ctx, async (tx) => {
      const { rows } = await tx.query<{
        legal_name: string; nit: string; address: string | null; city: string | null;
        phone: string | null; email: string | null; tax_regime: string;
        dian_environment: string; dian_software_id: string | null;
      }>(
        `SELECT legal_name, nit, address, city, phone, email, tax_regime,
                dian_environment, dian_software_id
         FROM tenant_settings WHERE tenant_id = $1`,
        [ctx.tenantId],
      );
      const r = rows[0];
      if (!r) {
        return {
          legalName: '', nit: '', address: null, city: null, phone: null, email: null,
          taxRegime: 'SIMPLIFICADO', dianEnvironment: 'HABILITACION',
          dianSoftwareId: null,
        };
      }
      return {
        legalName: r.legal_name,
        nit: r.nit,
        address: r.address,
        city: r.city,
        phone: r.phone,
        email: r.email,
        taxRegime: r.tax_regime as TenantSettings['taxRegime'],
        dianEnvironment: r.dian_environment as TenantSettings['dianEnvironment'],
        dianSoftwareId: r.dian_software_id,
      };
    });
  }

  async update(ctx: RequestContext, dto: UpdateSettingsDto): Promise<TenantSettings> {
    return withTenant(this.pool, ctx, async (tx) => {
      await tx.query(
        `INSERT INTO tenant_settings
           (tenant_id, legal_name, nit, address, city, phone, email,
            tax_regime, dian_environment, dian_software_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
           legal_name         = COALESCE(EXCLUDED.legal_name, tenant_settings.legal_name),
           nit                = COALESCE(EXCLUDED.nit, tenant_settings.nit),
           address            = EXCLUDED.address,
           city               = EXCLUDED.city,
           phone              = EXCLUDED.phone,
           email              = EXCLUDED.email,
           tax_regime         = COALESCE(EXCLUDED.tax_regime, tenant_settings.tax_regime),
           dian_environment   = COALESCE(EXCLUDED.dian_environment, tenant_settings.dian_environment),
           dian_software_id   = EXCLUDED.dian_software_id,
           updated_at         = NOW()`,
        [
          ctx.tenantId,
          dto.legalName ?? '',
          dto.nit ?? '',
          dto.address ?? null,
          dto.city ?? null,
          dto.phone ?? null,
          dto.email ?? null,
          dto.taxRegime ?? 'SIMPLIFICADO',
          dto.dianEnvironment ?? 'HABILITACION',
          dto.dianSoftwareId ?? null,
        ],
      );
      return this.get(ctx);
    });
  }
}
