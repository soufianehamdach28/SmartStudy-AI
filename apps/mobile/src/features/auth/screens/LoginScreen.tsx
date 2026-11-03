import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AuthNavigationProp } from '../../../app/navigation/types';

export function LoginScreen() {
  const navigation = useNavigation<AuthNavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>Sign in to your SmartStudy account</Text>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.switchText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  switchButton: {
    marginTop: 16,
    padding: 12,
  },
  switchText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
});
