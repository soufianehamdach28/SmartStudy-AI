import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFlashcards, useRegenerateFlashcards } from './useFlashcards';
import { fetchFlashcards, generateFlashcards } from '../api/documents.api';

jest.mock('../api/documents.api', () => ({
  fetchFlashcards: jest.fn(),
  generateFlashcards: jest.fn(),
}));

describe('useFlashcards', () => {
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

  it('returns existing flashcards when available', async () => {
    const mockResponse = {
      documentId: 'doc-1',
      flashcards: [
        {
          id: 'card-1',
          documentId: 'doc-1',
          front: 'Question 1',
          back: 'Answer 1',
        },
      ],
    };

    (fetchFlashcards as jest.Mock).mockResolvedValueOnce(mockResponse);

    let hookValue: any;
    function TestComponent() {
      hookValue = useFlashcards('doc-1');
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

    expect(fetchFlashcards).toHaveBeenCalledWith('doc-1');
    expect(generateFlashcards).not.toHaveBeenCalled();
    expect(hookValue.data).toEqual(mockResponse);
  });

  it('triggers generateFlashcards when no flashcards exist yet', async () => {
    const emptyResponse = {
      documentId: 'doc-1',
      flashcards: [],
    };
    const generatedResponse = {
      documentId: 'doc-1',
      flashcards: [
        {
          id: 'card-new',
          documentId: 'doc-1',
          front: 'Generated Q',
          back: 'Generated A',
        },
      ],
    };

    (fetchFlashcards as jest.Mock).mockResolvedValueOnce(emptyResponse);
    (generateFlashcards as jest.Mock).mockResolvedValueOnce(generatedResponse);

    let hookValue: any;
    function TestComponent() {
      hookValue = useFlashcards('doc-1');
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

    expect(fetchFlashcards).toHaveBeenCalledWith('doc-1');
    expect(generateFlashcards).toHaveBeenCalledWith('doc-1', 10);
    expect(hookValue.data).toEqual(generatedResponse);
  });

  it('regenerates flashcards on mutation call', async () => {
    const regeneratedResponse = {
      documentId: 'doc-1',
      flashcards: [
        {
          id: 'card-fresh',
          documentId: 'doc-1',
          front: 'Fresh Q',
          back: 'Fresh A',
        },
      ],
    };

    (generateFlashcards as jest.Mock).mockResolvedValueOnce(regeneratedResponse);

    let hookValue: any;
    function TestComponent() {
      hookValue = useRegenerateFlashcards('doc-1');
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
      await hookValue.mutateAsync(15);
    });

    expect(generateFlashcards).toHaveBeenCalledWith('doc-1', 15);
  });
});
