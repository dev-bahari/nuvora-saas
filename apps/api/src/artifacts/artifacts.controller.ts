import { Controller, Get, Param, Res, UseGuards, Req } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactsService } from './artifacts.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('invoices')
@UseGuards(SessionGuard, PermissionGuard)
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get(':id/pdf')
  @RequirePermission('invoices.read')
  async getPdf(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.artifactsService.getOrGenerateArtifact(req.context, id, 'pdf');
    return reply.redirect(result.url, 302);
  }

  @Get(':id/xml')
  @RequirePermission('invoices.read')
  async getXml(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.artifactsService.getOrGenerateArtifact(req.context, id, 'xml');
    return reply.redirect(result.url, 302);
  }
}
