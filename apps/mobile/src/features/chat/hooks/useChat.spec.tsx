import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConversation,
  useCreateConversation,
  useSendMessage,
} from './useChat';
import {
  createConversation,
  fetchConversation,
  sendMessage,
} from '../api/chat.api';

jest.mock('../api/chat.api', () => ({
  createConversation: jest.fn(),
  fetchConversation: jest.fn(),
  sendMessage: jest.fn(),
}));

describe('useChat hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 5000 },
        mutations: { retry: false, gcTime: 5000 },
      },
    });
  });

  describe('useConversation', () => {
    it('fetches conversation when conversationId is provided', async () => {
      const mockDetail = {
        id: 'conv-1',
        userId: 'user-1',
        documentId: 'doc-1',
        title: 'Bio Chat',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [],
      };
      (fetchConversation as jest.Mock).mockResolvedValueOnce(mockDetail);

      let hookValue: any;
      function TestComponent() {
        hookValue = useConversation('conv-1');
        return null;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <TestComponent />
          </QueryClientProvider>,
        );
      });

      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      });

      expect(fetchConversation).toHaveBeenCalledWith('conv-1');
      expect(hookValue.data).toEqual(mockDetail);
    });
  });

  describe('useCreateConversation', () => {
    it('calls createConversation and primes cache', async () => {
      const newConv = {
        id: 'conv-2',
        userId: 'user-1',
        documentId: 'doc-1',
        title: 'New Chat',
        createdAt: '2026-11-17T02:00:00.000Z',
      };
      (createConversation as jest.Mock).mockResolvedValueOnce(newConv);

      let hookValue: any;
      function TestComponent() {
        hookValue = useCreateConversation();
        return null;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <TestComponent />
          </QueryClientProvider>,
        );
      });

      await act(async () => {
        await hookValue.mutateAsync({ documentId: 'doc-1' });
      });

      expect(createConversation).toHaveBeenCalledWith({ documentId: 'doc-1' });
    });
  });

  describe('useSendMessage', () => {
    it('calls sendMessage and appends new messages to query cache', async () => {
      const initialDetail = {
        id: 'conv-1',
        userId: 'user-1',
        documentId: 'doc-1',
        title: 'Bio Chat',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [],
      };
      queryClient.setQueryData(
        ['conversations', 'detail', 'conv-1'],
        initialDetail,
      );

      const sendResponse = {
        userMessage: {
          id: 'msg-u',
          conversationId: 'conv-1',
          role: 'USER',
          content: 'Hello',
          citations: [],
          createdAt: '2026-11-17T02:01:00.000Z',
        },
        assistantMessage: {
          id: 'msg-a',
          conversationId: 'conv-1',
          role: 'ASSISTANT',
          content: 'Hi there',
          citations: [],
          createdAt: '2026-11-17T02:01:01.000Z',
        },
      };
      (sendMessage as jest.Mock).mockResolvedValueOnce(sendResponse);

      let hookValue: any;
      function TestComponent() {
        hookValue = useSendMessage('conv-1');
        return null;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <TestComponent />
          </QueryClientProvider>,
        );
      });

      await act(async () => {
        await hookValue.mutateAsync('Hello');
      });

      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      });

      expect(sendMessage).toHaveBeenCalledWith('conv-1', {
        content: 'Hello',
      });

      const updated = queryClient.getQueryData<any>([
        'conversations',
        'detail',
        'conv-1',
      ]);
      expect(updated.messages).toHaveLength(2);
      expect(updated.messages[0].id).toBe('msg-u');
      expect(updated.messages[1].id).toBe('msg-a');
    });
  });
});
