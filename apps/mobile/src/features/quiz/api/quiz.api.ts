import axios from 'axios';
import {
  type QuizAttemptResponse,
  type QuizResponse,
  type SubmitQuizAttemptRequest,
} from '@smartstudy/shared';
import { apiClient } from '../../../shared/api/client';

/**
 * Fetch previously generated quizzes for a document.
 */
export async function fetchQuizzes(documentId: string): Promise<QuizResponse[]> {
  const response = await apiClient.get<QuizResponse[]>(`/documents/${documentId}/quizzes`);
  return response.data;
}

/**
 * Generate a new multi-choice quiz for a document using AI.
 */
export async function generateQuiz(
  documentId: string,
  questionCount = 5,
): Promise<QuizResponse> {
  const response = await apiClient.post<QuizResponse>(
    `/documents/${documentId}/quizzes`,
    { questionCount },
  );
  return response.data;
}

/**
 * Submit student answers for a quiz to be evaluated and graded.
 */
export async function submitQuizAttempt(
  quizId: string,
  data: SubmitQuizAttemptRequest,
): Promise<QuizAttemptResponse> {
  const response = await apiClient.post<QuizAttemptResponse>(
    `/quizzes/${quizId}/attempts`,
    data,
  );
  return response.data;
}

/**
 * Map quiz API error responses to user-friendly messages.
 */
export function parseQuizErrorMessage(error: unknown): string {
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
        return message ?? 'Daily AI request quota reached. Please try again tomorrow.';
      case 'DOCUMENT_NOT_READY':
        return 'The document is still being processed. Please wait a moment.';
      case 'DOCUMENT_PROCESSING_FAILED':
        return message ?? 'Document processing failed.';
      case 'NOT_FOUND':
        return 'Quiz or document not found.';
      case 'VALIDATION_ERROR':
        return message ?? 'Invalid quiz answers submitted.';
      case 'LLM_UNAVAILABLE':
        return 'AI service is temporarily unavailable. Please try again shortly.';
      default:
        return message ?? 'An unexpected error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
