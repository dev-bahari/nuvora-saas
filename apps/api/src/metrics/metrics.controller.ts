import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { MetricsService } from './metrics.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('metrics')
@UseGuards(SessionGuard, PermissionGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @RequirePermission('invoices.read')
  getDashboard(@Req() req: AuthRequest) {
    return this.metrics.getDashboard(req.context);
  }
}
