import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmService } from '../../core/llm/llm.service.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { QuotaExceededException } from '../usage/usage.exceptions.js';
import type { UsageService } from '../usage/usage.service.js';
import {
  DocumentNotReadyException,
  DocumentProcessingFailedException,
} from './ai.exceptions.js';
import { FlashcardsService } from './flashcards.service.js';

describe('FlashcardsService', () => {
  let flashcardsService: FlashcardsService;
  let prismaMock: {
    document: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    flashcard: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    documentChunk: {
      findMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let llmMock: {
    generateJson: ReturnType<typeof vi.fn>;
  };
  let usageServiceMock: {
    checkQuota: ReturnType<typeof vi.fn>;
    recordUsage: ReturnType<typeof vi.fn>;
  };

  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const documentId = '223e4567-e89b-12d3-a456-426614174001';
  const cardId1 = '323e4567-e89b-12d3-a456-426614174002';
  const cardId2 = '423e4567-e89b-12d3-a456-426614174003';

  beforeEach(() => {
    prismaMock = {
      document: {
        findUnique: vi.fn(),
      },
      flashcard: {
        findMany: vi.fn(),
        create: vi.fn((args: { data: { documentId: string; front: string; back: string } }) =>
          Promise.resolve({ id: cardId1, ...args.data }),
        ),
      },
      documentChunk: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    llmMock = {
      generateJson: vi.fn(),
    };

    usageServiceMock = {
      checkQuota: vi.fn(),
      recordUsage: vi.fn(),
    };

    flashcardsService = new FlashcardsService(
      prismaMock as unknown as PrismaService,
      llmMock as unknown as LlmService,
      usageServiceMock as unknown as UsageService,
    );
  });

  describe('getFlashcards', () => {
    it('returns stored flashcards for an owned document', async () => {
      prismaMock.document.findUnique.mockResolvedValue({ id: documentId, userId });
      prismaMock.flashcard.findMany.mockResolvedValue([
        { id: cardId1, documentId, front: 'Q1', back: 'A1' },
      ]);

      const result = await flashcardsService.getFlashcards(userId, documentId);

      expect(result).toEqual({
        documentId,
        flashcards: [{ id: cardId1, documentId, front: 'Q1', back: 'A1' }],
      });
    });

    it('throws NotFoundException when document does not exist or belongs to another user', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId: 'other-user-id',
      });

      await expect(flashcardsService.getFlashcards(userId, documentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateFlashcards', () => {
    it('returns cached flashcards without calling LLM or checking quota', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        title: 'Biology 101',
        status: 'READY',
      });
      prismaMock.flashcard.findMany.mockResolvedValue([
        { id: cardId1, documentId, front: 'What is mitosis?', back: 'Cell division.' },
      ]);

      const result = await flashcardsService.generateFlashcards(userId, documentId, 10);

      expect(result.flashcards).toHaveLength(1);
      expect(llmMock.generateJson).not.toHaveBeenCalled();
      expect(usageServiceMock.checkQuota).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when document belongs to another user (IDOR prevention)', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId: 'other-user',
        status: 'READY',
      });

      await expect(flashcardsService.generateFlashcards(userId, documentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws DocumentNotReadyException when document is PROCESSING or UPLOADED', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        title: 'Notes.pdf',
        status: 'PROCESSING',
      });
      prismaMock.flashcard.findMany.mockResolvedValue([]);

      await expect(flashcardsService.generateFlashcards(userId, documentId)).rejects.toThrow(
        DocumentNotReadyException,
      );
    });

    it('throws DocumentProcessingFailedException when document status is FAILED', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        title: 'Corrupted.pdf',
        status: 'FAILED',
        errorMessage: 'Extraction failed',
      });
      prismaMock.flashcard.findMany.mockResolvedValue([]);

      await expect(flashcardsService.generateFlashcards(userId, documentId)).rejects.toThrow(
        DocumentProcessingFailedException,
      );
    });

    it('throws QuotaExceededException when user quota is exhausted', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        title: 'Physics',
        status: 'READY',
      });
      prismaMock.flashcard.findMany.mockResolvedValue([]);
      usageServiceMock.checkQuota.mockRejectedValue(new QuotaExceededException());

      await expect(flashcardsService.generateFlashcards(userId, documentId)).rejects.toThrow(
        QuotaExceededException,
      );
      expect(llmMock.generateJson).not.toHaveBeenCalled();
    });

    it('generates flashcards with LLM, persists in transaction, and logs usage', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        title: 'Linear Algebra',
        status: 'READY',
      });
      prismaMock.flashcard.findMany.mockResolvedValue([]);
      prismaMock.documentChunk.findMany.mockResolvedValue([
        { page: 1, text: 'A vector space is closed under addition.' },
        { page: 2, text: 'Eigenvalues satisfy Av = lambda v.' },
      ]);

      llmMock.generateJson.mockResolvedValue({
        data: {
          flashcards: [
            { front: 'Define a vector space.', back: 'A set closed under addition and scalar mult.' },
            { front: 'What is an eigenvalue?', back: 'A scalar lambda where Av = lambda v.' },
          ],
        },
        usage: { inputTokens: 320, outputTokens: 95, totalTokens: 415 },
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        latencyMs: 850,
      });

      prismaMock.flashcard.create
        .mockResolvedValueOnce({
          id: cardId1,
          documentId,
          front: 'Define a vector space.',
          back: 'A set closed under addition and scalar mult.',
        })
        .mockResolvedValueOnce({
          id: cardId2,
          documentId,
          front: 'What is an eigenvalue?',
          back: 'A scalar lambda where Av = lambda v.',
        });

      const result = await flashcardsService.generateFlashcards(userId, documentId, 5);

      expect(usageServiceMock.checkQuota).toHaveBeenCalledWith(userId);
      expect(llmMock.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('CRITICAL SECURITY RULE'),
          prompt: expect.stringContaining('Linear Algebra'),
        }),
      );
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(usageServiceMock.recordUsage).toHaveBeenCalledWith({
        userId,
        kind: 'FLASHCARDS',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        tokensIn: 320,
        tokensOut: 95,
        latencyMs: 850,
        status: 'SUCCESS',
      });
      expect(result).toEqual({
        documentId,
        flashcards: [
          {
            id: cardId1,
            documentId,
            front: 'Define a vector space.',
            back: 'A set closed under addition and scalar mult.',
          },
          {
            id: cardId2,
            documentId,
            front: 'What is an eigenvalue?',
            back: 'A scalar lambda where Av = lambda v.',
          },
        ],
      });
    });
  });
});
