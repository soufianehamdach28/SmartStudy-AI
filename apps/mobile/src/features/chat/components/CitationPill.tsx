import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { Citation } from '@smartstudy/shared';

export interface CitationPillProps {
  citation: Citation;
  onPress?: (citation: Citation) => void;
}

export function CitationPill({ citation, onPress }: CitationPillProps) {
  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={() => onPress?.(citation)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View source excerpt from page ${citation.page}`}
      accessibilityHint="Opens the exact document excerpt modal"
      testID={`citation-pill-${citation.chunkId}`}
    >
      <Text style={styles.icon}>📄</Text>
      <Text style={styles.pageText}>{`Page ${citation.page}`}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  icon: {
    fontSize: 12,
    marginRight: 4,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  chevron: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366F1',
    marginLeft: 4,
    lineHeight: 14,
  },
});
