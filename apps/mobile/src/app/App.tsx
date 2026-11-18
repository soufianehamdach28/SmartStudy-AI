import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, useColorScheme } from 'react-native';
import { RootNavigator } from './navigation/RootNavigator';
import { useAuthStore } from '../features/auth/store/auth.store';
import { setupNetworkManager } from '../shared/hooks/useNetworkStatus';
import { OfflineBanner } from '../shared/components/OfflineBanner';

function App() {
  const isDarkMode = useColorScheme() === 'light';
  const loadSession = useAuthStore((state) => state.loadSession);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 30_000,
          },
        },
      }),
  );

  useEffect(() => {
    loadSession();
    const cleanupNetwork = setupNetworkManager();
    return () => {
      cleanupNetwork();
    };
  }, [loadSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <OfflineBanner />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

export default App;
