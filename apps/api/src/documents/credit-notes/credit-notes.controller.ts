import { Controller, Post, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CreditNotesService, type CreateCreditNoteDto } from './credit-notes.service.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../../tenancy/permission.guard.js';
import type { RequestContext } from '../../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('invoices')
@UseGuards(SessionGuard, PermissionGuard)
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  /** Cancela total: crea NC total y marca la factura como CANCELLED_BY_CREDIT_NOTE */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('credit_notes.create')
  async cancel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.creditNotesService.create(req.context, id, { ...dto, lines: undefined });
  }

  /** NC parcial: requiere especificar líneas y montos a acreditar */
  @Post(':id/credit-note')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('credit_notes.create')
  async create(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.creditNotesService.create(req.context, id, dto);
  }
}
