import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../auth/store/auth.store';

export function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SmartStudy</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>Role: {user?.role}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
