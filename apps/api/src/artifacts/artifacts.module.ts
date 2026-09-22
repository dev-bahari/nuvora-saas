import { Module } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service.js';
import { ArtifactsController } from './artifacts.controller.js';
import { XmlGeneratorService } from './xml-generator.service.js';
import { PdfRendererService } from './pdf-renderer.service.js';
import { CufeService } from './cufe.service.js';
import { MinioStorageAdapter } from './minio-storage.adapter.js';
import { STORAGE_PROVIDER } from './storage.provider.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PermissionGuard } from '../tenancy/permission.guard.js';
import { PermissionsService } from '../tenancy/permissions.service.js';

@Module({
  providers: [
    CufeService,
    XmlGeneratorService,
    PdfRendererService,
    { provide: STORAGE_PROVIDER, useClass: MinioStorageAdapter },
    ArtifactsService,
    PermissionsService,
    SessionGuard,
    PermissionGuard,
  ],
  controllers: [ArtifactsController],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
