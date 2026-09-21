import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OnboardingService } from './onboarding.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OnboardingService],
  exports: [AuthService],
})
export class AuthModule {}
