import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AccountingService } from './accounting.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('invoices')
@UseGuards(SessionGuard, PermissionGuard)
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get(':id/journal')
  @RequirePermission('accounting.read')
  listJournal(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.accounting.listForDocument(req.context, id);
  }
}
