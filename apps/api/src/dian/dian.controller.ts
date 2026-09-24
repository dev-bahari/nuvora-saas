import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { DianCredentialsService, type DianCredentialInput } from './dian-credentials.service.js';

type AuthRequest = FastifyRequest & { context: RequestContext };
@Controller('settings/dian')
@UseGuards(SessionGuard, PermissionGuard)
export class DianController {
  constructor(private readonly credentials: DianCredentialsService) {}
  @Get() @RequirePermission('dian.configure') get(@Req() req: AuthRequest) { return this.credentials.getStatus(req.context); }
  @Put('credentials') @RequirePermission('dian.configure') save(@Req() req: AuthRequest, @Body() body: DianCredentialInput) { return this.credentials.save(req.context, body); }
}
