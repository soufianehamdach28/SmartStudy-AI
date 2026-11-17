import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUserPayload } from '../../../core/common/decorators/current-user.decorator.js';
import { ConversationsController } from './conversations.controller.js';
import type { ConversationsService } from './conversations.service.js';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let serviceMock: {
    createConversation: ReturnType<typeof vi.fn>;
    listConversations: ReturnType<typeof vi.fn>;
    getConversation: ReturnType<typeof vi.fn>;
    deleteConversation: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };

  const currentUser: CurrentUserPayload = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'student@example.com',
    role: 'STUDENT',
  };

  const conversationId = '22222222-2222-2222-2222-222222222222';
  const documentId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    serviceMock = {
      createConversation: vi.fn(),
      listConversations: vi.fn(),
      getConversation: vi.fn(),
      deleteConversation: vi.fn(),
      sendMessage: vi.fn(),
    };

    controller = new ConversationsController(
      serviceMock as unknown as ConversationsService,
    );
  });

  it('delegates createConversation to service', async () => {
    const expected = {
      id: conversationId,
      userId: currentUser.userId,
      documentId,
      title: 'Chat: Test Doc',
      createdAt: '2026-11-17T02:00:00.000Z',
    };
    serviceMock.createConversation.mockResolvedValueOnce(expected);

    const result = await controller.createConversation(currentUser, {
      documentId,
    });

    expect(serviceMock.createConversation).toHaveBeenCalledWith(
      currentUser.userId,
      { documentId },
    );
    expect(result).toBe(expected);
  });

  it('delegates listConversations to service', async () => {
    const expected = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
    serviceMock.listConversations.mockResolvedValueOnce(expected);

    const result = await controller.listConversations(currentUser, {
      page: 1,
      limit: 20,
    });

    expect(serviceMock.listConversations).toHaveBeenCalledWith(
      currentUser.userId,
      { page: 1, limit: 20 },
    );
    expect(result).toBe(expected);
  });

  it('delegates getConversation to service', async () => {
    const expected = {
      id: conversationId,
      userId: currentUser.userId,
      documentId,
      title: 'Chat: Test Doc',
      createdAt: '2026-11-17T02:00:00.000Z',
      messages: [],
    };
    serviceMock.getConversation.mockResolvedValueOnce(expected);

    const result = await controller.getConversation(currentUser, conversationId);

    expect(serviceMock.getConversation).toHaveBeenCalledWith(
      currentUser.userId,
      conversationId,
    );
    expect(result).toBe(expected);
  });

  it('delegates deleteConversation to service', async () => {
    serviceMock.deleteConversation.mockResolvedValueOnce(undefined);

    await controller.deleteConversation(currentUser, conversationId);

    expect(serviceMock.deleteConversation).toHaveBeenCalledWith(
      currentUser.userId,
      conversationId,
    );
  });

  it('delegates sendMessage to service', async () => {
    const expected = {
      userMessage: {
        id: 'msg-u',
        conversationId,
        role: 'USER',
        content: 'Hi',
        citations: [],
        createdAt: '2026-11-17T02:00:00.000Z',
      },
      assistantMessage: {
        id: 'msg-a',
        conversationId,
        role: 'ASSISTANT',
        content: 'Hello',
        citations: [],
        createdAt: '2026-11-17T02:00:01.000Z',
      },
    };
    serviceMock.sendMessage.mockResolvedValueOnce(expected);

    const result = await controller.sendMessage(currentUser, conversationId, {
      content: 'Hi',
    });

    expect(serviceMock.sendMessage).toHaveBeenCalledWith(
      currentUser.userId,
      conversationId,
      { content: 'Hi' },
    );
    expect(result).toBe(expected);
  });
});
