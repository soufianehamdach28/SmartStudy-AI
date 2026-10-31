/**
 * SmartStudy AI — root component.
 *
 * Step 0 only proves the app boots, the theme works, and the shared workspace
 * package resolves inside Metro.
 */

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { API_PREFIX } from '@smartstudy/shared';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>SmartStudy AI</Text>
          <Text style={styles.subtitle}>Foundations are ready.</Text>
          <Text style={styles.meta}>API base path: {API_PREFIX}</Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
  },
  meta: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default App;
