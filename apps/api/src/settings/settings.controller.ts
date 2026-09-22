import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SettingsService } from './settings.service.js';
import type { UpdateSettingsDto } from './settings.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('settings')
@UseGuards(SessionGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission('tenant.settings')
  get(@Req() req: AuthRequest) {
    return this.settings.get(req.context);
  }

  @Put()
  @RequirePermission('tenant.settings')
  update(@Req() req: AuthRequest, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(req.context, dto);
  }
}
