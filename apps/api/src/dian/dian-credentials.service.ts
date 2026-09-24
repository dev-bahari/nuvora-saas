import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import pg from 'pg';
import { withTenant } from '../tenancy/tenant-transaction.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { DianSecretService, type SealedSecret } from './secrets/dian-secret.service.js';
import { PfxChainLoaderService } from './signing/pfx-chain-loader.service.js';

export interface DianCredentialInput { pfxBase64: string; password: string; caChainBase64: string; softwareId: string; softwarePin: string; technicalKey: string; testSetId: string; }
interface StoredSecret { pfx: string; password: string; caChain: string; softwarePin: string; technicalKey: string; }

@Injectable()
export class DianCredentialsService {
  private readonly pool: pg.Pool;
  constructor(private readonly secrets: DianSecretService, private readonly loader: PfxChainLoaderService, customPool?: pg.Pool) {
    this.pool = customPool ?? new pg.Pool({ connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora' });
  }

  async save(ctx: RequestContext, input: DianCredentialInput) {
    if (![input.pfxBase64, input.password, input.caChainBase64, input.softwareId, input.softwarePin, input.testSetId].every(Boolean)) throw new BadRequestException('Faltan credenciales DIAN obligatorias');
    const pfx = decode(input.pfxBase64, 'PFX');
    const chain = decode(input.caChainBase64, 'cadena CA');
    const loaded = this.loader.load(pfx, input.password, chain);
    const sealed = this.secrets.seal(Buffer.from(JSON.stringify({ pfx: input.pfxBase64, password: input.password, caChain: input.caChainBase64, softwarePin: input.softwarePin, technicalKey: input.technicalKey } satisfies StoredSecret)));
    await withTenant(this.pool, ctx, (tx) => tx.query(
      `INSERT INTO dian_credentials (tenant_id, secret_ciphertext, secret_iv, secret_auth_tag, software_id, certificate_fingerprint, certificate_expires_at, test_set_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'READY') ON CONFLICT (tenant_id) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext, secret_iv=EXCLUDED.secret_iv, secret_auth_tag=EXCLUDED.secret_auth_tag, software_id=EXCLUDED.software_id, certificate_fingerprint=EXCLUDED.certificate_fingerprint, certificate_expires_at=EXCLUDED.certificate_expires_at, test_set_id=EXCLUDED.test_set_id, status='READY', last_message=NULL, updated_at=NOW()`,
      [ctx.tenantId, sealed.ciphertext, sealed.iv, sealed.authTag, input.softwareId, loaded.fingerprint, loaded.expiresAt, input.testSetId],
    ));
    return this.getStatus(ctx);
  }

  async getStatus(ctx: RequestContext) {
    return withTenant(this.pool, ctx, async (tx) => {
      const { rows } = await tx.query<{ software_id:string; certificate_fingerprint:string; certificate_expires_at:Date; test_set_id:string; status:string; last_message:string|null }>(`SELECT software_id, certificate_fingerprint, certificate_expires_at, test_set_id, status, last_message FROM dian_credentials WHERE tenant_id=$1`, [ctx.tenantId]);
      const row = rows[0];
      return row ? { configured: true, softwareId: row.software_id, fingerprint: row.certificate_fingerprint, expiresAt: row.certificate_expires_at.toISOString(), testSetId: row.test_set_id, status: row.status, message: row.last_message } : { configured: false, status: 'UNCONFIGURED' };
    });
  }

  async load(ctx: RequestContext) {
    return withTenant(this.pool, ctx, async (tx) => {
      const { rows } = await tx.query<{ secret_ciphertext:Buffer; secret_iv:Buffer; secret_auth_tag:Buffer; software_id:string; test_set_id:string }>(`SELECT secret_ciphertext, secret_iv, secret_auth_tag, software_id, test_set_id FROM dian_credentials WHERE tenant_id=$1`, [ctx.tenantId]);
      const row = rows[0]; if (!row) throw new NotFoundException('Credenciales DIAN no configuradas');
      const sealed: SealedSecret = { ciphertext: row.secret_ciphertext, iv: row.secret_iv, authTag: row.secret_auth_tag };
      return { ...JSON.parse(this.secrets.open(sealed).toString()) as StoredSecret, softwareId: row.software_id, testSetId: row.test_set_id };
    });
  }
}

function decode(value: string, label: string) { const result = Buffer.from(value, 'base64'); if (!result.length) throw new BadRequestException(`${label} inválido`); return result; }
