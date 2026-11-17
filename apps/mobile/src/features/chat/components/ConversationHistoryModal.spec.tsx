import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useFavoritesStore } from '../../../shared/store/favorites.store';
import {
  useDeleteConversation,
  useDocumentConversations,
} from '../hooks/useChat';
import { ConversationHistoryModal } from './ConversationHistoryModal';

jest.mock('../hooks/useChat', () => ({
  useDocumentConversations: jest.fn(),
  useDeleteConversation: jest.fn(),
}));

describe('ConversationHistoryModal', () => {
  const mockDeleteMutation = {
    mutateAsync: jest.fn(),
    isPending: false,
  };

  const mockConversations = [
    {
      id: 'conv-1',
      userId: 'user-1',
      documentId: 'doc-1',
      title: 'Chat 1: Cell Structure',
      createdAt: '2026-11-17T02:00:00.000Z',
    },
    {
      id: 'conv-2',
      userId: 'user-1',
      documentId: 'doc-1',
      title: 'Chat 2: Metabolism',
      createdAt: '2026-11-17T03:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useFavoritesStore.getState().clearFavorites();
    (useDeleteConversation as jest.Mock).mockReturnValue(mockDeleteMutation);
  });

  it('renders conversations and highlights the active one', () => {
    (useDocumentConversations as jest.Mock).mockReturnValue({
      data: { items: mockConversations, total: 2 },
      isLoading: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConversationHistoryModal
          visible={true}
          documentId="doc-1"
          activeConversationId="conv-1"
          onSelectConversation={jest.fn()}
          onNewChat={jest.fn()}
          onClose={jest.fn()}
        />,
      );
    });

    const root = renderer!.root;
    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');

    expect(allText).toContain('Chat 1: Cell Structure');
    expect(allText).toContain('Chat 2: Metabolism');
    expect(allText).toContain('Active');
  });

  it('calls onSelectConversation and onClose when a conversation item is pressed', () => {
    (useDocumentConversations as jest.Mock).mockReturnValue({
      data: { items: mockConversations, total: 2 },
      isLoading: false,
    });

    const onSelectConversation = jest.fn();
    const onClose = jest.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConversationHistoryModal
          visible={true}
          documentId="doc-1"
          activeConversationId="conv-1"
          onSelectConversation={onSelectConversation}
          onNewChat={jest.fn()}
          onClose={onClose}
        />,
      );
    });

    const item = renderer!.root.findByProps({
      testID: 'conversation-item-conv-2',
    });
    act(() => {
      item.props.onPress();
    });

    expect(onSelectConversation).toHaveBeenCalledWith('conv-2');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onNewChat and onClose when + New Chat button is pressed', () => {
    (useDocumentConversations as jest.Mock).mockReturnValue({
      data: { items: mockConversations, total: 2 },
      isLoading: false,
    });

    const onNewChat = jest.fn();
    const onClose = jest.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConversationHistoryModal
          visible={true}
          documentId="doc-1"
          activeConversationId="conv-1"
          onSelectConversation={jest.fn()}
          onNewChat={onNewChat}
          onClose={onClose}
        />,
      );
    });

    const newChatBtn = renderer!.root.findByProps({
      testID: 'new-chat-button',
    });
    act(() => {
      newChatBtn.props.onPress();
    });

    expect(onNewChat).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles favorite and filters by favorites tab', () => {
    (useDocumentConversations as jest.Mock).mockReturnValue({
      data: { items: mockConversations, total: 2 },
      isLoading: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConversationHistoryModal
          visible={true}
          documentId="doc-1"
          activeConversationId="conv-1"
          onSelectConversation={jest.fn()}
          onNewChat={jest.fn()}
          onClose={jest.fn()}
        />,
      );
    });

    const root = renderer!.root;

    // Toggle favorite on conv-1
    const favBtn = root.findByProps({ testID: 'favorite-button-conv-1' });
    act(() => {
      favBtn.props.onPress();
    });

    expect(
      useFavoritesStore.getState().isFavorite('CONVERSATION', 'conv-1'),
    ).toBe(true);

    // Switch to Favorites tab
    const favTab = root.findByProps({ testID: 'filter-favorites-button' });
    act(() => {
      favTab.props.onPress();
    });

    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');
    expect(allText).toContain('Chat 1: Cell Structure');
    expect(allText).not.toContain('Chat 2: Metabolism');
  });
});
