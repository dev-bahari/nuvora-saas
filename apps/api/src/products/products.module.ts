import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { TaxesController } from './taxes.controller.js';
import { ProductsService } from './products.service.js';
import { PermissionsService } from '../tenancy/permissions.service.js';
import { SessionGuard } from '../auth/session.guard.js';

@Module({
  controllers: [ProductsController, TaxesController],
  providers: [ProductsService, PermissionsService, SessionGuard],
})
export class ProductsModule {}
