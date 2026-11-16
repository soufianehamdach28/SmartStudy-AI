import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDocumentQuiz,
  useSubmitQuizAttempt,
} from './useQuiz';
import { fetchQuizzes, generateQuiz, submitQuizAttempt } from '../api/quiz.api';

jest.mock('../api/quiz.api', () => ({
  fetchQuizzes: jest.fn(),
  generateQuiz: jest.fn(),
  submitQuizAttempt: jest.fn(),
}));

describe('useQuiz hooks', () => {
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

  it('loads existing quiz when available', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      documentId: 'doc-1',
      title: 'Biology Quiz',
      createdAt: '2026-11-16T00:00:00.000Z',
      questions: [],
    };

    (fetchQuizzes as jest.Mock).mockResolvedValueOnce([mockQuiz]);

    let hookValue: any;
    function TestComponent() {
      hookValue = useDocumentQuiz('doc-1');
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

    expect(fetchQuizzes).toHaveBeenCalledWith('doc-1');
    expect(generateQuiz).not.toHaveBeenCalled();
    expect(hookValue.data).toEqual(mockQuiz);
  });

  it('generates a new quiz when none exists', async () => {
    const generatedQuiz = {
      id: 'quiz-fresh',
      documentId: 'doc-1',
      title: 'Generated Quiz',
      createdAt: '2026-11-16T00:00:00.000Z',
      questions: [],
    };

    (fetchQuizzes as jest.Mock).mockResolvedValueOnce([]);
    (generateQuiz as jest.Mock).mockResolvedValueOnce(generatedQuiz);

    let hookValue: any;
    function TestComponent() {
      hookValue = useDocumentQuiz('doc-1');
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

    expect(fetchQuizzes).toHaveBeenCalledWith('doc-1');
    expect(generateQuiz).toHaveBeenCalledWith('doc-1', 5);
    expect(hookValue.data).toEqual(generatedQuiz);
  });

  it('submits quiz attempt via mutation', async () => {
    const mockAttempt = {
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      score: 100,
      correctCount: 1,
      totalQuestions: 1,
      answers: [],
      completedAt: '2026-11-16T00:00:00.000Z',
    };

    (submitQuizAttempt as jest.Mock).mockResolvedValueOnce(mockAttempt);

    let hookValue: any;
    function TestComponent() {
      hookValue = useSubmitQuizAttempt();
      return null;
    }

    await act(async () => {
      ReactTestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    let result: any;
    await act(async () => {
      result = await hookValue.mutateAsync({
        quizId: 'quiz-1',
        data: { answers: [{ questionId: 'q-1', selectedIndex: 0 }] },
      });
    });

    expect(submitQuizAttempt).toHaveBeenCalledWith('quiz-1', {
      answers: [{ questionId: 'q-1', selectedIndex: 0 }],
    });
    expect(result).toEqual(mockAttempt);
  });
});
