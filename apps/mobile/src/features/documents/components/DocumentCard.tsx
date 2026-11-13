import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DocumentResponse, DocumentStatus } from '@smartstudy/shared';

export interface DocumentCardProps {
  document: DocumentResponse;
  onPress?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadgeConfig(status: DocumentStatus): {
  label: string;
  bg: string;
  text: string;
  showSpinner?: boolean;
} {
  switch (status) {
    case 'UPLOADED':
      return {
        label: 'Queued',
        bg: '#FEF3C7',
        text: '#92400E',
        showSpinner: true,
      };
    case 'PROCESSING':
      return {
        label: 'Processing...',
        bg: '#DBEAFE',
        text: '#1E40AF',
        showSpinner: true,
      };
    case 'READY':
      return {
        label: 'Ready',
        bg: '#D1FAE5',
        text: '#065F46',
      };
    case 'FAILED':
      return {
        label: 'Failed',
        bg: '#FEE2E2',
        text: '#991B1B',
      };
  }
}

export function DocumentCard({
  document,
  onPress,
  onDelete,
  isDeleting = false,
}: DocumentCardProps) {
  const badge = getStatusBadgeConfig(document.status);
  const isPdf = document.mimeType === 'application/pdf';

  const handleDeletePress = () => {
    if (!onDelete) return;

    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.title}"? All extracted chunks and generated content will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress || document.status !== 'READY'}
      testID={`document-card-${document.id}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconContainer}>
          <Text style={styles.fileIcon}>{isPdf ? '📕' : '📝'}</Text>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {document.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatBytes(document.sizeBytes)}</Text>
            {document.pageCount ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>
                  {document.pageCount} page{document.pageCount > 1 ? 's' : ''}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {Boolean(onDelete) && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeletePress}
            disabled={isDeleting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`delete-document-${document.id}`}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.deleteIconText}>🗑️</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Status & Error Row */}
      <View style={styles.footerRow}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          {badge.showSpinner ? (
            <ActivityIndicator
              size="small"
              color={badge.text}
              style={styles.badgeSpinner}
            />
          ) : null}
          <Text style={[styles.badgeText, { color: badge.text }]}>
            {badge.label}
          </Text>
        </View>

        {document.status === 'FAILED' && document.errorMessage ? (
          <Text style={styles.errorText} numberOfLines={1}>
            {document.errorMessage}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIcon: {
    fontSize: 20,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#9CA3AF',
    fontSize: 13,
  },
  deleteButton: {
    padding: 6,
    marginLeft: 8,
  },
  deleteIconText: {
    fontSize: 16,
  },
  footerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeSpinner: {
    marginRight: 4,
    transform: [{ scale: 0.75 }],
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 8,
  },
});
