import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

export interface LoadingViewProps {
  message?: string;
  style?: ViewStyle;
}

export function LoadingView({
  message = 'Loading documents...',
  style,
}: LoadingViewProps) {
  return (
    <View style={[styles.container, style]} testID="loading-view">
      <ActivityIndicator size="large" color="#2563EB" />
      {Boolean(message) && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
});
