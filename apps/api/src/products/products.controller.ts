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
import { ProductsService, CreateProductDto, PatchProductDto } from './products.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('products')
@UseGuards(SessionGuard, PermissionGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermission('products.read')
  async list(
    @Req() req: AuthRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.productsService.list(req.context, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      active: active === undefined ? undefined : active !== 'false',
    });
  }

  @Get(':id')
  @RequirePermission('products.read')
  async findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.productsService.findOne(req.context, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('products.write')
  async create(@Req() req: AuthRequest, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.context, dto);
  }

  @Patch(':id')
  @RequirePermission('products.write')
  async patch(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: PatchProductDto) {
    return this.productsService.patch(req.context, id, dto);
  }
}
