import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { IssueDocumentService } from './issue-document.service.js';
import { CreditNotesService } from './credit-notes/credit-notes.service.js';
import { CreditNotesController } from './credit-notes/credit-notes.controller.js';
import { DebitNotesService } from './debit-notes/debit-notes.service.js';
import { DebitNotesController } from './debit-notes/debit-notes.controller.js';
import { NumberingModule } from '../numbering/numbering.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DianModule } from '../dian/dian.module.js';

@Module({
  imports: [NumberingModule, AuditModule, DianModule],
  providers: [
    DocumentsService,
    IssueDocumentService,
    CreditNotesService,
    DebitNotesService,
  ],
  controllers: [
    DocumentsController,
    CreditNotesController,
    DebitNotesController,
  ],
  exports: [DocumentsService, IssueDocumentService],
})
export class DocumentsModule {}
