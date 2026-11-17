import axios from 'axios';
import type {
  Conversation,
  ConversationDetailResponse,
  CreateConversationRequest,
  PaginatedConversationsResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@smartstudy/shared';
import { apiClient } from '../../../shared/api/client';

/**
 * Creates a new conversation session for a document.
 */
export async function createConversation(
  data: CreateConversationRequest,
): Promise<Conversation> {
  const response = await apiClient.post<Conversation>('/conversations', data);
  return response.data;
}

/**
 * Fetches a single conversation with its ordered message history.
 */
export async function fetchConversation(
  conversationId: string,
): Promise<ConversationDetailResponse> {
  const response = await apiClient.get<ConversationDetailResponse>(
    `/conversations/${conversationId}`,
  );
  return response.data;
}

/**
 * Lists user's conversations with optional documentId filter and pagination.
 */
export async function fetchConversations(
  documentId?: string,
  page = 1,
  limit = 20,
): Promise<PaginatedConversationsResponse> {
  const response = await apiClient.get<PaginatedConversationsResponse>(
    '/conversations',
    {
      params: {
        page,
        limit,
        ...(documentId ? { documentId } : {}),
      },
    },
  );
  return response.data;
}

/**
 * Sends a user question to a conversation and receives the assistant's answer with citations.
 */
export async function sendMessage(
  conversationId: string,
  data: SendMessageRequest,
): Promise<SendMessageResponse> {
  const response = await apiClient.post<SendMessageResponse>(
    `/conversations/${conversationId}/messages`,
    data,
  );
  return response.data;
}

/**
 * Deletes a conversation session.
 */
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  await apiClient.delete(`/conversations/${conversationId}`);
}

/**
 * Maps chat API error responses to user-friendly messages.
 */
export function parseChatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    const data = error.response.data as
      | { error?: { code?: string; message?: string } }
      | undefined;

    const code = data?.error?.code;
    const message = data?.error?.message;

    switch (code) {
      case 'QUOTA_EXCEEDED':
        return (
          message ??
          'Daily AI request quota reached. Please try again tomorrow.'
        );
      case 'DOCUMENT_NOT_READY':
        return 'This document is still being processed. Please wait a moment.';
      case 'DOCUMENT_PROCESSING_FAILED':
        return message ?? 'Document processing failed.';
      case 'NOT_FOUND':
        return 'Conversation or document was not found.';
      case 'VALIDATION_ERROR':
        return message ?? 'Please enter a valid message.';
      case 'LLM_UNAVAILABLE':
        return 'AI assistant is temporarily unavailable. Please try again shortly.';
      case 'RATE_LIMITED':
        return 'Too many messages sent. Please slow down and try again.';
      default:
        return message ?? 'An unexpected error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
