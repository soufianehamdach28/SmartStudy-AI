import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmService } from '../../../core/llm/llm.service.js';
import type { PrismaService } from '../../../core/prisma/prisma.service.js';
import {
  DocumentNotReadyException,
  DocumentProcessingFailedException,
} from '../ai.exceptions.js';
import type { PostgresRetrieverService } from '../retriever/postgres-retriever.service.js';
import type { UsageService } from '../../usage/usage.service.js';
import type { ChatPromptBuilder } from './chat-prompt.builder.js';
import { ConversationsService } from './conversations.service.js';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prismaMock: {
    document: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    conversation: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    message: {
      findMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let retrieverMock: {
    retrieve: ReturnType<typeof vi.fn>;
  };
  let promptBuilderMock: {
    buildPrompt: ReturnType<typeof vi.fn>;
    validateAndNormalizeCitations: ReturnType<typeof vi.fn>;
  };
  let llmMock: {
    generateJson: ReturnType<typeof vi.fn>;
  };
  let usageServiceMock: {
    checkQuota: ReturnType<typeof vi.fn>;
    recordUsage: ReturnType<typeof vi.fn>;
  };

  const userId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';
  const documentId = '33333333-3333-3333-3333-333333333333';
  const conversationId = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => {
    prismaMock = {
      document: {
        findUnique: vi.fn(),
      },
      conversation: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      message: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn((cb) =>
        cb({
          message: {
            create: vi.fn().mockImplementation(({ data }) =>
              Promise.resolve({
                id: `msg-${data.role.toLowerCase()}`,
                conversationId: data.conversationId,
                role: data.role,
                content: data.content,
                citations: data.citations ?? [],
                createdAt: new Date('2026-11-17T02:00:00.000Z'),
              }),
            ),
          },
        }),
      ),
    };

    retrieverMock = {
      retrieve: vi.fn(),
    };

    promptBuilderMock = {
      buildPrompt: vi.fn().mockReturnValue({
        system: 'System prompt',
        prompt: 'User prompt',
      }),
      validateAndNormalizeCitations: vi.fn(),
    };

    llmMock = {
      generateJson: vi.fn(),
    };

    usageServiceMock = {
      checkQuota: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
    };

    service = new ConversationsService(
      prismaMock as unknown as PrismaService,
      retrieverMock as unknown as PostgresRetrieverService,
      promptBuilderMock as unknown as ChatPromptBuilder,
      llmMock as unknown as LlmService,
      usageServiceMock as unknown as UsageService,
    );
  });

  describe('createConversation', () => {
    it('throws 404 when document does not exist', async () => {
      prismaMock.document.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createConversation(userId, { documentId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when document belongs to another user (IDOR)', async () => {
      prismaMock.document.findUnique.mockResolvedValueOnce({
        id: documentId,
        userId: otherUserId,
        status: 'READY',
      });

      await expect(
        service.createConversation(userId, { documentId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws DocumentNotReadyException when document is PROCESSING', async () => {
      prismaMock.document.findUnique.mockResolvedValueOnce({
        id: documentId,
        userId,
        status: 'PROCESSING',
      });

      await expect(
        service.createConversation(userId, { documentId }),
      ).rejects.toThrow(DocumentNotReadyException);
    });

    it('throws DocumentProcessingFailedException when document status is FAILED', async () => {
      prismaMock.document.findUnique.mockResolvedValueOnce({
        id: documentId,
        userId,
        status: 'FAILED',
        errorMessage: 'OCR failed',
      });

      await expect(
        service.createConversation(userId, { documentId }),
      ).rejects.toThrow(DocumentProcessingFailedException);
    });

    it('creates conversation with default title based on document title', async () => {
      prismaMock.document.findUnique.mockResolvedValueOnce({
        id: documentId,
        userId,
        status: 'READY',
        title: 'Cell Biology Notes',
      });
      prismaMock.conversation.create.mockResolvedValueOnce({
        id: conversationId,
        userId,
        documentId,
        title: 'Chat: Cell Biology Notes',
        createdAt: new Date('2026-11-17T02:00:00.000Z'),
      });

      const result = await service.createConversation(userId, { documentId });

      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          userId,
          documentId,
          title: 'Chat: Cell Biology Notes',
        },
      });
      expect(result).toEqual({
        id: conversationId,
        userId,
        documentId,
        title: 'Chat: Cell Biology Notes',
        createdAt: '2026-11-17T02:00:00.000Z',
      });
    });

    it('uses custom title when provided', async () => {
      prismaMock.document.findUnique.mockResolvedValueOnce({
        id: documentId,
        userId,
        status: 'READY',
        title: 'Cell Biology Notes',
      });
      prismaMock.conversation.create.mockResolvedValueOnce({
        id: conversationId,
        userId,
        documentId,
        title: 'Exam Review Session',
        createdAt: new Date('2026-11-17T02:00:00.000Z'),
      });

      const result = await service.createConversation(userId, {
        documentId,
        title: '  Exam Review Session  ',
      });

      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          userId,
          documentId,
          title: 'Exam Review Session',
        },
      });
      expect(result.title).toBe('Exam Review Session');
    });
  });

  describe('listConversations', () => {
    it('returns paginated conversations ordered newest first', async () => {
      prismaMock.conversation.count.mockResolvedValueOnce(1);
      prismaMock.conversation.findMany.mockResolvedValueOnce([
        {
          id: conversationId,
          userId,
          documentId,
          title: 'Chat 1',
          createdAt: new Date('2026-11-17T02:00:00.000Z'),
        },
      ]);

      const result = await service.listConversations(userId, {
        page: 1,
        limit: 10,
        documentId,
      });

      expect(prismaMock.conversation.count).toHaveBeenCalledWith({
        where: { userId, documentId },
      });
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith({
        where: { userId, documentId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        items: [
          {
            id: conversationId,
            userId,
            documentId,
            title: 'Chat 1',
            createdAt: '2026-11-17T02:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getConversation', () => {
    it('throws 404 when conversation does not exist or belongs to another user', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getConversation(userId, conversationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns conversation with ordered messages and citations', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce({
        id: conversationId,
        userId,
        documentId,
        title: 'Chat 1',
        createdAt: new Date('2026-11-17T02:00:00.000Z'),
        messages: [
          {
            id: 'msg-1',
            conversationId,
            role: 'USER',
            content: 'Hello',
            citations: [],
            createdAt: new Date('2026-11-17T02:01:00.000Z'),
          },
          {
            id: 'msg-2',
            conversationId,
            role: 'ASSISTANT',
            content: 'Hi there!',
            citations: [
              {
                chunkId: 'chunk-1',
                page: 1,
                excerpt: 'Introduction excerpt',
              },
            ],
            createdAt: new Date('2026-11-17T02:02:00.000Z'),
          },
        ],
      });

      const result = await service.getConversation(userId, conversationId);

      expect(result.id).toBe(conversationId);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]?.citations).toEqual([
        {
          chunkId: 'chunk-1',
          page: 1,
          excerpt: 'Introduction excerpt',
        },
      ]);
    });
  });

  describe('deleteConversation', () => {
    it('throws 404 when conversation not found or owned by another user', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce({
        id: conversationId,
        userId: otherUserId,
      });

      await expect(
        service.deleteConversation(userId, conversationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes conversation when user owns it', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce({
        id: conversationId,
        userId,
      });
      prismaMock.conversation.delete.mockResolvedValueOnce({
        id: conversationId,
      });

      await service.deleteConversation(userId, conversationId);

      expect(prismaMock.conversation.delete).toHaveBeenCalledWith({
        where: { id: conversationId },
      });
    });
  });

  describe('sendMessage', () => {
    const validChunks = [
      {
        id: 'chunk-1',
        documentId,
        page: 2,
        text: 'ATP provides energy for the cell.',
        score: 0.85,
      },
    ];

    it('throws 404 if conversation does not exist or belongs to another user', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.sendMessage(userId, conversationId, {
          content: 'What is ATP?',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws DocumentNotReadyException if associated document is not ready', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce({
        id: conversationId,
        userId,
        documentId,
        document: {
          id: documentId,
          status: 'PROCESSING',
        },
      });

      await expect(
        service.sendMessage(userId, conversationId, {
          content: 'What is ATP?',
        }),
      ).rejects.toThrow(DocumentNotReadyException);
    });

    it('retrieves chunks, builds prompt, queries LLM, normalizes citations, and saves messages', async () => {
      prismaMock.conversation.findUnique.mockResolvedValueOnce({
        id: conversationId,
        userId,
        documentId,
        title: 'Bio Chat',
        document: {
          id: documentId,
          title: 'Cell Biology',
          status: 'READY',
        },
      });

      prismaMock.message.findMany.mockResolvedValueOnce([
        {
          id: 'prev-1',
          role: 'USER',
          content: 'Prior question',
          createdAt: new Date('2026-11-17T01:50:00.000Z'),
        },
      ]);

      retrieverMock.retrieve.mockResolvedValueOnce(validChunks);

      llmMock.generateJson.mockResolvedValueOnce({
        data: {
          answer: 'ATP is the primary energy currency.',
          citations: [
            {
              chunkId: 'chunk-1',
              page: 2,
              excerpt: 'ATP provides energy for the cell.',
            },
          ],
        },
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 120, outputTokens: 40 },
        latencyMs: 320,
      });

      promptBuilderMock.validateAndNormalizeCitations.mockReturnValueOnce([
        {
          chunkId: 'chunk-1',
          page: 2,
          excerpt: 'ATP provides energy for the cell.',
        },
      ]);

      const result = await service.sendMessage(userId, conversationId, {
        content: 'What is ATP?',
      });

      expect(usageServiceMock.checkQuota).toHaveBeenCalledWith(userId);
      expect(retrieverMock.retrieve).toHaveBeenCalledWith(
        documentId,
        'What is ATP?',
        5,
      );
      expect(promptBuilderMock.buildPrompt).toHaveBeenCalledWith({
        documentTitle: 'Cell Biology',
        chunks: validChunks,
        history: [{ role: 'USER', content: 'Prior question' }],
        question: 'What is ATP?',
      });
      expect(llmMock.generateJson).toHaveBeenCalled();
      expect(
        promptBuilderMock.validateAndNormalizeCitations,
      ).toHaveBeenCalledWith(
        [
          {
            chunkId: 'chunk-1',
            page: 2,
            excerpt: 'ATP provides energy for the cell.',
          },
        ],
        validChunks,
      );
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(usageServiceMock.recordUsage).toHaveBeenCalledWith({
        userId,
        kind: 'CHAT',
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        tokensIn: 120,
        tokensOut: 40,
        latencyMs: 320,
        status: 'SUCCESS',
      });
      expect(result.userMessage.content).toBe('What is ATP?');
      expect(result.assistantMessage.content).toBe(
        'ATP is the primary energy currency.',
      );
      expect(result.assistantMessage.citations).toEqual([
        {
          chunkId: 'chunk-1',
          page: 2,
          excerpt: 'ATP provides energy for the cell.',
        },
      ]);
    });
  });
});
