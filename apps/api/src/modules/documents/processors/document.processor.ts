import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { StorageService } from '../../../core/storage/storage.service.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type ProcessDocumentJobData,
} from '../documents.constants.js';
import { DocumentChunkerService } from '../services/document-chunker.service.js';
import { DocumentExtractorService } from '../services/document-extractor.service.js';

@Injectable()
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly extractor: DocumentExtractorService,
    private readonly chunker: DocumentChunkerService,
  ) {
    super();
  }

  /**
   * Process a document processing job:
   * 1. Check document exists and is not already READY
   * 2. Mark document as PROCESSING
   * 3. Download original file from S3
   * 4. Extract text per page (detect scanned/empty PDFs)
   * 5. Split text into chunks (~500-800 tokens) with page and character offsets
   * 6. In a transaction, delete any previous chunks and insert new chunks (idempotent)
   * 7. Mark document as READY with page count
   * 8. On error, mark document as FAILED with error message
   */
  async process(job: Job<ProcessDocumentJobData, void, string>): Promise<void> {
    const { documentId } = job.data;
    this.logger.log(`Starting processing for document ${documentId}`);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      this.logger.warn(`Document ${documentId} not found; discarding job.`);
      return;
    }

    if (document.status === 'READY') {
      this.logger.log(
        `Document ${documentId} is already READY; skipping processing.`,
      );
      return;
    }

    // Mark as PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    try {
      const buffer = await this.storage.getBuffer(document.storageKey);
      const extraction = await this.extractor.extract(
        buffer,
        document.mimeType,
      );
      const chunks = this.chunker.chunkPages(extraction.pages);

      if (chunks.length === 0) {
        throw new Error('Document contains no readable text.');
      }

      // Save chunks and mark READY atomically.
      // Re-running a job deletes previous chunks first (idempotent).
      await this.prisma.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({
          where: { documentId },
        });

        await tx.documentChunk.createMany({
          data: chunks.map((c) => ({
            documentId,
            index: c.index,
            page: c.page,
            text: c.text,
            charStart: c.charStart,
            charEnd: c.charEnd,
          })),
        });

        await tx.document.update({
          where: { id: documentId },
          data: {
            status: 'READY',
            pageCount: extraction.pageCount,
            errorMessage: null,
          },
        });
      });

      this.logger.log(
        `Document ${documentId} processed successfully: ${extraction.pageCount} page(s), ${chunks.length} chunk(s)`,
      );
    } catch (error) {
      // Check if document was deleted concurrently during processing
      const docStillExists = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true },
      });

      if (!docStillExists) {
        this.logger.log(
          `Document ${documentId} was deleted during processing; discarding job cleanly.`,
        );
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Document processing failed';

      this.logger.error(
        `Failed to process document ${documentId}: ${message}`,
      );

      try {
        await this.prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'FAILED',
            errorMessage: message,
          },
        });
      } catch {
        // Document was deleted while updating; safe to ignore.
      }
    }
  }
}
