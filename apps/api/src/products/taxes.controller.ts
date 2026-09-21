import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ProductsService } from './products.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard, RequirePermission } from '../tenancy/permission.guard.js';
import type { RequestContext } from '../tenancy/tenant-context.js';

type AuthRequest = FastifyRequest & { context: RequestContext };

@Controller('taxes')
@UseGuards(SessionGuard, PermissionGuard)
export class TaxesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermission('taxes.read')
  async list(@Req() req: AuthRequest) {
    return this.productsService.listTaxes(req.context);
  }
}
