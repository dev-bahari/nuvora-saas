import { createHash } from 'node:crypto';
import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PgBoss, type Job } from 'pg-boss';
import pg from 'pg';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { withTenant } from '../tenancy/tenant-transaction.js';
import { DianCredentialsService } from '../dian/dian-credentials.service.js';
import { DianDirectSubmissionService } from '../dian/direct/dian-direct-submission.service.js';
import { PfxChainLoaderService } from '../dian/signing/pfx-chain-loader.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { DocumentsService } from './documents.service.js';

interface SubmissionJob { tenantId: string; userId: string; requestId: string; documentId: string; }
const SUBMIT_QUEUE = 'dian-habilitation-submit';
const POLL_QUEUE = 'dian-habilitation-poll';

@Injectable()
export class DianSubmissionQueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly connectionString = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora';
  private readonly pool = new pg.Pool({ connectionString: this.connectionString });
  private boss?: PgBoss;
  private starting: Promise<void> | undefined;

  constructor(private readonly documents: DocumentsService, private readonly settings: SettingsService, private readonly credentials: DianCredentialsService, private readonly direct: DianDirectSubmissionService) {}

  async onModuleInit() { if (process.env['NODE_ENV'] !== 'test' && process.env['DIAN_QUEUE_ENABLED'] !== 'false') await this.ensureStarted(); }
  async onApplicationShutdown() { await this.boss?.stop({ graceful: true }); await this.pool.end(); }

  async enqueue(ctx: RequestContext, documentId: string) {
    await this.ensureStarted();
    const existing = await withTenant(this.pool, ctx, async (tx) => {
      const { rows } = await tx.query<{ id:string; status:string; tracking_id:string|null; message:string|null }>(
        `INSERT INTO dian_submissions (tenant_id, document_id) VALUES ($1,$2)
         ON CONFLICT (tenant_id, document_id) DO UPDATE SET updated_at=dian_submissions.updated_at
         RETURNING id,status,tracking_id,message`, [ctx.tenantId, documentId]);
      return rows[0]!;
    });
    if (['SUBMITTING','PENDING','ACCEPTED','REJECTED'].includes(existing.status)) return existing;
    const jobId = await this.boss!.send(SUBMIT_QUEUE, { tenantId: ctx.tenantId, userId: ctx.userId, requestId: ctx.requestId, documentId }, { singletonKey: `${ctx.tenantId}:${documentId}` });
    await withTenant(this.pool, ctx, (tx) => tx.query(`UPDATE dian_submissions SET pg_boss_job_id=$1, status='QUEUED', updated_at=NOW() WHERE tenant_id=$2 AND document_id=$3`, [jobId, ctx.tenantId, documentId]));
    return { ...existing, status: 'QUEUED', jobId };
  }

  async progress(ctx: RequestContext) {
    return withTenant(this.pool, ctx, async (tx) => {
      const { rows } = await tx.query(`SELECT ds.document_id AS "documentId", fd.document_type AS "documentType", COALESCE(fd.number_prefix,'') || COALESCE(fd.document_number::text,'') AS number, ds.status, ds.attempts, ds.tracking_id AS "trackingId", ds.status_code AS "statusCode", ds.message, ds.errors, ds.updated_at AS "updatedAt" FROM dian_submissions ds JOIN fiscal_documents fd ON fd.id=ds.document_id WHERE ds.tenant_id=$1 ORDER BY ds.created_at DESC`, [ctx.tenantId]);
      const counts = { invoices: 0, creditNotes: 0, debitNotes: 0, accepted: 0, rejected: 0, pending: 0 };
      for (const row of rows as Array<Record<string, unknown>>) { const type = row['documentType']; if (type === 'INVOICE') counts.invoices++; else if (type === 'CREDIT_NOTE') counts.creditNotes++; else if (type === 'DEBIT_NOTE') counts.debitNotes++; if (row['status'] === 'ACCEPTED') counts.accepted++; else if (row['status'] === 'REJECTED') counts.rejected++; else counts.pending++; }
      return { required: { invoices: 30, creditNotes: 10, debitNotes: 10, total: 50 }, counts, documents: rows };
    });
  }

  private async ensureStarted() {
    if (this.boss) return; if (this.starting) return this.starting;
    this.starting = (async () => {
      const boss = new PgBoss({ connectionString: this.connectionString, schema: 'pgboss' }); await boss.start();
      await boss.createQueue(SUBMIT_QUEUE, { policy: 'singleton', retryLimit: 5, retryDelay: 20, retryBackoff: true, retryDelayMax: 300, expireInSeconds: 120, deleteAfterSeconds: 0 });
      await boss.createQueue(POLL_QUEUE, { policy: 'singleton', retryLimit: 20, retryDelay: 30, retryBackoff: true, retryDelayMax: 300, expireInSeconds: 60, deleteAfterSeconds: 0 });
      await boss.work<SubmissionJob>(SUBMIT_QUEUE, async (jobs) => { for (const job of jobs) await this.submit(job); });
      await boss.work<SubmissionJob>(POLL_QUEUE, async (jobs) => { for (const job of jobs) await this.poll(job); });
      this.boss = boss;
    })();
    try { await this.starting; } finally { this.starting = undefined; }
  }

  private context(data: SubmissionJob): RequestContext { return { tenantId: data.tenantId, userId: data.userId, requestId: data.requestId, permissions: [] }; }
  private async submit(job: Job<SubmissionJob>) {
    const ctx = this.context(job.data); await this.markAttempt(ctx, job.data.documentId, 'SUBMITTING');
    try {
      const [document, tenant, secret] = await Promise.all([this.documents.getDraft(ctx, job.data.documentId), this.settings.get(ctx), this.credentials.load(ctx)]);
      const sourceDoc = document.sourceDocumentId ? await this.documents.getDraft(ctx, document.sourceDocumentId) : undefined;
      const source = sourceDoc ? { number: `${sourceDoc.numberPrefix ?? ''}${sourceDoc.documentNumber ?? ''}`, uuid: sourceDoc.cude ?? sourceDoc.cufe ?? '', issueDate: sourceDoc.issueDate } : undefined;
      const result = await this.direct.submit({ document, tenant: { ...tenant, dianSoftwarePin: secret.softwarePin, dianTechnicalKey: secret.technicalKey, invoiceAuthorization: secret.invoiceAuthorization, authorizationPrefix: secret.authorizationPrefix, authorizationFrom: secret.authorizationFrom, authorizationTo: secret.authorizationTo, authorizationStartDate: secret.authorizationStartDate, authorizationEndDate: secret.authorizationEndDate }, pfx: Buffer.from(secret.pfx, 'base64'), password: secret.password, caChain: Buffer.from(secret.caChain, 'base64'), testSetId: secret.testSetId, ...(source ? { source } : {}) });
      await this.persistResult(ctx, document.id, result.response, result.signedXml, result.zip);
      if (result.response.outcome === 'ERROR') throw new Error(result.response.message);
      if (result.response.outcome === 'PENDING' && result.response.trackId) await this.boss!.send(POLL_QUEUE, job.data, { singletonKey: `${ctx.tenantId}:${document.id}`, startAfter: 30 });
    } catch (error) { await this.recordError(ctx, job.data.documentId, error); throw error; }
  }

  private async poll(job: Job<SubmissionJob>) {
    const ctx = this.context(job.data); const secret = await this.credentials.load(ctx);
    const credentials = new PfxChainLoaderService().load(Buffer.from(secret.pfx, 'base64'), secret.password, Buffer.from(secret.caChain, 'base64'));
    const tracking = await withTenant(this.pool, ctx, async (tx) => (await tx.query<{tracking_id:string}>(`SELECT tracking_id FROM dian_submissions WHERE tenant_id=$1 AND document_id=$2`, [ctx.tenantId, job.data.documentId])).rows[0]?.tracking_id);
    if (!tracking) throw new Error('No existe trackingId DIAN para consultar');
    const response = await this.direct.poll({ trackId: tracking, credentials }); await this.persistResult(ctx, job.data.documentId, response);
    if (response.outcome === 'PENDING') { await this.boss!.send(POLL_QUEUE, job.data, { singletonKey: `${ctx.tenantId}:${job.data.documentId}`, startAfter: 30 }); return; }
    if (response.outcome === 'ERROR') throw new Error(response.message);
  }

  private markAttempt(ctx: RequestContext, documentId: string, status: string) { return withTenant(this.pool, ctx, (tx) => tx.query(`UPDATE dian_submissions SET status=$1, attempts=attempts+1, updated_at=NOW() WHERE tenant_id=$2 AND document_id=$3`, [status, ctx.tenantId, documentId])); }
  private recordError(ctx: RequestContext, documentId: string, error: unknown) { return withTenant(this.pool, ctx, (tx) => tx.query(`UPDATE dian_submissions SET status='ERROR', message=$1, updated_at=NOW() WHERE tenant_id=$2 AND document_id=$3`, [error instanceof Error ? error.message : String(error), ctx.tenantId, documentId])); }
  private persistResult(ctx: RequestContext, documentId: string, result: { outcome:string; trackId?:string | undefined; statusCode?:string | undefined; message:string; errors:string[]; raw:string }, signedXml?: Buffer, zip?: Buffer) {
    return withTenant(this.pool, ctx, async (tx) => {
      await tx.query(`UPDATE dian_submissions SET status=$1, tracking_id=COALESCE($2,tracking_id), status_code=$3, message=$4, errors=$5, response_xml=$6, signed_xml=COALESCE(signed_xml,$7), signed_xml_sha256=COALESCE(signed_xml_sha256,$8), zip_payload=COALESCE(zip_payload,$9), zip_sha256=COALESCE(zip_sha256,$10), completed_at=CASE WHEN $1 IN ('ACCEPTED','REJECTED') THEN NOW() ELSE NULL END, updated_at=NOW() WHERE tenant_id=$11 AND document_id=$12`, [result.outcome, result.trackId ?? null, result.statusCode ?? null, result.message, JSON.stringify(result.errors), Buffer.from(result.raw), signedXml ?? null, signedXml ? sha(signedXml) : null, zip ?? null, zip ? sha(zip) : null, ctx.tenantId, documentId]);
      const documentStatus = result.outcome === 'ACCEPTED' ? 'DIAN_ACCEPTED' : result.outcome === 'REJECTED' ? 'REJECTED' : 'DIAN_PENDING';
      await tx.query(`UPDATE fiscal_documents SET status=$1, dian_tracking_id=COALESCE($2,dian_tracking_id), rejection_reason=CASE WHEN $1='REJECTED' THEN $3 ELSE NULL END, version=version+1, updated_at=NOW() WHERE id=$4`, [documentStatus, result.trackId ?? null, result.message, documentId]);
      await tx.query(`UPDATE dian_credentials SET status=$1, last_message=$2, updated_at=NOW() WHERE tenant_id=$3`, [result.outcome, result.message, ctx.tenantId]);
    });
  }
}
function sha(value: Buffer) { return createHash('sha256').update(value).digest('hex'); }
