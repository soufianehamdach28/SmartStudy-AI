import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { StorageService } from '../../../core/storage/storage.service.js';
import type { ProcessDocumentJobData } from '../documents.constants.js';
import type { DocumentChunkerService } from '../services/document-chunker.service.js';
import type { DocumentExtractorService } from '../services/document-extractor.service.js';
import { DocumentProcessor } from './document.processor.js';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let mockPrisma: any;
  let mockStorage: any;
  let mockExtractor: any;
  let mockChunker: any;

  beforeEach(() => {
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      documentChunk: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };

    mockStorage = {
      getBuffer: vi.fn(),
    };

    mockExtractor = {
      extract: vi.fn(),
    };

    mockChunker = {
      chunkPages: vi.fn(),
    };

    processor = new DocumentProcessor(
      mockPrisma as unknown as PrismaService,
      mockStorage as unknown as StorageService,
      mockExtractor as unknown as DocumentExtractorService,
      mockChunker as unknown as DocumentChunkerService,
    );
  });

  const createMockJob = (documentId: string): Job<ProcessDocumentJobData, void, string> => {
    return {
      data: { documentId },
    } as unknown as Job<ProcessDocumentJobData, void, string>;
  };

  it('skips processing if document does not exist', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const job = createMockJob('non-existent-id');
    await processor.process(job);

    expect(mockPrisma.document.update).not.toHaveBeenCalled();
    expect(mockStorage.getBuffer).not.toHaveBeenCalled();
  });

  it('skips processing if document is already READY', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-ready',
      status: 'READY',
    });

    const job = createMockJob('doc-ready');
    await processor.process(job);

    expect(mockPrisma.document.update).not.toHaveBeenCalled();
    expect(mockStorage.getBuffer).not.toHaveBeenCalled();
  });

  it('successfully processes document and updates status to READY', async () => {
    const documentId = 'doc-123';
    mockPrisma.document.findUnique.mockResolvedValue({
      id: documentId,
      storageKey: 'users/123/doc-123.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
    });

    const fakeBuffer = Buffer.from('pdf bytes');
    mockStorage.getBuffer.mockResolvedValue(fakeBuffer);

    mockExtractor.extract.mockResolvedValue({
      pageCount: 2,
      pages: [
        { pageNumber: 1, text: 'Page 1 text' },
        { pageNumber: 2, text: 'Page 2 text' },
      ],
    });

    mockChunker.chunkPages.mockReturnValue([
      {
        index: 0,
        page: 1,
        text: 'Page 1 text',
        charStart: 0,
        charEnd: 11,
      },
      {
        index: 1,
        page: 2,
        text: 'Page 2 text',
        charStart: 0,
        charEnd: 11,
      },
    ]);

    const job = createMockJob(documentId);
    await processor.process(job);

    // 1. Marked as PROCESSING first
    expect(mockPrisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    // 2. Storage buffer fetched
    expect(mockStorage.getBuffer).toHaveBeenCalledWith('users/123/doc-123.pdf');

    // 3. Extractor called
    expect(mockExtractor.extract).toHaveBeenCalledWith(
      fakeBuffer,
      'application/pdf',
    );

    // 4. Chunks deleted and created in transaction (idempotent)
    expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId },
    });
    expect(mockPrisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId,
          index: 0,
          page: 1,
          text: 'Page 1 text',
          charStart: 0,
          charEnd: 11,
        },
        {
          documentId,
          index: 1,
          page: 2,
          text: 'Page 2 text',
          charStart: 0,
          charEnd: 11,
        },
      ],
    });

    // 5. Marked READY with pageCount
    expect(mockPrisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: documentId },
      data: { status: 'READY', pageCount: 2, errorMessage: null },
    });
  });

  it('marks document as FAILED with error message when extraction fails', async () => {
    const documentId = 'doc-fail';
    mockPrisma.document.findUnique.mockResolvedValue({
      id: documentId,
      storageKey: 'users/123/doc-fail.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
    });

    mockStorage.getBuffer.mockResolvedValue(Buffer.from('scanned pdf'));
    mockExtractor.extract.mockRejectedValue(
      new Error(
        'This document contains no extractable text. Scanned PDFs without an OCR text layer are not currently supported.',
      ),
    );

    const job = createMockJob(documentId);
    await processor.process(job);

    expect(mockPrisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    expect(mockPrisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage:
          'This document contains no extractable text. Scanned PDFs without an OCR text layer are not currently supported.',
      },
    });

    expect(mockPrisma.documentChunk.createMany).not.toHaveBeenCalled();
  });
});
