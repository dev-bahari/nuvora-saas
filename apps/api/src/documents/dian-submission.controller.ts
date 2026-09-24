import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import pg from 'pg';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { withTenant } from '../tenancy/tenant-transaction.js';
import { DianCredentialsService } from '../dian/dian-credentials.service.js';
import { DianDirectSubmissionService } from '../dian/direct/dian-direct-submission.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { DocumentsService } from './documents.service.js';

type AuthRequest = FastifyRequest & { context: RequestContext };
@Controller('settings/dian/submissions')
@UseGuards(SessionGuard, PermissionGuard)
export class DianSubmissionController {
  private readonly pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/nuvora' });
  constructor(private readonly documents: DocumentsService, private readonly settings: SettingsService, private readonly credentials: DianCredentialsService, private readonly direct: DianDirectSubmissionService) {}

  @Post()
  @RequirePermission('invoices.issue')
  async submit(@Req() req: AuthRequest, @Body() body: { documentId: string }) {
    if (req.context.tenantId !== process.env['DIAN_PILOT_TENANT_ID']) throw new ForbiddenException('El envío directo está restringido al tenant piloto');
    const [document, tenant, secret] = await Promise.all([this.documents.getDraft(req.context, body.documentId), this.settings.get(req.context), this.credentials.load(req.context)]);
    const result = await this.direct.submit({
      document,
      tenant: { ...tenant, dianSoftwarePin: secret.softwarePin, dianTechnicalKey: secret.technicalKey },
      pfx: Buffer.from(secret.pfx, 'base64'), password: secret.password, caChain: Buffer.from(secret.caChain, 'base64'), testSetId: secret.testSetId,
    });
    await withTenant(this.pool, req.context, async (tx) => {
      const status = result.outcome === 'ACCEPTED' ? 'DIAN_ACCEPTED' : result.outcome === 'REJECTED' ? 'REJECTED' : 'DIAN_PENDING';
      await tx.query(`UPDATE fiscal_documents SET status=$1, dian_tracking_id=COALESCE($2,dian_tracking_id), rejection_reason=$3, version=version+1, updated_at=NOW() WHERE id=$4`, [status, result.trackId ?? null, result.outcome === 'REJECTED' || result.outcome === 'ERROR' ? result.message : null, body.documentId]);
      await tx.query(`UPDATE dian_credentials SET status=$1, last_message=$2, updated_at=NOW() WHERE tenant_id=$3`, [result.outcome, result.message, req.context.tenantId]);
    });
    return { outcome: result.outcome, statusCode: result.statusCode, message: result.message, trackId: result.trackId, errors: result.errors };
  }
}
