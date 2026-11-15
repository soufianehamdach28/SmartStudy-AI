import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { LlmService } from '../../core/llm/llm.service.js';
import type { UsageService } from '../usage/usage.service.js';
import { MAX_QUIZ_CHUNKS, QuizService } from './quiz.service.js';

describe('QuizService', () => {
  let service: QuizService;
  let prismaMock: {
    document: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    quiz: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    quizAttempt: {
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let llmServiceMock: {
    generateJson: ReturnType<typeof vi.fn>;
  };
  let usageServiceMock: {
    checkQuota: ReturnType<typeof vi.fn>;
    recordUsage: ReturnType<typeof vi.fn>;
  };

  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const otherUserId = '999e4567-e89b-12d3-a456-426614174999';
  const documentId = '223e4567-e89b-12d3-a456-426614174001';
  const chunkId1 = '323e4567-e89b-12d3-a456-426614174002';
  const chunkId2 = '423e4567-e89b-12d3-a456-426614174003';
  const quizId = '523e4567-e89b-12d3-a456-426614174004';
  const qId1 = '623e4567-e89b-12d3-a456-426614174005';
  const qId2 = '723e4567-e89b-12d3-a456-426614174006';

  beforeEach(() => {
    prismaMock = {
      document: {
        findUnique: vi.fn(),
      },
      quiz: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      quizAttempt: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    llmServiceMock = {
      generateJson: vi.fn(),
    };

    usageServiceMock = {
      checkQuota: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
    };

    service = new QuizService(
      prismaMock as unknown as PrismaService,
      llmServiceMock as unknown as LlmService,
      usageServiceMock as unknown as UsageService,
    );
  });

  describe('sampleChunks', () => {
    it('returns all chunks if count <= maxCount', () => {
      const chunks = [
        { id: '1', page: 1, text: 'A' },
        { id: '2', page: 2, text: 'B' },
      ];
      expect(service.sampleChunks(chunks, 5)).toEqual(chunks);
    });

    it('samples evenly up to maxCount when chunks exceed limit', () => {
      const chunks = Array.from({ length: 30 }, (_, i) => ({
        id: `chunk-${i}`,
        page: i + 1,
        text: `Content ${i}`,
      }));
      const sampled = service.sampleChunks(chunks, MAX_QUIZ_CHUNKS);
      expect(sampled.length).toBe(MAX_QUIZ_CHUNKS);
      expect(sampled[0].id).toBe('chunk-0');
      expect(sampled[sampled.length - 1].id).toBe('chunk-29');
    });
  });

  describe('generateQuiz', () => {
    it('throws 404 NOT_FOUND if document does not exist', async () => {
      prismaMock.document.findUnique.mockResolvedValue(null);

      await expect(
        service.generateQuiz(userId, documentId, { questionCount: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 NOT_FOUND if document belongs to another user (IDOR prevention)', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId: otherUserId,
        status: 'READY',
        chunks: [],
      });

      await expect(
        service.generateQuiz(userId, documentId, { questionCount: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 409 CONFLICT if document is still PROCESSING', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        status: 'PROCESSING',
        chunks: [],
      });

      await expect(
        service.generateQuiz(userId, documentId, { questionCount: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 400 BAD_REQUEST if document status is FAILED', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        status: 'FAILED',
        errorMessage: 'OCR corrupted',
        chunks: [],
      });

      await expect(
        service.generateQuiz(userId, documentId, { questionCount: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checks quota and calls LLM, sanitizes unknown chunk IDs, saves quiz in transaction, and logs usage', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: documentId,
        userId,
        title: 'Biology 101',
        status: 'READY',
        chunks: [
          { id: chunkId1, page: 1, text: 'Mitochondria is powerhouse of the cell.' },
          { id: chunkId2, page: 2, text: 'Ribosomes synthesize proteins.' },
        ],
      });

      llmServiceMock.generateJson.mockResolvedValue({
        data: {
          title: 'Cellular Biology Quiz',
          questions: [
            {
              prompt: 'What synthesizes proteins?',
              options: ['Nucleus', 'Ribosome', 'Golgi', 'Vacuole'],
              correctIndex: 1,
              explanation: 'Ribosomes synthesize proteins.',
              sourceChunkId: chunkId2,
            },
            {
              prompt: 'What produces ATP?',
              options: ['Mitochondria', 'Chloroplast', 'Cytosol', 'Centriole'],
              correctIndex: 0,
              explanation: 'Mitochondria produce ATP.',
              sourceChunkId: '00000000-0000-0000-0000-000000000000', // unknown chunk id
            },
          ],
        },
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        usage: { inputTokens: 300, outputTokens: 120 },
        latencyMs: 850,
      });

      const now = new Date('2026-11-15T12:00:00Z');
      const createdRecord = {
        id: quizId,
        documentId,
        title: 'Cellular Biology Quiz',
        createdAt: now,
        questions: [
          {
            id: qId1,
            quizId,
            prompt: 'What synthesizes proteins?',
            options: ['Nucleus', 'Ribosome', 'Golgi', 'Vacuole'],
            correctIndex: 1,
            explanation: 'Ribosomes synthesize proteins.',
            sourceChunkId: chunkId2,
          },
          {
            id: qId2,
            quizId,
            prompt: 'What produces ATP?',
            options: ['Mitochondria', 'Chloroplast', 'Cytosol', 'Centriole'],
            correctIndex: 0,
            explanation: 'Mitochondria produce ATP.',
            sourceChunkId: null,
          },
        ],
      };

      prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txMock = {
          quiz: {
            create: vi.fn().mockResolvedValue(createdRecord),
          },
        };
        return cb(txMock);
      });

      const result = await service.generateQuiz(userId, documentId, { questionCount: 2 });

      expect(usageServiceMock.checkQuota).toHaveBeenCalledWith(userId);
      expect(llmServiceMock.generateJson).toHaveBeenCalled();
      expect(usageServiceMock.recordUsage).toHaveBeenCalledWith({
        userId,
        kind: 'QUIZ',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        tokensIn: 300,
        tokensOut: 120,
        latencyMs: 850,
        status: 'SUCCESS',
      });
      expect(result.id).toBe(quizId);
      expect(result.questions.length).toBe(2);
      expect(result.questions[0].sourceChunkId).toBe(chunkId2);
      expect(result.questions[1].sourceChunkId).toBeNull();
    });
  });

  describe('getDocumentQuizzes', () => {
    it('throws 404 NOT_FOUND if document belongs to another user', async () => {
      prismaMock.document.findUnique.mockResolvedValue({ userId: otherUserId });

      await expect(
        service.getDocumentQuizzes(userId, documentId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns quizzes for a valid document', async () => {
      prismaMock.document.findUnique.mockResolvedValue({ userId });
      const now = new Date('2026-11-15T12:00:00Z');
      prismaMock.quiz.findMany.mockResolvedValue([
        {
          id: quizId,
          documentId,
          title: 'Quiz 1',
          createdAt: now,
          questions: [
            {
              id: qId1,
              quizId,
              prompt: 'Q1',
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 0,
              explanation: 'Exp',
              sourceChunkId: null,
            },
          ],
        },
      ]);

      const result = await service.getDocumentQuizzes(userId, documentId);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(quizId);
      expect(result[0].questions[0].prompt).toBe('Q1');
    });
  });

  describe('submitAttempt', () => {
    it('throws 404 NOT_FOUND if quiz does not exist or owner mismatch', async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.submitAttempt(userId, quizId, { answers: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 400 VALIDATION_ERROR if questions do not belong to quiz', async () => {
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: quizId,
        document: { userId },
        questions: [
          { id: qId1, correctIndex: 1, explanation: 'Exp 1' },
        ],
      });

      await expect(
        service.submitAttempt(userId, quizId, {
          answers: [{ questionId: '00000000-0000-0000-0000-000000000000', selectedIndex: 0 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 400 VALIDATION_ERROR if duplicate answers provided for same question', async () => {
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: quizId,
        document: { userId },
        questions: [
          { id: qId1, correctIndex: 1, explanation: 'Exp 1' },
          { id: qId2, correctIndex: 0, explanation: 'Exp 2' },
        ],
      });

      await expect(
        service.submitAttempt(userId, quizId, {
          answers: [
            { questionId: qId1, selectedIndex: 0 },
            { questionId: qId1, selectedIndex: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 400 VALIDATION_ERROR if attempt is incomplete', async () => {
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: quizId,
        document: { userId },
        questions: [
          { id: qId1, correctIndex: 1, explanation: 'Exp 1' },
          { id: qId2, correctIndex: 0, explanation: 'Exp 2' },
        ],
      });

      await expect(
        service.submitAttempt(userId, quizId, {
          answers: [{ questionId: qId1, selectedIndex: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('correctly grades answers, computes score, creates attempt in DB and returns breakdown', async () => {
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: quizId,
        document: { userId },
        questions: [
          { id: qId1, correctIndex: 1, explanation: 'Exp 1' },
          { id: qId2, correctIndex: 2, explanation: 'Exp 2' },
        ],
      });

      const now = new Date('2026-11-15T12:30:00Z');
      prismaMock.quizAttempt.create.mockResolvedValue({
        id: 'attempt-123',
        quizId,
        userId,
        score: 50.0,
        completedAt: now,
      });

      const result = await service.submitAttempt(userId, quizId, {
        answers: [
          { questionId: qId1, selectedIndex: 1 }, // correct
          { questionId: qId2, selectedIndex: 0 }, // incorrect
        ],
      });

      expect(prismaMock.quizAttempt.create).toHaveBeenCalledWith({
        data: {
          quizId,
          userId,
          score: 50.0,
          answers: [
            {
              questionId: qId1,
              selectedIndex: 1,
              correctIndex: 1,
              isCorrect: true,
              explanation: 'Exp 1',
            },
            {
              questionId: qId2,
              selectedIndex: 0,
              correctIndex: 2,
              isCorrect: false,
              explanation: 'Exp 2',
            },
          ],
        },
      });

      expect(result.id).toBe('attempt-123');
      expect(result.score).toBe(50.0);
      expect(result.correctCount).toBe(1);
      expect(result.totalQuestions).toBe(2);
      expect(result.answers[0].isCorrect).toBe(true);
      expect(result.answers[1].isCorrect).toBe(false);
    });
  });
});
