import { AxiosError } from 'axios';
import {
  createConversation,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  parseChatErrorMessage,
  sendMessage,
} from './chat.api';
import { apiClient } from '../../../shared/api/client';

jest.mock('../../../shared/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('chat.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('calls POST /conversations with payload', async () => {
      const mockConv = {
        id: 'conv-1',
        userId: 'user-1',
        documentId: 'doc-1',
        title: 'Chat: Bio',
        createdAt: '2026-11-17T02:00:00.000Z',
      };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockConv });

      const result = await createConversation({ documentId: 'doc-1' });

      expect(apiClient.post).toHaveBeenCalledWith('/conversations', {
        documentId: 'doc-1',
      });
      expect(result).toEqual(mockConv);
    });
  });

  describe('fetchConversation', () => {
    it('calls GET /conversations/:id and returns conversation detail', async () => {
      const mockDetail = {
        id: 'conv-1',
        userId: 'user-1',
        documentId: 'doc-1',
        title: 'Chat: Bio',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [],
      };
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockDetail });

      const result = await fetchConversation('conv-1');

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-1');
      expect(result).toEqual(mockDetail);
    });
  });

  describe('fetchConversations', () => {
    it('calls GET /conversations with pagination and documentId params', async () => {
      const mockPaginated = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockPaginated,
      });

      const result = await fetchConversations('doc-1', 2, 10);

      expect(apiClient.get).toHaveBeenCalledWith('/conversations', {
        params: { documentId: 'doc-1', page: 2, limit: 10 },
      });
      expect(result).toEqual(mockPaginated);
    });
  });

  describe('sendMessage', () => {
    it('calls POST /conversations/:id/messages with content', async () => {
      const mockResponse = {
        userMessage: {
          id: 'msg-u',
          conversationId: 'conv-1',
          role: 'USER',
          content: 'What is DNA?',
          citations: [],
          createdAt: '2026-11-17T02:00:00.000Z',
        },
        assistantMessage: {
          id: 'msg-a',
          conversationId: 'conv-1',
          role: 'ASSISTANT',
          content: 'DNA is genetic material.',
          citations: [],
          createdAt: '2026-11-17T02:00:01.000Z',
        },
      };
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await sendMessage('conv-1', { content: 'What is DNA?' });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/conversations/conv-1/messages',
        { content: 'What is DNA?' },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteConversation', () => {
    it('calls DELETE /conversations/:id', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValueOnce({});

      await deleteConversation('conv-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-1');
    });
  });

  describe('parseChatErrorMessage', () => {
    it('returns network error message when there is no response', () => {
      const axiosError = new AxiosError('Network error');
      expect(parseChatErrorMessage(axiosError)).toBe(
        'Unable to connect to the server. Please check your internet connection.',
      );
    });

    it('translates known backend error codes', () => {
      const createErrorWithCode = (code: string) => {
        const error = new AxiosError('Request failed');
        error.response = {
          data: { error: { code } },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        };
        return error;
      };

      expect(
        parseChatErrorMessage(createErrorWithCode('QUOTA_EXCEEDED')),
      ).toBe('Daily AI request quota reached. Please try again tomorrow.');

      expect(
        parseChatErrorMessage(createErrorWithCode('DOCUMENT_NOT_READY')),
      ).toBe('This document is still being processed. Please wait a moment.');

      expect(
        parseChatErrorMessage(createErrorWithCode('NOT_FOUND')),
      ).toBe('Conversation or document was not found.');

      expect(
        parseChatErrorMessage(createErrorWithCode('RATE_LIMITED')),
      ).toBe('Too many messages sent. Please slow down and try again.');
    });

    it('returns generic message for non-Axios Error', () => {
      expect(parseChatErrorMessage(new Error('Custom error'))).toBe(
        'Custom error',
      );
      expect(parseChatErrorMessage('unknown')).toBe(
        'An unexpected error occurred.',
      );
    });
  });
});
