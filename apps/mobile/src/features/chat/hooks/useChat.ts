import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Conversation,
  ConversationDetailResponse,
  CreateConversationRequest,
  PaginatedConversationsResponse,
  SendMessageResponse,
} from '@smartstudy/shared';
import {
  createConversation,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  sendMessage,
} from '../api/chat.api';

export const CHAT_QUERY_KEYS = {
  all: ['conversations'] as const,
  byDocument: (documentId: string) =>
    ['conversations', 'document', documentId] as const,
  detail: (conversationId: string) =>
    ['conversations', 'detail', conversationId] as const,
};

/**
 * Fetches conversations for a document.
 */
export function useDocumentConversations(documentId?: string) {
  return useQuery<PaginatedConversationsResponse>({
    queryKey: CHAT_QUERY_KEYS.byDocument(documentId ?? ''),
    queryFn: () => fetchConversations(documentId),
    enabled: Boolean(documentId),
  });
}

/**
 * Fetches a conversation and its messages.
 */
export function useConversation(conversationId?: string) {
  return useQuery<ConversationDetailResponse>({
    queryKey: CHAT_QUERY_KEYS.detail(conversationId ?? ''),
    queryFn: () => fetchConversation(conversationId!),
    enabled: Boolean(conversationId),
  });
}

/**
 * Mutation to create a new conversation session for a document.
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<Conversation, unknown, CreateConversationRequest>({
    mutationFn: (data) => createConversation(data),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.all });
      queryClient.setQueryData<ConversationDetailResponse>(
        CHAT_QUERY_KEYS.detail(newConv.id),
        {
          ...newConv,
          messages: [],
        },
      );
    },
  });
}

/**
 * Mutation to send a message to the conversation.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, unknown, string>({
    mutationFn: (content: string) =>
      sendMessage(conversationId, { content }),
    onSuccess: (data) => {
      // Invalidate AI usage record cache
      queryClient.invalidateQueries({ queryKey: ['usage'] });

      // Update cached conversation with the new user and assistant messages
      queryClient.setQueryData<ConversationDetailResponse>(
        CHAT_QUERY_KEYS.detail(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...old.messages, data.userMessage, data.assistantMessage],
          };
        },
      );
    },
  });
}

/**
 * Mutation to delete a conversation session.
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string>({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.all });
      queryClient.removeQueries({
        queryKey: CHAT_QUERY_KEYS.detail(conversationId),
      });
    },
  });
}
