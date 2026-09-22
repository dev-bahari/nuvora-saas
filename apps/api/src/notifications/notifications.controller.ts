import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { NotificationsService } from './notifications.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import { z } from 'zod';

type AuthRequest = FastifyRequest & { context: RequestContext };

const CreateChannelSchema = z.object({
  channelType: z.enum(['EMAIL', 'WEBHOOK', 'WHATSAPP']),
  config: z.record(z.unknown()),
  events: z.array(z.string()).min(1),
});

@Controller('notification-channels')
@UseGuards(SessionGuard, PermissionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermission('notifications.manage')
  list(@Req() req: AuthRequest) {
    return this.notifications.listChannels(req.context);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('notifications.manage')
  create(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = CreateChannelSchema.parse(body);
    return this.notifications.createChannel(req.context, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('notifications.manage')
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.notifications.deleteChannel(req.context, id);
  }
}
