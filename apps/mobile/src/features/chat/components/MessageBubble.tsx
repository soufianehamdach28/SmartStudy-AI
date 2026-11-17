import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Citation, Message } from '@smartstudy/shared';
import { MarkdownView } from '../../../shared/components/MarkdownView';

export interface MessageBubbleProps {
  message: Message;
  onCitationPress?: (citation: Citation) => void;
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function MessageBubble({
  message,
  onCitationPress,
}: MessageBubbleProps) {
  const isUser = message.role === 'USER';
  const hasCitations = !isUser && message.citations && message.citations.length > 0;

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
      testID={`message-bubble-${message.id}`}
    >
      {!isUser && (
        <View style={styles.assistantHeader}>
          <Text style={styles.assistantBadge}>🤖 AI Tutor</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <MarkdownView content={message.content} />
        )}

        {hasCitations && (
          <View style={styles.citationsContainer}>
            <Text style={styles.citationsLabel}>Sources:</Text>
            <View style={styles.pillsRow}>
              {message.citations.map((citation, idx) => (
                <TouchableOpacity
                  key={`${citation.chunkId}-${idx}`}
                  style={styles.citationPill}
                  onPress={() => onCitationPress?.(citation)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Citation: Page ${citation.page}`}
                  testID={`citation-pill-${citation.chunkId}`}
                >
                  <Text style={styles.citationPillText}>
                    {`📄 Page ${citation.page}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text
          style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.assistantTimestamp,
          ]}
        >
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 16,
    maxWidth: '88%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  assistantHeader: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assistantBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  citationsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  citationsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  citationPill: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  citationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  assistantTimestamp: {
    color: '#94A3B8',
  },
});
