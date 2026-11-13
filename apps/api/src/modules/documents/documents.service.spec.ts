import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../core/config/env.js';
import { DocumentsService } from './documents.service.js';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockPrisma = {
    document: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockStorage = {
    generateStorageKey: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
  };

  const mockConfig = {
    get: vi.fn((key: string) => {
      if (key === 'MAX_UPLOAD_BYTES') return 10 * 1024 * 1024; // 10 MB
      return undefined;
    }),
  } as unknown as ConfigService<Env, true>;

  const mockQueue = {
    add: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentsService(
      mockPrisma as any,
      mockStorage as any,
      mockConfig,
      mockQueue as any,
    );
  });

  describe('validateFile', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(service.validateFile(undefined)).rejects.toThrow(
        BadRequestException,
      );

      try {
        await service.validateFile(undefined);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'No file provided. Please attach a PDF or TXT file.',
        });
      }
    });

    it('throws BadRequestException when file buffer is empty', async () => {
      const emptyFile = {
        buffer: Buffer.alloc(0),
        originalname: 'empty.pdf',
        size: 0,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      await expect(service.validateFile(emptyFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws PayloadTooLargeException when file exceeds MAX_UPLOAD_BYTES', async () => {
      const largeFile = {
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        originalname: 'large.pdf',
        size: 10 * 1024 * 1024 + 1,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      await expect(service.validateFile(largeFile)).rejects.toThrow(
        PayloadTooLargeException,
      );

      try {
        await service.validateFile(largeFile);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds the 10 MB limit.',
        });
      }
    });

    it('throws UnsupportedMediaTypeException for unsupported extensions', async () => {
      const unsupportedFiles = ['script.sh', 'image.png', 'archive.zip', 'file'];

      for (const name of unsupportedFiles) {
        const file = {
          buffer: Buffer.from('some content'),
          originalname: name,
          size: 12,
          mimetype: 'application/octet-stream',
        } as Express.Multer.File;

        await expect(service.validateFile(file)).rejects.toThrow(
          UnsupportedMediaTypeException,
        );
      }
    });

    it('throws UnsupportedMediaTypeException when .pdf has invalid header and magic bytes', async () => {
      const fakePdf = {
        buffer: Buffer.from('This is actually a plain text file pretending to be pdf'),
        originalname: 'fake.pdf',
        size: 55,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      await expect(service.validateFile(fakePdf)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );

      try {
        await service.validateFile(fakePdf);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'The uploaded file does not match valid PDF content.',
        });
      }
    });

    it('accepts valid PDF with %PDF- header', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const validPdf = {
        buffer: validPdfBuffer,
        originalname: 'lecture-notes.pdf',
        size: validPdfBuffer.length,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const validated = await service.validateFile(validPdf);

      expect(validated).toEqual({
        buffer: validPdfBuffer,
        mimeType: 'application/pdf',
        extension: '.pdf',
        originalName: 'lecture-notes.pdf',
        sizeBytes: validPdfBuffer.length,
      });
    });

    it('throws UnsupportedMediaTypeException when .txt is disguised binary file (PNG header)', async () => {
      // PNG magic bytes: 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
      ]);
      const disguisedTxt = {
        buffer: pngBuffer,
        originalname: 'disguised.txt',
        size: pngBuffer.length,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      await expect(service.validateFile(disguisedTxt)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );

      try {
        await service.validateFile(disguisedTxt);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'The uploaded file is not a valid plain text file.',
        });
      }
    });

    it('throws UnsupportedMediaTypeException when .txt contains binary null bytes', async () => {
      const binaryTxtBuffer = Buffer.from('Hello\0World text with null character');
      const binaryTxt = {
        buffer: binaryTxtBuffer,
        originalname: 'corrupt.txt',
        size: binaryTxtBuffer.length,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      await expect(service.validateFile(binaryTxt)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );

      try {
        await service.validateFile(binaryTxt);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'The uploaded file contains binary or invalid text characters.',
        });
      }
    });

    it('accepts valid UTF-8 plain text file', async () => {
      const textBuffer = Buffer.from('Chapter 1: Introduction to Biology\nPhotosynthesis is the process...');
      const validTxt = {
        buffer: textBuffer,
        originalname: 'biology.txt',
        size: textBuffer.length,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      const validated = await service.validateFile(validTxt);

      expect(validated).toEqual({
        buffer: textBuffer,
        mimeType: 'text/plain',
        extension: '.txt',
        originalName: 'biology.txt',
        sizeBytes: textBuffer.length,
      });
    });
  });

  describe('upload', () => {
    it('validates, uploads to S3, persists Document in DB with status UPLOADED and returns 202 response', async () => {
      const userId = 'user-123-uuid';
      const pdfBuffer = Buffer.from('%PDF-1.5 test document');
      const file = {
        buffer: pdfBuffer,
        originalname: 'physics.pdf',
        size: pdfBuffer.length,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const storageKey = `${userId}/random-doc-uuid.pdf`;
      mockStorage.generateStorageKey.mockReturnValue(storageKey);
      mockStorage.upload.mockResolvedValue({});

      const now = new Date('2026-11-08T22:00:00.000Z');
      const createdRecord = {
        id: 'doc-456-uuid',
        userId,
        title: 'physics.pdf',
        mimeType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
        storageKey,
        status: 'UPLOADED',
        errorMessage: null,
        pageCount: null,
        summary: null,
        createdAt: now,
        updatedAt: now,
      };

      mockPrisma.document.create.mockResolvedValue(createdRecord);

      const result = await service.upload(userId, file);

      expect(mockStorage.generateStorageKey).toHaveBeenCalledWith(userId, '.pdf');
      expect(mockStorage.upload).toHaveBeenCalledWith(
        storageKey,
        pdfBuffer,
        'application/pdf',
      );
      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: 'physics.pdf',
          mimeType: 'application/pdf',
          sizeBytes: pdfBuffer.length,
          storageKey,
          status: 'UPLOADED',
        },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-document',
        { documentId: 'doc-456-uuid' },
        expect.any(Object),
      );

      expect(result).toEqual({
        document: {
          id: 'doc-456-uuid',
          userId,
          title: 'physics.pdf',
          mimeType: 'application/pdf',
          sizeBytes: pdfBuffer.length,
          status: 'UPLOADED',
          errorMessage: null,
          pageCount: null,
          summary: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        message: 'Document uploaded successfully and queued for processing',
      });
    });
  });

  describe('findAllForUser', () => {
    it('returns paginated documents with accurate total and totalPages', async () => {
      const userId = 'user-1';
      const now = new Date();
      const mockDocs = [
        {
          id: 'doc-1',
          userId,
          title: 'doc1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          status: 'READY',
          errorMessage: null,
          pageCount: 5,
          summary: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'doc-2',
          userId,
          title: 'doc2.txt',
          mimeType: 'text/plain',
          sizeBytes: 200,
          status: 'UPLOADED',
          errorMessage: null,
          pageCount: 1,
          summary: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocs);
      mockPrisma.document.count.mockResolvedValue(15);

      const result = await service.findAllForUser(userId, { page: 2, limit: 10 });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(mockPrisma.document.count).toHaveBeenCalledWith({ where: { userId } });

      expect(result).toEqual({
        items: [
          {
            id: 'doc-1',
            userId,
            title: 'doc1.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 100,
            status: 'READY',
            errorMessage: null,
            pageCount: 5,
            summary: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          {
            id: 'doc-2',
            userId,
            title: 'doc2.txt',
            mimeType: 'text/plain',
            sizeBytes: 200,
            status: 'UPLOADED',
            errorMessage: null,
            pageCount: 1,
            summary: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
      });
    });

    it('returns empty array when user has no documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      const result = await service.findAllForUser('user-empty', { page: 1, limit: 10 });

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });
  });

  describe('findOneForUser', () => {
    it('returns document when caller is owner', async () => {
      const userId = 'user-owner';
      const docId = 'doc-123';
      const now = new Date();
      const mockDoc = {
        id: docId,
        userId,
        title: 'biology.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 500,
        status: 'READY',
        errorMessage: null,
        pageCount: 10,
        summary: 'A summary',
        createdAt: now,
        updatedAt: now,
      };

      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

      const result = await service.findOneForUser(userId, docId);

      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: docId },
      });
      expect(result).toEqual({
        id: docId,
        userId,
        title: 'biology.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 500,
        status: 'READY',
        errorMessage: null,
        pageCount: 10,
        summary: 'A summary',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it('throws 404 NOT_FOUND when document does not exist', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(service.findOneForUser('user-1', 'doc-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 NOT_FOUND when caller is not the owner (IDOR protection)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-other',
        userId: 'owner-user',
        title: 'private.pdf',
      });

      await expect(service.findOneForUser('attacker-user', 'doc-other')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteForUser', () => {
    it('deletes S3 file and database document record when caller is owner', async () => {
      const userId = 'user-owner';
      const docId = 'doc-to-delete';
      const storageKey = 'user-owner/file-uuid.pdf';

      mockPrisma.document.findUnique.mockResolvedValue({
        id: docId,
        userId,
        storageKey,
      });
      mockStorage.delete.mockResolvedValue(undefined);
      mockPrisma.document.delete.mockResolvedValue({ id: docId });

      await service.deleteForUser(userId, docId);

      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: docId },
      });
      expect(mockStorage.delete).toHaveBeenCalledWith(storageKey);
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({
        where: { id: docId },
      });
    });

    it('throws 404 NOT_FOUND when trying to delete non-existent document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(service.deleteForUser('user-1', 'doc-missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorage.delete).not.toHaveBeenCalled();
      expect(mockPrisma.document.delete).not.toHaveBeenCalled();
    });

    it('throws 404 NOT_FOUND when trying to delete another users document (IDOR protection)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-other',
        userId: 'owner-user',
        storageKey: 'owner/file.pdf',
      });

      await expect(service.deleteForUser('attacker-user', 'doc-other')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorage.delete).not.toHaveBeenCalled();
      expect(mockPrisma.document.delete).not.toHaveBeenCalled();
    });
  });
});
