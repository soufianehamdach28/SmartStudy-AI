import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { EmptyView } from '../../../shared/components/EmptyView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { MessageBubble } from '../components/MessageBubble';
import { ChatScreen } from './ChatScreen';
import {
  useConversation,
  useCreateConversation,
  useSendMessage,
} from '../hooks/useChat';

jest.mock('../hooks/useChat', () => ({
  useConversation: jest.fn(),
  useCreateConversation: jest.fn(),
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
    (useCreateConversation as jest.Mock).mockReturnValue(
      mockCreateConversation,
    );
    (useSendMessage as jest.Mock).mockReturnValue(mockSendMessage);
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
});
