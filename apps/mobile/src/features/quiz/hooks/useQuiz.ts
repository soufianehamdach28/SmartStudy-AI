import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  QuizAttemptResponse,
  QuizResponse,
  SubmitQuizAttemptRequest,
} from '@smartstudy/shared';
import { fetchQuizzes, generateQuiz, submitQuizAttempt } from '../api/quiz.api';

export const quizzesQueryKey = (documentId: string) => [
  'documents',
  documentId,
  'quizzes',
] as const;

/**
 * Fetch or automatically generate a quiz for a document.
 */
export function useDocumentQuiz(documentId: string, enabled = true) {
  return useQuery<QuizResponse, Error>({
    queryKey: quizzesQueryKey(documentId),
    queryFn: async () => {
      // 1. Check for existing quizzes
      const existing = await fetchQuizzes(documentId);
      if (existing.length > 0) {
        return existing[0];
      }
      // 2. Otherwise generate a new 5-question quiz
      return generateQuiz(documentId, 5);
    },
    enabled: Boolean(documentId) && enabled,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Mutation to generate a brand new quiz.
 */
export function useGenerateNewQuiz(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation<QuizResponse, Error, number | undefined>({
    mutationFn: (questionCount = 5) => generateQuiz(documentId, questionCount),
    onSuccess: (newQuiz) => {
      queryClient.setQueryData(quizzesQueryKey(documentId), newQuiz);
    },
  });
}

/**
 * Mutation to submit an attempt and receive score breakdown.
 */
export function useSubmitQuizAttempt() {
  return useMutation<
    QuizAttemptResponse,
    Error,
    { quizId: string; data: SubmitQuizAttemptRequest }
  >({
    mutationFn: ({ quizId, data }) => submitQuizAttempt(quizId, data),
  });
}
