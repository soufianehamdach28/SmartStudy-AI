import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AuthNavigationProp } from '../../../app/navigation/types';

export function RegisterScreen() {
  const navigation = useNavigation<AuthNavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Sign up to start studying smarter</Text>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.switchText}>Already have an account? Sign in</Text>
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
