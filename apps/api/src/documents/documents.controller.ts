import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DocumentsService } from './documents.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';
import type { CreateDraftDto, PatchDraftDto } from '@nuvora/contracts';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('invoices')
@UseGuards(SessionGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermission('invoices.read')
  async list(
    @Req() req: AuthRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.documentsService.listDrafts(req.context, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  @Get(':id')
  @RequirePermission('invoices.read')
  async findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.documentsService.getDraft(req.context, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('invoices.create')
  async create(@Req() req: AuthRequest, @Body() dto: CreateDraftDto) {
    return this.documentsService.createDraft(req.context, dto);
  }

  @Patch(':id')
  @RequirePermission('invoices.create')
  async patch(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: PatchDraftDto) {
    return this.documentsService.patchDraft(req.context, id, dto);
  }
}
