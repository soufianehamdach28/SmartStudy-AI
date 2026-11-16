import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlashcardsResponse } from '@smartstudy/shared';
import { fetchFlashcards, generateFlashcards } from '../api/documents.api';

export const flashcardsQueryKey = (documentId: string) => [
  'documents',
  documentId,
  'flashcards',
] as const;

/**
 * Fetch or automatically generate flashcards for a document.
 */
export function useFlashcards(documentId: string, enabled = true) {
  return useQuery<FlashcardsResponse, Error>({
    queryKey: flashcardsQueryKey(documentId),
    queryFn: async () => {
      // 1. Try to load existing/cached flashcards
      const existing = await fetchFlashcards(documentId);
      if (existing.flashcards && existing.flashcards.length > 0) {
        return existing;
      }
      // 2. If no flashcards exist yet, trigger generation
      return generateFlashcards(documentId, 10);
    },
    enabled: Boolean(documentId) && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

/**
 * Force regenerate flashcards for a document with custom count.
 */
export function useRegenerateFlashcards(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation<FlashcardsResponse, Error, number | undefined>({
    mutationFn: (count = 10) => generateFlashcards(documentId, count),
    onSuccess: (data) => {
      queryClient.setQueryData(flashcardsQueryKey(documentId), data);
    },
  });
}
