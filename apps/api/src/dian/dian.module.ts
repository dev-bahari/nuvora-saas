import { Module } from '@nestjs/common';
import { MockDianProvider } from './mock-dian.provider.js';
import { DianController } from './dian.controller.js';
import { DianCredentialsService } from './dian-credentials.service.js';
import { DianSecretService } from './secrets/dian-secret.service.js';
import { PfxChainLoaderService } from './signing/pfx-chain-loader.service.js';
import { DianDirectSubmissionService } from './direct/dian-direct-submission.service.js';

@Module({
  controllers: [DianController],
  providers: [
    MockDianProvider, DianCredentialsService, DianSecretService, PfxChainLoaderService, DianDirectSubmissionService,
    { provide: 'DIAN_SECRETS_KEY', useValue: process.env['DIAN_SECRETS_KEY'] },
  ],
  exports: [MockDianProvider, DianCredentialsService, DianDirectSubmissionService],
})
export class DianModule {}
