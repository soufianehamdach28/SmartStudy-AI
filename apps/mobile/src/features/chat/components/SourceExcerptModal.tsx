import React, { useEffect, useRef, useState } from 'react';
import {
  Clipboard,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { Citation } from '@smartstudy/shared';

export interface SourceExcerptModalProps {
  visible: boolean;
  citation: Citation | null;
  documentTitle?: string;
  onClose: () => void;
}

export function SourceExcerptModal({
  visible,
  citation,
  documentTitle = 'Course Document',
  onClose,
}: SourceExcerptModalProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!citation) {
    return null;
  }

  const handleCopy = () => {
    Clipboard.setString(citation.excerpt);
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="source-excerpt-modal"
    >
      <TouchableWithoutFeedback onPress={onClose} testID="modal-backdrop">
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card} testID="source-excerpt-card">
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleGroup}>
                  <Text style={styles.documentTitle} numberOfLines={1}>
                    {documentTitle}
                  </Text>
                  <View style={styles.pageBadge}>
                    <Text style={styles.pageBadgeText}>
                      {`📄 Page ${citation.page}`}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close source excerpt"
                  testID="close-modal-button"
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Subtitle Label */}
              <Text style={styles.sectionLabel}>Source Excerpt</Text>

              {/* Excerpt Content Box */}
              <View style={styles.excerptBox}>
                <Text style={styles.excerptText} testID="source-excerpt-text">
                  "{citation.excerpt}"
                </Text>
              </View>

              {/* Verified Notice */}
              <View style={styles.noticeRow}>
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={styles.noticeText}>
                  {`This excerpt was extracted directly from page ${citation.page} of your course material.`}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.copyButton,
                    copied && styles.copyButtonActive,
                  ]}
                  onPress={handleCopy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copy excerpt to clipboard"
                  testID="copy-excerpt-button"
                >
                  <Text
                    style={[
                      styles.copyButtonText,
                      copied && styles.copyButtonTextActive,
                    ]}
                  >
                    {copied ? '✓ Copied' : '📋 Copy Excerpt'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss modal"
                  testID="done-modal-button"
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: 12,
  },
  documentTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  pageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  closeButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  excerptBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  excerptText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1E293B',
    fontStyle: 'italic',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
  },
  noticeIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  noticeText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  copyButtonActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  copyButtonTextActive: {
    color: '#166534',
  },
  doneButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
