import { Controller, Post, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DebitNotesService, type CreateDebitNoteDto } from './debit-notes.service.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../../tenancy/permission.guard.js';
import type { RequestContext } from '../../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('invoices')
@UseGuards(SessionGuard, PermissionGuard)
export class DebitNotesController {
  constructor(private readonly debitNotesService: DebitNotesService) {}

  @Post(':id/debit-note')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('debit_notes.create')
  async create(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateDebitNoteDto,
  ) {
    return this.debitNotesService.create(req.context, id, dto);
  }
}
