import { AxiosError, type AxiosResponse } from 'axios';
import {
  deleteDocument,
  fetchDocument,
  fetchDocuments,
  parseDocumentErrorMessage,
  uploadDocument,
} from './documents.api';
import { apiClient } from '../../../shared/api/client';

jest.mock('../../../shared/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('documents.api', () => {
  const mockDoc = {
    id: 'doc-uuid-1',
    userId: 'user-uuid-1',
    title: 'physics.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    status: 'READY' as const,
    errorMessage: null,
    pageCount: 5,
    summary: null,
    createdAt: '2026-11-13T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDocuments', () => {
    it('calls GET /documents with query params and returns paginated response', async () => {
      const mockResponse = {
        items: [mockDoc],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await fetchDocuments({ page: 1, limit: 10 });

      expect(apiClient.get).toHaveBeenCalledWith('/documents', {
        params: { page: 1, limit: 10 },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchDocument', () => {
    it('calls GET /documents/:id and returns document detail', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockDoc });

      const result = await fetchDocument('doc-uuid-1');

      expect(apiClient.get).toHaveBeenCalledWith('/documents/doc-uuid-1');
      expect(result).toEqual(mockDoc);
    });
  });

  describe('uploadDocument', () => {
    it('calls POST /documents with FormData and content-type header', async () => {
      const mockUploadResponse = {
        document: mockDoc,
        message: 'Document uploaded successfully',
      };

      (apiClient.post as jest.Mock).mockImplementationOnce(
        (_url, _data, config) => {
          if (config?.onUploadProgress) {
            config.onUploadProgress({ loaded: 50, total: 100 });
          }
          return Promise.resolve({ data: mockUploadResponse });
        },
      );

      const onProgress = jest.fn();
      const result = await uploadDocument(
        {
          uri: 'file:///path/to/physics.pdf',
          name: 'physics.pdf',
          type: 'application/pdf',
        },
        onProgress,
      );

      expect(apiClient.post).toHaveBeenCalledWith(
        '/documents',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
      expect(onProgress).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockUploadResponse);
    });
  });

  describe('deleteDocument', () => {
    it('calls DELETE /documents/:id', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: undefined });

      await deleteDocument('doc-uuid-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/documents/doc-uuid-1');
    });
  });

  describe('parseDocumentErrorMessage', () => {
    function createAxiosError(status: number, data?: unknown): AxiosError {
      const error = new AxiosError('Request failed');
      error.response = {
        status,
        statusText: 'Error',
        headers: {},
        config: {} as any,
        data,
      } as AxiosResponse;
      return error;
    }

    it('returns network error message when no response received', () => {
      const error = new AxiosError('Network Error');
      expect(parseDocumentErrorMessage(error)).toBe(
        'Unable to connect to the server. Please check your internet connection.',
      );
    });

    it('translates FILE_TOO_LARGE code', () => {
      const error = createAxiosError(413, {
        error: { code: 'FILE_TOO_LARGE' },
      });
      expect(parseDocumentErrorMessage(error)).toBe(
        'The selected file exceeds the 10 MB limit.',
      );
    });

    it('translates UNSUPPORTED_FILE_TYPE code', () => {
      const error = createAxiosError(415, {
        error: { code: 'UNSUPPORTED_FILE_TYPE' },
      });
      expect(parseDocumentErrorMessage(error)).toBe(
        'Unsupported file type. Only standard PDF and TXT files are allowed.',
      );
    });

    it('translates NOT_FOUND code', () => {
      const error = createAxiosError(404, {
        error: { code: 'NOT_FOUND' },
      });
      expect(parseDocumentErrorMessage(error)).toBe(
        'Document not found or access denied.',
      );
    });

    it('translates DOCUMENT_NOT_READY code', () => {
      const error = createAxiosError(400, {
        error: { code: 'DOCUMENT_NOT_READY' },
      });
      expect(parseDocumentErrorMessage(error)).toBe(
        'The document is still being processed. Please wait a moment.',
      );
    });

    it('translates standard Error instance', () => {
      const error = new Error('Custom error');
      expect(parseDocumentErrorMessage(error)).toBe('Custom error');
    });

    it('translates unknown errors', () => {
      expect(parseDocumentErrorMessage(null)).toBe('An unexpected error occurred.');
    });
  });
});
