import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { DianSubmissionQueueService } from './dian-submission-queue.service.js';

type AuthRequest = FastifyRequest & { context: RequestContext };
@Controller('settings/dian/submissions')
@UseGuards(SessionGuard, PermissionGuard)
export class DianSubmissionController {
  constructor(private readonly queue: DianSubmissionQueueService) {}
  @Post() @RequirePermission('invoices.issue') submit(@Req() req: AuthRequest, @Body() body: { documentId: string }) {
    this.requirePilot(req.context);
    return this.queue.enqueue(req.context, body.documentId);
  }
  @Get() @RequirePermission('dian.configure') progress(@Req() req: AuthRequest) {
    this.requirePilot(req.context);
    return this.queue.progress(req.context);
  }

  private requirePilot(ctx: RequestContext) {
    if (!process.env['DIAN_PILOT_TENANT_ID'] || ctx.tenantId !== process.env['DIAN_PILOT_TENANT_ID']) {
      throw new ForbiddenException('El envío directo está restringido al tenant piloto');
    }
  }
}
