import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QuizScreen } from './QuizScreen';
import { LoadingView } from '../../../shared/components/LoadingView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { QuizOptionCard } from '../components/QuizOptionCard';
import { ScoreReviewModal } from '../components/ScoreReviewModal';
import {
  useDocumentQuiz,
  useGenerateNewQuiz,
  useSubmitQuizAttempt,
} from '../hooks/useQuiz';

jest.mock('../hooks/useQuiz', () => ({
  useDocumentQuiz: jest.fn(),
  useGenerateNewQuiz: jest.fn(),
  useSubmitQuizAttempt: jest.fn(),
}));

describe('QuizScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute = {
    key: 'quiz-key',
    name: 'Quiz' as const,
    params: {
      documentId: 'doc-123',
      documentTitle: 'Chemistry Quiz.pdf',
    },
  };

  const mockQuestions = [
    {
      id: 'q-1',
      quizId: 'quiz-1',
      prompt: 'What is the chemical symbol for Gold?',
      options: ['Ag', 'Au', 'Fe', 'Cu'],
      correctIndex: 1,
      explanation: 'Au comes from the Latin word aurum.',
      sourceChunkId: null,
    },
    {
      id: 'q-2',
      quizId: 'quiz-1',
      prompt: 'What is the pH of pure water at 25°C?',
      options: ['5', '7', '9', '14'],
      correctIndex: 1,
      explanation: 'Pure water has a neutral pH of 7.',
      sourceChunkId: null,
    },
  ];

  const mockGenerateNewMutate = jest.fn();
  const mockSubmitMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useGenerateNewQuiz as jest.Mock).mockReturnValue({
      mutateAsync: mockGenerateNewMutate,
      isPending: false,
    });
    (useSubmitQuizAttempt as jest.Mock).mockReturnValue({
      mutateAsync: mockSubmitMutate,
      isPending: false,
    });
  });

  it('renders loading state while quiz is generating', async () => {
    (useDocumentQuiz as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <QuizScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const loading = renderer!.root.findByType(LoadingView);
    expect(loading.props.message).toBe('Preparing quiz with AI...');

    const banner = renderer!.root.findByProps({ testID: 'ai-disclaimer-banner' });
    expect(banner).toBeTruthy();
  });

  it('renders question prompt and 4 options', async () => {
    (useDocumentQuiz as jest.Mock).mockReturnValue({
      data: {
        id: 'quiz-1',
        documentId: 'doc-123',
        title: 'Chemistry Quiz',
        createdAt: '2026-11-16T00:00:00.000Z',
        questions: mockQuestions,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <QuizScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const promptText = renderer!.root.findByProps({
      children: 'What is the chemical symbol for Gold?',
    });
    expect(promptText).toBeTruthy();

    const optionCards = renderer!.root.findAllByType(QuizOptionCard);
    expect(optionCards.length).toBe(4);
    expect(optionCards[0].props.label).toBe('A');
    expect(optionCards[0].props.optionText).toBe('Ag');
  });

  it('selects option and advances through questions to submission', async () => {
    (useDocumentQuiz as jest.Mock).mockReturnValue({
      data: {
        id: 'quiz-1',
        documentId: 'doc-123',
        title: 'Chemistry Quiz',
        createdAt: '2026-11-16T00:00:00.000Z',
        questions: mockQuestions,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const mockAttemptResult = {
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      score: 100,
      correctCount: 2,
      totalQuestions: 2,
      answers: [
        {
          questionId: 'q-1',
          selectedIndex: 1,
          correctIndex: 1,
          isCorrect: true,
          explanation: 'Au is gold.',
        },
        {
          questionId: 'q-2',
          selectedIndex: 1,
          correctIndex: 1,
          isCorrect: true,
          explanation: 'pH 7 is neutral.',
        },
      ],
      completedAt: '2026-11-16T00:00:00.000Z',
    };
    mockSubmitMutate.mockResolvedValueOnce(mockAttemptResult);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <QuizScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    // 1. Select Option B (Au) for Question 1
    const optionCardsQ1 = renderer!.root.findAllByType(QuizOptionCard);
    await act(async () => {
      optionCardsQ1[1].props.onSelect();
    });

    // 2. Click Next
    const nextBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Next question',
    });
    await act(async () => {
      nextBtn.props.onPress();
    });

    // 3. Question 2 prompt should now be visible
    expect(
      renderer!.root.findByProps({
        children: 'What is the pH of pure water at 25°C?',
      }),
    ).toBeTruthy();

    // 4. Select Option B (7) for Question 2
    const optionCardsQ2 = renderer!.root.findAllByType(QuizOptionCard);
    await act(async () => {
      optionCardsQ2[1].props.onSelect();
    });

    // 5. Submit Quiz
    const submitBtn = renderer!.root.findByProps({
      testID: 'submit-quiz-button',
    });
    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(mockSubmitMutate).toHaveBeenCalledWith({
      quizId: 'quiz-1',
      data: {
        answers: [
          { questionId: 'q-1', selectedIndex: 1 },
          { questionId: 'q-2', selectedIndex: 1 },
        ],
      },
    });

    // 6. Score Review Modal should be visible
    const modal = renderer!.root.findByType(ScoreReviewModal);
    expect(modal.props.visible).toBe(true);
    expect(modal.props.attempt).toEqual(mockAttemptResult);
  });

  it('renders error state and retries on press', async () => {
    const mockRefetch = jest.fn();
    (useDocumentQuiz as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load quiz'),
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <QuizScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const errorView = renderer!.root.findByType(ErrorView);
    expect(errorView.props.message).toBe('Failed to load quiz');

    act(() => {
      errorView.props.onRetry();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });
});
