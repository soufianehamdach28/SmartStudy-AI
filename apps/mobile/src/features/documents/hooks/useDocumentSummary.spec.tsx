import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocumentSummary, useRegenerateDocumentSummary } from './useDocumentSummary';
import { fetchDocumentSummary } from '../api/documents.api';

jest.mock('../api/documents.api', () => ({
  fetchDocumentSummary: jest.fn(),
}));

describe('useDocumentSummary', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  });

  it('fetches document summary successfully', async () => {
    const mockSummary = {
      documentId: 'doc-uuid-1',
      summary: '# Physics Summary\nE=mc^2',
      cached: false,
    };

    (fetchDocumentSummary as jest.Mock).mockResolvedValueOnce(mockSummary);

    let hookValue: any;
    function TestComponent() {
      hookValue = useDocumentSummary('doc-uuid-1');
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
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });

    expect(fetchDocumentSummary).toHaveBeenCalledWith('doc-uuid-1');
    expect(hookValue.data).toEqual(mockSummary);
    expect(hookValue.isSuccess).toBe(true);
  });

  it('does not run query when enabled is false', async () => {
    let hookValue: any;
    function TestComponent() {
      hookValue = useDocumentSummary('doc-uuid-1', false);
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
    expect(fetchDocumentSummary).not.toHaveBeenCalled();
  });

  it('regenerates document summary on mutation call', async () => {
    const regeneratedSummary = {
      documentId: 'doc-uuid-1',
      summary: '# Fresh Summary',
      cached: false,
    };

    (fetchDocumentSummary as jest.Mock).mockResolvedValueOnce(regeneratedSummary);

    let hookValue: any;
    function TestComponent() {
      hookValue = useRegenerateDocumentSummary('doc-uuid-1');
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
      await hookValue.mutateAsync();
    });

    expect(fetchDocumentSummary).toHaveBeenCalledWith('doc-uuid-1');
  });
});
