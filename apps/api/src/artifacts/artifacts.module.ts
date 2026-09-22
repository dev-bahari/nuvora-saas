import { Module } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service.js';
import { ArtifactsController } from './artifacts.controller.js';
import { XmlGeneratorService } from './xml-generator.service.js';
import { PdfRendererService } from './pdf-renderer.service.js';
import { MinioStorageAdapter } from './minio-storage.adapter.js';
import { STORAGE_PROVIDER } from './storage.provider.js';

@Module({
  providers: [
    XmlGeneratorService,
    PdfRendererService,
    { provide: STORAGE_PROVIDER, useClass: MinioStorageAdapter },
    ArtifactsService,
  ],
  controllers: [ArtifactsController],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
