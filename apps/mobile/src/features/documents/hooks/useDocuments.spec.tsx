import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDocument,
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from './useDocuments';
import * as documentsApi from '../api/documents.api';

jest.mock('../api/documents.api');

describe('useDocuments hooks', () => {
  let queryClient: QueryClient;

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
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  describe('useDocuments', () => {
    it('fetches and returns paginated documents', async () => {
      const mockData = {
        items: [mockDoc],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      (documentsApi.fetchDocuments as jest.Mock).mockResolvedValueOnce(mockData);

      let hookValue: any;
      function TestComponent() {
        hookValue = useDocuments({ page: 1, limit: 10 });
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
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        });
      });

      expect(documentsApi.fetchDocuments).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
      expect(hookValue.data).toEqual(mockData);
      expect(hookValue.isSuccess).toBe(true);
    });
  });

  describe('useDocument', () => {
    it('fetches and returns a single document', async () => {
      (documentsApi.fetchDocument as jest.Mock).mockResolvedValueOnce(mockDoc);

      let hookValue: any;
      function TestComponent() {
        hookValue = useDocument('doc-uuid-1');
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
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        });
      });

      expect(documentsApi.fetchDocument).toHaveBeenCalledWith('doc-uuid-1');
      expect(hookValue.data).toEqual(mockDoc);
      expect(hookValue.isSuccess).toBe(true);
    });

    it('does not run query when id is empty', async () => {
      let hookValue: any;
      function TestComponent() {
        hookValue = useDocument('');
        return null;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <TestComponent />
          </QueryClientProvider>,
        );
      });

      expect(hookValue.fetchStatus).toBe('idle');
      expect(documentsApi.fetchDocument).not.toHaveBeenCalled();
    });
  });

  describe('useUploadDocument', () => {
    it('uploads file and invalidates document queries on success', async () => {
      const uploadResponse = {
        document: mockDoc,
        message: 'Uploaded',
      };

      (documentsApi.uploadDocument as jest.Mock).mockResolvedValueOnce(uploadResponse);

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');

      let hookValue: any;
      function TestComponent() {
        hookValue = useUploadDocument();
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
        hookValue.mutate({
          file: {
            uri: 'file://path',
            name: 'doc.pdf',
            type: 'application/pdf',
          },
        });
      });

      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        });
      });

      expect(documentsApi.uploadDocument).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['documents', 'list'],
      });
      expect(setQueryDataSpy).toHaveBeenCalledWith(
        ['documents', 'detail', 'doc-uuid-1'],
        mockDoc,
      );
    });
  });

  describe('useDeleteDocument', () => {
    it('deletes document and invalidates document queries on success', async () => {
      (documentsApi.deleteDocument as jest.Mock).mockResolvedValueOnce(undefined);

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const removeSpy = jest.spyOn(queryClient, 'removeQueries');

      let hookValue: any;
      function TestComponent() {
        hookValue = useDeleteDocument();
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
        hookValue.mutate('doc-uuid-1');
      });

      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        });
      });

      expect(documentsApi.deleteDocument).toHaveBeenCalledWith('doc-uuid-1');
      expect(removeSpy).toHaveBeenCalledWith({
        queryKey: ['documents', 'detail', 'doc-uuid-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['documents', 'list'],
      });
    });
  });
});
