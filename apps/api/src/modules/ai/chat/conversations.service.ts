import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  llmChatOutputSchema,
  type Citation,
  type Conversation,
  type ConversationDetailResponse,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type MessageRole,
  type PaginatedConversationsResponse,
  type SendMessageRequest,
  type SendMessageResponse,
} from '@smartstudy/shared';
import { LlmService } from '../../../core/llm/llm.service.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import {
  DocumentNotReadyException,
  DocumentProcessingFailedException,
} from '../ai.exceptions.js';
import { PostgresRetrieverService } from '../retriever/postgres-retriever.service.js';
import { UsageService } from '../../usage/usage.service.js';
import {
  ChatPromptBuilder,
  MAX_CHAT_HISTORY_MESSAGES,
} from './chat-prompt.builder.js';
import type { Prisma } from '../../../generated/prisma/client.js';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retriever: PostgresRetrieverService,
    private readonly promptBuilder: ChatPromptBuilder,
    private readonly llm: LlmService,
    private readonly usageService: UsageService,
  ) {}

  /**
   * Creates a new chat session linked to a document.
   */
  async createConversation(
    userId: string,
    dto: CreateConversationRequest,
  ): Promise<Conversation> {
    const document = await this.prisma.document.findUnique({
      where: { id: dto.documentId },
    });

    if (!document || document.userId !== userId) {
      throw new NotFoundException(
        `Document with ID "${dto.documentId}" was not found.`,
      );
    }

    if (document.status === 'UPLOADED' || document.status === 'PROCESSING') {
      throw new DocumentNotReadyException();
    }
    if (document.status === 'FAILED') {
      throw new DocumentProcessingFailedException(
        document.errorMessage ?? 'Document processing failed.',
      );
    }

    const title =
      dto.title?.trim() || `Chat: ${document.title.slice(0, 100)}`;

    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        documentId: document.id,
        title,
      },
    });

    return {
      id: conversation.id,
      userId: conversation.userId,
      documentId: conversation.documentId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  /**
   * Lists conversations for the current user with pagination and optional documentId filter.
   */
  async listConversations(
    userId: string,
    query: ListConversationsQuery,
  ): Promise<PaginatedConversationsResponse> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 50);
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.documentId ? { documentId: query.documentId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        userId: c.userId,
        documentId: c.documentId,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  /**
   * Retrieves a conversation along with its full ordered message history.
   */
  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDetailResponse> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException(
        `Conversation with ID "${conversationId}" was not found.`,
      );
    }

    return {
      id: conversation.id,
      userId: conversation.userId,
      documentId: conversation.documentId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as MessageRole,
        content: m.content,
        citations: (m.citations as unknown as Citation[]) || [],
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Deletes a conversation and its messages. Real cascade deletion.
   */
  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException(
        `Conversation with ID "${conversationId}" was not found.`,
      );
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });
  }

  /**
   * Sends a user question, retrieves relevant chunks, queries the LLM with injection defenses,
   * validates citations against retrieved chunks, and persists both messages.
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageRequest,
  ): Promise<SendMessageResponse> {
    // 1. Verify conversation ownership and document status
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        document: true,
      },
    });

    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException(
        `Conversation with ID "${conversationId}" was not found.`,
      );
    }

    if (
      conversation.document.status === 'UPLOADED' ||
      conversation.document.status === 'PROCESSING'
    ) {
      throw new DocumentNotReadyException();
    }
    if (conversation.document.status === 'FAILED') {
      throw new DocumentProcessingFailedException(
        conversation.document.errorMessage ?? 'Document processing failed.',
      );
    }

    // 2. Enforce AI quota
    await this.usageService.checkQuota(userId);

    // 3. Load recent conversation history (up to MAX_CHAT_HISTORY_MESSAGES)
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CHAT_HISTORY_MESSAGES,
    });
    const history = recentMessages.reverse().map((m) => ({
      role: m.role as MessageRole,
      content: m.content,
    }));

    // 4. Retrieve relevant chunks using full-text search
    const chunks = await this.retriever.retrieve(
      conversation.documentId,
      dto.content,
      5,
    );

    // 5. Build prompt with injection defenses
    const { system, prompt } = this.promptBuilder.buildPrompt({
      documentTitle: conversation.document.title,
      chunks,
      history,
      question: dto.content,
    });

    // 6. Call LLM for structured answer + citations
    const result = await this.llm.generateJson({
      system,
      prompt,
      schema: llmChatOutputSchema,
      temperature: 0.3,
    });

    // 7. Validate and normalize citations against actual retrieved chunks
    const validCitations = this.promptBuilder.validateAndNormalizeCitations(
      result.data.citations,
      chunks,
    );

    // 8. Persist user and assistant messages in a transaction
    const [userMsg, assistantMsg] = await this.prisma.$transaction(
      async (tx) => {
        const u = await tx.message.create({
          data: {
            conversationId,
            role: 'USER',
            content: dto.content.trim(),
            citations: [],
          },
        });

        const a = await tx.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: result.data.answer.trim(),
            citations: validCitations as unknown as Prisma.InputJsonValue,
          },
        });

        return [u, a];
      },
    );

    // 9. Record telemetry
    await this.usageService.recordUsage({
      userId,
      kind: 'CHAT',
      provider: result.provider,
      model: result.model,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
      latencyMs: result.latencyMs,
      status: 'SUCCESS',
    });

    this.logger.log(
      `Handled chat question for conversation "${conversationId}" (${result.provider}/${result.model}) with ${validCitations.length} citation(s)`,
    );

    return {
      userMessage: {
        id: userMsg.id,
        conversationId: userMsg.conversationId,
        role: userMsg.role as MessageRole,
        content: userMsg.content,
        citations: [],
        createdAt: userMsg.createdAt.toISOString(),
      },
      assistantMessage: {
        id: assistantMsg.id,
        conversationId: assistantMsg.conversationId,
        role: assistantMsg.role as MessageRole,
        content: assistantMsg.content,
        citations: validCitations,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
    };
  }
}
