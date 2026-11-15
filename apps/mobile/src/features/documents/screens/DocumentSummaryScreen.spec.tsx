import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Clipboard, Text } from 'react-native';
import { DocumentSummaryScreen } from './DocumentSummaryScreen';
import { LoadingView } from '../../../shared/components/LoadingView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { MarkdownView } from '../../../shared/components/MarkdownView';
import {
  useDocumentSummary,
  useRegenerateDocumentSummary,
} from '../hooks/useDocumentSummary';

jest.mock('../hooks/useDocumentSummary', () => ({
  useDocumentSummary: jest.fn(),
  useRegenerateDocumentSummary: jest.fn(),
}));

jest.spyOn(Clipboard, 'setString');

describe('DocumentSummaryScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute = {
    key: 'summary-key',
    name: 'DocumentSummary' as const,
    params: {
      documentId: 'doc-123',
      documentTitle: 'Quantum Mechanics.pdf',
    },
  };

  const mockRegenerateMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRegenerateDocumentSummary as jest.Mock).mockReturnValue({
      mutateAsync: mockRegenerateMutate,
      isPending: false,
    });
  });

  it('renders loading state when summary is generating', async () => {
    (useDocumentSummary as jest.Mock).mockReturnValue({
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
        <DocumentSummaryScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const loading = renderer!.root.findByType(LoadingView);
    expect(loading.props.message).toBe('Generating summary with AI...');

    const banner = renderer!.root.findByProps({ testID: 'ai-disclaimer-banner' });
    expect(banner).toBeTruthy();
  });

  it('renders prominent AI disclaimer banner (Security Rule #12)', async () => {
    (useDocumentSummary as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        summary: '# Summary\nEverything is relative.',
        cached: false,
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
        <DocumentSummaryScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const banner = renderer!.root.findByProps({ testID: 'ai-disclaimer-banner' });
    expect(banner).toBeTruthy();
  });

  it('renders markdown summary content and cache badge when cached', async () => {
    (useDocumentSummary as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        summary: '# Main Heading\n- Point 1\n- Point 2',
        cached: true,
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
        <DocumentSummaryScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const markdown = renderer!.root.findByType(MarkdownView);
    expect(markdown.props.content).toBe('# Main Heading\n- Point 1\n- Point 2');

    const textNodes = renderer!.root.findAllByType(Text);
    const hasCacheText = textNodes.some((n) =>
      String(n.props.children).includes('Loaded from cache'),
    );
    expect(hasCacheText).toBe(true);
  });

  it('copies summary content to clipboard when Copy button is pressed', async () => {
    const summaryText = '# Summary content';
    (useDocumentSummary as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        summary: summaryText,
        cached: false,
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
        <DocumentSummaryScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    jest.useFakeTimers();
    const copyBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Copy summary to clipboard',
    });
    act(() => {
      copyBtn.props.onPress();
    });

    expect(Clipboard.setString).toHaveBeenCalledWith(summaryText);
    act(() => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
  });

  it('calls regenerate mutation when Regenerate button is pressed', async () => {
    (useDocumentSummary as jest.Mock).mockReturnValue({
      data: {
        documentId: 'doc-123',
        summary: '# Old Summary',
        cached: true,
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
        <DocumentSummaryScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const regenerateBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Regenerate summary',
    });
    await act(async () => {
      regenerateBtn.props.onPress();
    });

    expect(mockRegenerateMutate).toHaveBeenCalled();
  });

  it('renders error state and triggers retry on press', async () => {
    const mockRefetch = jest.fn();
    (useDocumentSummary as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DocumentSummaryScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const errorView = renderer!.root.findByType(ErrorView);
    expect(errorView.props.message).toBe('Network timeout');
    act(() => {
      errorView.props.onRetry();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });
});
