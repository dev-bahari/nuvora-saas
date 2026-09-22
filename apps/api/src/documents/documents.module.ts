import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { IssueDocumentService } from './issue-document.service.js';
import { NumberingModule } from '../numbering/numbering.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DianModule } from '../dian/dian.module.js';

@Module({
  imports: [NumberingModule, AuditModule, DianModule],
  providers: [DocumentsService, IssueDocumentService],
  controllers: [DocumentsController],
  exports: [DocumentsService, IssueDocumentService],
})
export class DocumentsModule {}
