import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  type DocumentListQuery,
  type DocumentResponse,
  type DocumentUploadResponse,
  type PaginatedDocumentsResponse,
} from '@smartstudy/shared';
import {
  deleteDocument,
  fetchDocument,
  fetchDocuments,
  uploadDocument,
  type FileToUpload,
} from '../api/documents.api';

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (query?: DocumentListQuery) => [...documentKeys.lists(), query ?? {}] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated document list.
 */
export function useDocuments(
  query: DocumentListQuery = { page: 1, limit: 10 },
): UseQueryResult<PaginatedDocumentsResponse, Error> {
  return useQuery({
    queryKey: documentKeys.list(query),
    queryFn: () => fetchDocuments(query),
  });
}

/**
 * Hook to fetch a single document's detail.
 * Automatically polls every 2.5 seconds while status is UPLOADED or PROCESSING.
 */
export function useDocument(id?: string): UseQueryResult<DocumentResponse, Error> {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ''),
    queryFn: () => fetchDocument(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'UPLOADED' || status === 'PROCESSING') {
        return 2500;
      }
      return false;
    },
  });
}

export interface UploadDocumentVariables {
  file: FileToUpload;
  onProgress?: (percent: number) => void;
}

/**
 * Hook to upload a document file with cache invalidation on success.
 */
export function useUploadDocument(): UseMutationResult<
  DocumentUploadResponse,
  Error,
  UploadDocumentVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, onProgress }) => uploadDocument(file, onProgress),
    onSuccess: (data) => {
      // Invalidate document lists so UI refreshes with new document
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      // Pre-seed individual document cache
      queryClient.setQueryData(documentKeys.detail(data.document.id), data.document);
    },
  });
}

/**
 * Hook to delete a document with cache invalidation on success.
 */
export function useDeleteDocument(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: (_data, id) => {
      // Remove deleted document from cache
      queryClient.removeQueries({ queryKey: documentKeys.detail(id) });
      // Refresh document lists
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
