import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { EmptyView } from '../../../shared/components/EmptyView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { OfflineView } from '../../../shared/components/OfflineView';
import { MessageBubble } from '../components/MessageBubble';
import { ChatScreen } from './ChatScreen';
import {
  useConversation,
  useCreateConversation,
  useDeleteConversation,
  useDocumentConversations,
  useSendMessage,
} from '../hooks/useChat';
import { useFavoritesStore } from '../../../shared/store/favorites.store';

const mockUseNetworkStatus = jest.fn();
jest.mock('../../../shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
  setupNetworkManager: jest.fn(() => jest.fn()),
}));

jest.mock('../hooks/useChat', () => ({
  useConversation: jest.fn(),
  useCreateConversation: jest.fn(),
  useDeleteConversation: jest.fn(),
  useDocumentConversations: jest.fn(),
  useSendMessage: jest.fn(),
}));

describe('ChatScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute = {
    key: 'chat-key',
    name: 'Chat' as const,
    params: {
      documentId: 'doc-123',
      documentTitle: 'Cell Biology Notes.pdf',
      conversationId: 'conv-123',
    },
  };

  const mockCreateConversation = {
    mutateAsync: jest.fn(),
    isPending: false,
  };

  const mockSendMessage = {
    mutateAsync: jest.fn(),
    isPending: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetworkStatus.mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      isOffline: false,
      connectionType: 'wifi',
    });
    useFavoritesStore.getState().clearFavorites();
    (useCreateConversation as jest.Mock).mockReturnValue(
      mockCreateConversation,
    );
    (useSendMessage as jest.Mock).mockReturnValue(mockSendMessage);
    (useDocumentConversations as jest.Mock).mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });
    (useDeleteConversation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  it('renders loading state when conversation is loading', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const loadingView = renderer!.root.findByType(LoadingView);
    expect(loadingView).toBeTruthy();
  });

  it('renders header, AI disclaimer banner, and empty state when conversation has no messages', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        userId: 'u-1',
        documentId: 'doc-123',
        title: 'Chat: Cell Biology Notes.pdf',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer!.root;
    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');

    expect(allText).toContain('Cell Biology Notes.pdf');
    expect(allText).toContain('AI answers may be incorrect');

    const emptyView = root.findByType(EmptyView);
    expect(emptyView).toBeTruthy();
  });

  it('renders message bubbles when messages exist in conversation', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        userId: 'u-1',
        documentId: 'doc-123',
        title: 'Chat',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [
          {
            id: 'm-1',
            conversationId: 'conv-123',
            role: 'USER',
            content: 'What is mitochondria?',
            citations: [],
            createdAt: '2026-11-17T02:01:00.000Z',
          },
          {
            id: 'm-2',
            conversationId: 'conv-123',
            role: 'ASSISTANT',
            content: 'It is the powerhouse of the cell.',
            citations: [
              {
                chunkId: 'chunk-1',
                page: 2,
                excerpt: 'Mitochondria produce ATP.',
              },
            ],
            createdAt: '2026-11-17T02:01:05.000Z',
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer!.root;
    const bubbles = root.findAllByType(MessageBubble);
    expect(bubbles).toHaveLength(2);
  });

  it('triggers navigation.goBack() when back button is pressed', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        messages: [],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const backButton = renderer!.root.findByProps({
      testID: 'chat-back-button',
    });
    act(() => {
      backButton.props.onPress();
    });

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('opens SourceExcerptModal when a citation pill is pressed', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        userId: 'u-1',
        documentId: 'doc-123',
        title: 'Cell Biology',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [
          {
            id: 'm-2',
            conversationId: 'conv-123',
            role: 'ASSISTANT',
            content: 'Mitochondria produce ATP.',
            citations: [
              {
                chunkId: 'chunk-1',
                page: 2,
                excerpt: 'Mitochondria produce ATP.',
              },
            ],
            createdAt: '2026-11-17T02:01:05.000Z',
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer!.root;
    const citationPill = root.findByProps({
      testID: 'citation-pill-chunk-1',
    });

    act(() => {
      citationPill.props.onPress();
    });

    const excerptText = root.findByProps({
      testID: 'source-excerpt-text',
    });
    expect(excerptText.props.children).toContain('Mitochondria produce ATP.');
  });

  it('toggles favorite on the active conversation when star button is pressed', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        userId: 'u-1',
        documentId: 'doc-123',
        title: 'Cell Biology',
        createdAt: '2026-11-17T02:00:00.000Z',
        messages: [],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer!.root;
    const favBtn = root.findByProps({ testID: 'chat-favorite-button' });

    expect(
      useFavoritesStore.getState().isFavorite('CONVERSATION', 'conv-123'),
    ).toBe(false);

    act(() => {
      favBtn.props.onPress();
    });

    expect(
      useFavoritesStore.getState().isFavorite('CONVERSATION', 'conv-123'),
    ).toBe(true);
  });

  it('opens conversation history modal when history button is pressed', () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        messages: [],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer!.root;
    const historyBtn = root.findByProps({ testID: 'chat-history-button' });

    act(() => {
      historyBtn.props.onPress();
    });

    const historyModal = root.findByProps({
      testID: 'conversation-history-modal',
    });
    expect(historyModal.props.visible).toBe(true);
  });

  it('disables ChatInputBar with offline placeholder when offline', () => {
    mockUseNetworkStatus.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      isOffline: true,
      connectionType: 'none',
    });

    (useConversation as jest.Mock).mockReturnValue({
      data: {
        id: 'conv-123',
        messages: [],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer.root;
    const input = root.findByProps({ testID: 'chat-input' });
    expect(input.props.editable).toBe(false);
    expect(input.props.placeholder).toBe(
      'You are offline — reconnect to send messages',
    );
  });

  it('renders OfflineView when conversation fetch fails and device is offline', () => {
    mockUseNetworkStatus.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      isOffline: true,
      connectionType: 'none',
    });

    (useConversation as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network offline'),
      refetch: jest.fn(),
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />,
      );
    });

    const root = renderer.root;
    const offlineView = root.findByType(OfflineView);
    expect(offlineView).toBeDefined();
    expect(offlineView.props.title).toBe('Chat Offline');
  });
});
