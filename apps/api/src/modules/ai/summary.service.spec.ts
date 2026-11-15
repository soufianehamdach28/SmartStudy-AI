import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmService } from '../../core/llm/llm.service.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { UsageService } from '../usage/usage.service.js';
import {
  DocumentNotReadyException,
  DocumentProcessingFailedException,
} from './ai.exceptions.js';
import { SummaryService } from './summary.service.js';

describe('SummaryService', () => {
  let summaryService: SummaryService;
  let prismaMock: {
    document: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    documentChunk: {
      findMany: ReturnType<typeof vi.fn>;
    };
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

  beforeEach(() => {
    prismaMock = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      documentChunk: {
        findMany: vi.fn(),
      },
    };

    llmMock = {
      generateJson: vi.fn(),
    };

    usageServiceMock = {
      checkQuota: vi.fn(),
      recordUsage: vi.fn(),
    };

    summaryService = new SummaryService(
      prismaMock as unknown as PrismaService,
      llmMock as unknown as LlmService,
      usageServiceMock as unknown as UsageService,
    );
  });

  it('returns cached summary immediately without calling LLM or deducting quota', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: documentId,
      userId,
      title: 'Operating Systems',
      summary: 'Pre-existing summary in database',
      status: 'READY',
    });

    const response = await summaryService.summarizeDocument(userId, documentId);

    expect(response).toEqual({
      documentId,
      summary: 'Pre-existing summary in database',
      cached: true,
    });
    expect(llmMock.generateJson).not.toHaveBeenCalled();
    expect(usageServiceMock.checkQuota).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when document does not exist', async () => {
    prismaMock.document.findUnique.mockResolvedValue(null);

    await expect(summaryService.summarizeDocument(userId, documentId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when document belongs to another user (IDOR prevention)', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: documentId,
      userId: 'different-user-id',
      title: 'Secret Document',
      status: 'READY',
    });

    await expect(summaryService.summarizeDocument(userId, documentId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws DocumentNotReadyException when document is still PROCESSING or UPLOADED', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: documentId,
      userId,
      title: 'Physics 101',
      status: 'PROCESSING',
      summary: null,
    });

    await expect(summaryService.summarizeDocument(userId, documentId)).rejects.toThrow(
      DocumentNotReadyException,
    );
  });

  it('throws DocumentProcessingFailedException when document status is FAILED', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: documentId,
      userId,
      title: 'Corrupted.pdf',
      status: 'FAILED',
      errorMessage: 'Scanned PDF not supported',
      summary: null,
    });

    await expect(summaryService.summarizeDocument(userId, documentId)).rejects.toThrow(
      DocumentProcessingFailedException,
    );
  });

  it('generates summary with LLM, persists to DB, logs usage and returns cached: false', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: documentId,
      userId,
      title: 'Introduction to Algorithms',
      status: 'READY',
      summary: null,
    });

    prismaMock.documentChunk.findMany.mockResolvedValue([
      { page: 1, text: 'Algorithm analysis is essential.' },
      { page: 2, text: 'Big-O notation describes asymptotic bounds.' },
    ]);

    llmMock.generateJson.mockResolvedValue({
      data: {
        summary: 'A thorough introduction to algorithm efficiency.',
        keyTakeaways: [
          'Big-O notation provides upper bounds',
          'Worst-case analysis guarantees performance',
        ],
      },
      usage: { inputTokens: 450, outputTokens: 120, totalTokens: 570 },
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      latencyMs: 1100,
    });

    prismaMock.document.update.mockResolvedValue({ id: documentId });

    const response = await summaryService.summarizeDocument(userId, documentId);

    expect(usageServiceMock.checkQuota).toHaveBeenCalledWith(userId);
    expect(llmMock.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('CRITICAL SECURITY RULE'),
        prompt: expect.stringContaining('Introduction to Algorithms'),
      }),
    );
    expect(prismaMock.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: { summary: expect.stringContaining('Key Takeaways') },
    });
    expect(usageServiceMock.recordUsage).toHaveBeenCalledWith({
      userId,
      kind: 'SUMMARY',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      tokensIn: 450,
      tokensOut: 120,
      latencyMs: 1100,
      status: 'SUCCESS',
    });
    expect(response.cached).toBe(false);
    expect(response.summary).toContain('Key Takeaways');
  });
});
