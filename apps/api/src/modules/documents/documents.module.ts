import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOCUMENT_PROCESSING_QUEUE } from './documents.constants.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { DocumentProcessor } from './processors/document.processor.js';
import { DocumentChunkerService } from './services/document-chunker.service.js';
import { DocumentExtractorService } from './services/document-extractor.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_PROCESSING_QUEUE,
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentExtractorService,
    DocumentChunkerService,
    DocumentProcessor,
  ],
  exports: [DocumentsService, DocumentExtractorService, DocumentChunkerService],
})
export class DocumentsModule {}

