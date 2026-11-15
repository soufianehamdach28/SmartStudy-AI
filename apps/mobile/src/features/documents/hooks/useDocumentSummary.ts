import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentSummaryResponse } from '@smartstudy/shared';
import { fetchDocumentSummary } from '../api/documents.api';

export const documentSummaryQueryKey = (documentId: string) => [
  'documents',
  documentId,
  'summary',
] as const;

/**
 * Fetch or load the cached summary of a document.
 */
export function useDocumentSummary(documentId: string, enabled = true) {
  return useQuery<DocumentSummaryResponse, Error>({
    queryKey: documentSummaryQueryKey(documentId),
    queryFn: () => fetchDocumentSummary(documentId),
    enabled: Boolean(documentId) && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

/**
 * Force regenerate the document summary.
 */
export function useRegenerateDocumentSummary(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation<DocumentSummaryResponse, Error, void>({
    mutationFn: () => fetchDocumentSummary(documentId),
    onSuccess: (data) => {
      queryClient.setQueryData(documentSummaryQueryKey(documentId), data);
    },
  });
}
