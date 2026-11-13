import axios from 'axios';
import {
  type DocumentListQuery,
  type DocumentResponse,
  type DocumentUploadResponse,
  type PaginatedDocumentsResponse,
} from '@smartstudy/shared';
import { apiClient } from '../../../shared/api/client';

export interface FileToUpload {
  uri: string;
  name: string;
  type: string;
}

/**
 * Fetch a paginated list of documents uploaded by the user.
 */
export async function fetchDocuments(
  query: DocumentListQuery = { page: 1, limit: 10 },
): Promise<PaginatedDocumentsResponse> {
  const response = await apiClient.get<PaginatedDocumentsResponse>('/documents', {
    params: query,
  });
  return response.data;
}

/**
 * Fetch detail and processing status of a single document.
 */
export async function fetchDocument(id: string): Promise<DocumentResponse> {
  const response = await apiClient.get<DocumentResponse>(`/documents/${id}`);
  return response.data;
}

/**
 * Upload a document (PDF or TXT) via multipart/form-data.
 * Tracks upload progress when onProgress callback is provided.
 */
export async function uploadDocument(
  file: FileToUpload,
  onProgress?: (percent: number) => void,
): Promise<DocumentUploadResponse> {
  const formData = new FormData();

  // In React Native, FormData accepts an object with uri, name, and type
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const response = await apiClient.post<DocumentUploadResponse>('/documents', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return response.data;
}

/**
 * Delete a document and its cascade data.
 */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

/**
 * Map API error responses and network errors to friendly user-facing messages.
 */
export function parseDocumentErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    const data = error.response.data as
      | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
      | undefined;

    const code = data?.error?.code;
    const message = data?.error?.message;

    switch (code) {
      case 'FILE_TOO_LARGE':
        return 'The selected file exceeds the 10 MB limit.';
      case 'UNSUPPORTED_FILE_TYPE':
        return 'Unsupported file type. Only standard PDF and TXT files are allowed.';
      case 'DOCUMENT_NOT_READY':
        return 'The document is still being processed. Please wait a moment.';
      case 'DOCUMENT_PROCESSING_FAILED':
        return message ?? 'Document processing failed.';
      case 'NOT_FOUND':
        return 'Document not found or access denied.';
      case 'VALIDATION_ERROR':
        return message ?? 'Invalid document request.';
      case 'UNAUTHORIZED':
      case 'TOKEN_EXPIRED':
        return 'Your session has expired. Please log in again.';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment and try again.';
      default:
        return message ?? 'An unexpected error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
