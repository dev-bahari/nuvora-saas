import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { SettingsController } from './settings.controller.js';
import { PermissionsService } from '../tenancy/permissions.service.js';
import { SessionGuard } from '../auth/session.guard.js';

@Module({
  providers: [SettingsService, PermissionsService, SessionGuard],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
