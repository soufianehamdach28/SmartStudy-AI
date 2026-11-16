import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { FlashcardsScreen } from './FlashcardsScreen';
import { LoadingView } from '../../../shared/components/LoadingView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { FlashcardViewer } from '../components/FlashcardViewer';
import {
  useFlashcards,
  useRegenerateFlashcards,
} from '../hooks/useFlashcards';

jest.mock('../hooks/useFlashcards', () => ({
  useFlashcards: jest.fn(),
  useRegenerateFlashcards: jest.fn(),
}));

describe('FlashcardsScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute = {
    key: 'flashcards-key',
    name: 'Flashcards' as const,
    params: {
      documentId: 'doc-123',
      documentTitle: 'Chemistry Basics.pdf',
    },
  };

  const mockCards = [
    {
      id: 'card-1',
      documentId: 'doc-123',
      front: 'What is H2O?',
      back: 'Water molecule consisting of 2 hydrogen and 1 oxygen.',
    },
    {
      id: 'card-2',
      documentId: 'doc-123',
      front: 'What is NaCl?',
      back: 'Sodium chloride (table salt).',
    },
  ];

  const mockRegenerateMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRegenerateFlashcards as jest.Mock).mockReturnValue({
      mutateAsync: mockRegenerateMutate,
      isPending: false,
    });
  });

  it('renders loading state when flashcards are generating', async () => {
    (useFlashcards as jest.Mock).mockReturnValue({
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
        <FlashcardsScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const loading = renderer!.root.findByType(LoadingView);
    expect(loading.props.message).toBe('Generating flashcards with AI...');

    const banner = renderer!.root.findByProps({ testID: 'ai-disclaimer-banner' });
    expect(banner).toBeTruthy();
  });

  it('renders progress header and first card front', async () => {
    (useFlashcards as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        flashcards: mockCards,
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
        <FlashcardsScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const hasCount = textNodes.some((n) => {
      const children = Array.isArray(n.props.children)
        ? n.props.children.join('')
        : String(n.props.children);
      return children.includes('Card 1 of 2');
    });
    expect(hasCount).toBe(true);

    const viewer = renderer!.root.findByType(FlashcardViewer);
    expect(viewer.props.card.front).toBe('What is H2O?');
    expect(viewer.props.isFlipped).toBe(false);
  });

  it('navigates to next card when Next is pressed', async () => {
    (useFlashcards as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        flashcards: mockCards,
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
        <FlashcardsScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const nextBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Next card',
    });

    await act(async () => {
      nextBtn.props.onPress();
    });

    const viewer = renderer!.root.findByType(FlashcardViewer);
    expect(viewer.props.card.front).toBe('What is NaCl?');
  });

  it('shows completion view after finishing last card and allows review restart', async () => {
    (useFlashcards as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        flashcards: mockCards,
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
        <FlashcardsScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    // Advance to Card 2
    const nextBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Next card',
    });
    await act(async () => {
      nextBtn.props.onPress();
    });

    // Advance to Complete
    const finishBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Finish review',
    });
    await act(async () => {
      finishBtn.props.onPress();
    });

    const completedView = renderer!.root.findByProps({
      testID: 'flashcards-completed-view',
    });
    expect(completedView).toBeTruthy();

    // Restart review
    const restartBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Review again',
    });
    await act(async () => {
      restartBtn.props.onPress();
    });

    const viewer = renderer!.root.findByType(FlashcardViewer);
    expect(viewer.props.card.front).toBe('What is H2O?');
  });

  it('renders error state and retries on press', async () => {
    const mockRefetch = jest.fn();
    (useFlashcards as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <FlashcardsScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const errorView = renderer!.root.findByType(ErrorView);
    expect(errorView.props.message).toBe('Network error');

    act(() => {
      errorView.props.onRetry();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });
});
