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
import { CustomersService } from './customers.service.js';
import type { CreateCustomerDto, PatchCustomerDto } from './customers.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('customers')
@UseGuards(SessionGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermission('customers.read')
  async list(
    @Req() req: AuthRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.customersService.list(req.context, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get(':id')
  @RequirePermission('customers.read')
  async findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.customersService.findOne(req.context, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('customers.write')
  async create(@Req() req: AuthRequest, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.context, dto);
  }

  @Patch(':id')
  @RequirePermission('customers.write')
  async patch(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: PatchCustomerDto) {
    return this.customersService.patch(req.context, id, dto);
  }
}
