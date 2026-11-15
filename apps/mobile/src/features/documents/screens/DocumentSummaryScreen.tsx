import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../../app/navigation/types';
import { EmptyView } from '../../../shared/components/EmptyView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { MarkdownView } from '../../../shared/components/MarkdownView';
import { parseDocumentErrorMessage } from '../api/documents.api';
import {
  useDocumentSummary,
  useRegenerateDocumentSummary,
} from '../hooks/useDocumentSummary';

type Props = NativeStackScreenProps<AppStackParamList, 'DocumentSummary'>;

export function DocumentSummaryScreen({ route, navigation }: Props) {
  const { documentId, documentTitle } = route.params;

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useDocumentSummary(documentId);
  const regenerateMutation = useRegenerateDocumentSummary(documentId);

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (!data?.summary) return;
    try {
      Clipboard.setString(data.summary);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Copy failed', 'Unable to copy summary to clipboard.');
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync();
    } catch (err) {
      Alert.alert(
        'Regeneration Failed',
        parseDocumentErrorMessage(err),
      );
    }
  };

  const isWorking = isLoading || isRefetching || regenerateMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>
          {documentTitle}
        </Text>
        <View style={styles.appBarActions}>
          {data?.summary && (
            <TouchableOpacity
              onPress={handleCopy}
              style={styles.actionPill}
              accessibilityRole="button"
              accessibilityLabel="Copy summary to clipboard"
            >
              <Text style={styles.actionPillText}>
                {copied ? '✓ Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mandatory AI Disclaimer Notice (Security Rule #12) */}
      <View style={styles.disclaimerBanner} testID="ai-disclaimer-banner">
        <Text style={styles.disclaimerIcon}>⚠️</Text>
        <Text style={styles.disclaimerText}>
          <Text style={styles.disclaimerBold}>AI answers may be incorrect.</Text>{' '}
          Please verify key facts and formulas with your original document.
        </Text>
      </View>

      {/* Screen States */}
      {isWorking && !data ? (
        <LoadingView message="Generating summary with AI..." />
      ) : isError ? (
        <ErrorView
          message={parseDocumentErrorMessage(error)}
          onRetry={refetch}
        />
      ) : !data?.summary ? (
        <EmptyView
          title="No summary available"
          description="This document does not have a generated summary yet."
        />
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {data.cached && (
            <View style={styles.cachedBadge}>
              <Text style={styles.cachedBadgeText}>⚡ Loaded from cache</Text>
            </View>
          )}

          <MarkdownView content={data.summary} />

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.regenerateButton}
              onPress={handleRegenerate}
              disabled={isWorking}
              accessibilityRole="button"
              accessibilityLabel="Regenerate summary"
            >
              <Text style={styles.regenerateButtonText}>
                {regenerateMutation.isPending
                  ? 'Regenerating...'
                  : '↻ Regenerate Summary'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F46E5',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  appBarActions: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  actionPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  disclaimerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  disclaimerBold: {
    fontWeight: '700',
  },
  cachedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  cachedBadgeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  footerActions: {
    marginTop: 32,
    alignItems: 'center',
  },
  regenerateButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  regenerateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
