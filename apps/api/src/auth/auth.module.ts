import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OnboardingService } from './onboarding.service.js';
import { SessionGuard } from './session.guard.js';
import { PermissionGuard } from '../tenancy/permission.guard.js';
import { PermissionsService } from '../tenancy/permissions.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OnboardingService,
    PermissionsService,
    SessionGuard,
    PermissionGuard,
  ],
  exports: [AuthService, PermissionsService, SessionGuard, PermissionGuard],
})
export class AuthModule {}
