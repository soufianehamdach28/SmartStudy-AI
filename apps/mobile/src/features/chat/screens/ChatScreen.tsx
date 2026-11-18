import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Citation, Message } from '@smartstudy/shared';
import type { AppStackParamList } from '../../../app/navigation/types';
import { EmptyView } from '../../../shared/components/EmptyView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { OfflineView } from '../../../shared/components/OfflineView';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { parseChatErrorMessage } from '../api/chat.api';
import {
  useConversation,
  useCreateConversation,
  useSendMessage,
} from '../hooks/useChat';
import { useFavoritesStore } from '../../../shared/store/favorites.store';
import { ChatInputBar } from '../components/ChatInputBar';
import { ConversationHistoryModal } from '../components/ConversationHistoryModal';
import { MessageBubble } from '../components/MessageBubble';
import { SourceExcerptModal } from '../components/SourceExcerptModal';

export type ChatScreenProps = NativeStackScreenProps<AppStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { documentId, documentTitle, conversationId: initialConversationId } =
    route.params;

  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(
    null,
  );
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);
  const { isOffline } = useNetworkStatus();

  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFav = conversationId
    ? isFavorite('CONVERSATION', conversationId)
    : false;

  const createConversationMutation = useCreateConversation();

  const handleCreateNewChat = async () => {
    if (isOffline) {
      Alert.alert('Offline', 'Cannot create a new chat while offline.');
      return;
    }

    try {
      const newConv = await createConversationMutation.mutateAsync({
        documentId,
      });
      setConversationId(newConv.id);
    } catch (err) {
      Alert.alert('Unable to Create Chat', parseChatErrorMessage(err));
    }
  };

  // If no conversationId was passed in route params, initialize one on mount
  useEffect(() => {
    if (!conversationId) {
      createConversationMutation
        .mutateAsync({ documentId })
        .then((newConv) => {
          setConversationId(newConv.id);
        })
        .catch((err) => {
          Alert.alert(
            'Conversation Error',
            parseChatErrorMessage(err),
            [{ text: 'Go Back', onPress: () => navigation.goBack() }],
          );
        });
    }
  }, [conversationId, createConversationMutation, documentId, navigation]);

  const {
    data: conversation,
    isLoading,
    isError,
    error,
    refetch,
  } = useConversation(conversationId);

  const sendMessageMutation = useSendMessage(conversationId ?? '');

  const messages = conversation?.messages ?? [];

  const handleSend = async (content: string) => {
    if (!conversationId) return;

    try {
      await sendMessageMutation.mutateAsync(content);
      // Small timeout to allow FlatList rendering before scrolling to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      Alert.alert('Unable to Send', parseChatErrorMessage(err));
    }
  };

  const handleCitationPress = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const renderContent = () => {
    if (!conversationId || isLoading || createConversationMutation.isPending) {
      return <LoadingView message="Opening chat session..." />;
    }

    if (isError) {
      if (isOffline) {
        return (
          <OfflineView
            title="Chat Offline"
            message="Cannot load conversation while offline. Please check your connection."
            onRetry={() => refetch()}
          />
        );
      }
      return (
        <ErrorView
          message={parseChatErrorMessage(error)}
          onRetry={() => refetch()}
        />
      );
    }

    if (messages.length === 0) {
      return (
        <EmptyView
          title="Ask a Question"
          description="Type your question below. The AI tutor will answer using only the excerpts from this document and provide page citations."
        />
      );
    }

    return (
      <FlatList<Message>
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            onCitationPress={handleCitationPress}
          />
        )}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        testID="chat-messages-list"
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="chat-back-button"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {documentTitle}
          </Text>
          <Text style={styles.headerSubtitle}>Document Chat</Text>
        </View>

        <View style={styles.headerActions}>
          {Boolean(conversationId) && (
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() =>
                conversationId &&
                toggleFavorite('CONVERSATION', conversationId)
              }
              accessibilityRole="button"
              accessibilityLabel={
                isFav ? 'Unstar conversation' : 'Star conversation'
              }
              testID="chat-favorite-button"
            >
              <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setHistoryModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open chat history"
            testID="chat-history-button"
          >
            <Text style={styles.historyButtonText}>🕒 History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mandatory AI Disclaimer Banner */}
      <View style={styles.disclaimerBanner} testID="ai-disclaimer-banner">
        <Text style={styles.disclaimerText}>
          ⚠️ AI answers may be incorrect. Verify citations with course materials.
        </Text>
      </View>

      {/* Main chat messages or state */}
      <View style={styles.body}>{renderContent()}</View>

      {/* Input Bar */}
      <ChatInputBar
        onSend={handleSend}
        disabled={
          !conversationId ||
          isLoading ||
          createConversationMutation.isPending ||
          sendMessageMutation.isPending ||
          isOffline
        }
        placeholder={
          isOffline
            ? 'You are offline — reconnect to send messages'
            : 'Ask a question about this course...'
        }
      />

      {/* Source Excerpt Modal */}
      <SourceExcerptModal
        visible={Boolean(selectedCitation)}
        citation={selectedCitation}
        documentTitle={documentTitle}
        onClose={() => setSelectedCitation(null)}
      />

      {/* Conversation History Modal */}
      <ConversationHistoryModal
        visible={historyModalVisible}
        documentId={documentId}
        activeConversationId={conversationId}
        onSelectConversation={(id) => setConversationId(id)}
        onNewChat={handleCreateNewChat}
        onClose={() => setHistoryModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#0F172A',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  headerActionButton: {
    padding: 6,
  },
  starIcon: {
    fontSize: 20,
    color: '#EAB308',
  },
  historyButton: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  historyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  disclaimerBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FDE68A',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 12,
  },
});
