import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { runMigrations } from '../../db/migrate.js';
import { withTenant } from '../../apps/api/src/tenancy/tenant-transaction.js';
import type { RequestContext } from '../../apps/api/src/tenancy/tenant-context.js';

const connectionString = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? 'postgresql://nuvora_app:nuvora_local_dev_password@localhost:54321/nuvora_test';
describe('DIAN tenant vault RLS', () => {
  const pool = new pg.Pool({ connectionString }); const tenants: string[] = [];
  let a: RequestContext; let b: RequestContext;
  beforeAll(async () => {
    await runMigrations(pool);
    for (const name of ['DIAN A', 'DIAN B']) tenants.push((await pool.query<{id:string}>(`INSERT INTO tenants(name,tax_id) VALUES($1,$2) RETURNING id`, [name, randomUUID()])).rows[0]!.id);
    a = { tenantId: tenants[0]!, userId: randomUUID(), requestId: 'dian-a', permissions: [] };
    b = { tenantId: tenants[1]!, userId: randomUUID(), requestId: 'dian-b', permissions: [] };
  });
  afterAll(async () => { await pool.query(`DELETE FROM tenants WHERE id=ANY($1::uuid[])`, [tenants]); await pool.end(); });
  it('keeps encrypted credential rows invisible across tenants', async () => {
    await withTenant(pool, a, (tx) => tx.query(`INSERT INTO dian_credentials(tenant_id,secret_ciphertext,secret_iv,secret_auth_tag,software_id,certificate_fingerprint,certificate_expires_at,test_set_id) VALUES($1,'a','b','c','software-a','fingerprint',NOW()+INTERVAL '1 day','set-a')`, [a.tenantId]));
    const own = await withTenant(pool, a, async (tx) => (await tx.query(`SELECT software_id FROM dian_credentials`)).rows);
    const foreign = await withTenant(pool, b, async (tx) => (await tx.query(`SELECT software_id FROM dian_credentials`)).rows);
    expect(own).toHaveLength(1); expect(foreign).toHaveLength(0);
  });
  it('deduplicates one DIAN submission per document and freezes signed artifacts', async () => {
    const documentId = await withTenant(pool, a, async (tx) => {
      const document = (await tx.query<{id:string}>(`INSERT INTO fiscal_documents(tenant_id,customer_snapshot) VALUES($1,'{}') RETURNING id`, [a.tenantId])).rows[0]!;
      await tx.query(`INSERT INTO dian_submissions(tenant_id,document_id,signed_xml,signed_xml_sha256,zip_payload,zip_sha256) VALUES($1,$2,'xml','x','zip','z')`, [a.tenantId, document.id]);
      return document.id;
    });
    await expect(withTenant(pool, a, (tx) => tx.query(`INSERT INTO dian_submissions(tenant_id,document_id) VALUES($1,$2)`, [a.tenantId, documentId]))).rejects.toThrow(/unique/i);
    await expect(withTenant(pool, a, (tx) => tx.query(`UPDATE dian_submissions SET signed_xml='changed' WHERE tenant_id=$1`, [a.tenantId]))).rejects.toThrow(/immutable/i);
  });
});
