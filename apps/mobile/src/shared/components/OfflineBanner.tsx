import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export interface OfflineBannerProps {
  message?: string;
  style?: ViewStyle;
}

export function OfflineBanner({
  message = 'No internet connection. Viewing cached content.',
  style,
}: OfflineBannerProps) {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <View
      style={[styles.container, style]}
      testID="offline-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#B45309', // Amber-700 for high-contrast accessibility
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 14,
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
