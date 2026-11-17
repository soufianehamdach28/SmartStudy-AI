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
import { parseChatErrorMessage } from '../api/chat.api';
import {
  useConversation,
  useCreateConversation,
  useSendMessage,
} from '../hooks/useChat';
import { ChatInputBar } from '../components/ChatInputBar';
import { MessageBubble } from '../components/MessageBubble';

export type ChatScreenProps = NativeStackScreenProps<AppStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { documentId, documentTitle, conversationId: initialConversationId } =
    route.params;

  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );

  const flatListRef = useRef<FlatList<Message>>(null);

  const createConversationMutation = useCreateConversation();

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
    Alert.alert(
      `Source: Page ${citation.page}`,
      citation.excerpt,
      [{ text: 'Close', style: 'cancel' }],
    );
  };

  const renderContent = () => {
    if (!conversationId || isLoading || createConversationMutation.isPending) {
      return <LoadingView message="Opening chat session..." />;
    }

    if (isError) {
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
          sendMessageMutation.isPending
        }
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
