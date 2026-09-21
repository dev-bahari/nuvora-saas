import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { PermissionsService } from '../tenancy/permissions.service.js';
import { SessionGuard } from '../auth/session.guard.js';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, PermissionsService, SessionGuard],
})
export class CustomersModule {}
