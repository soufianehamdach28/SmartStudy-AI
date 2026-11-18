import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Configure React Query's onlineManager to automatically sync with NetInfo.
 * Should be called once during root app initialization.
 */
export function setupNetworkManager(): () => void {
  let unsubscribeNetInfo: (() => void) | undefined;
  onlineManager.setEventListener((setOnline) => {
    unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(isOnline);
    });
    return () => {
      unsubscribeNetInfo?.();
    };
  });
  return () => {
    unsubscribeNetInfo?.();
  };
}

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOffline: boolean;
  connectionType: string;
}

/**
 * Hook to observe live network connectivity.
 * Returns boolean flags indicating whether the device is offline or online.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    isOffline: false,
    connectionType: 'unknown',
  });

  useEffect(() => {
    let isMounted = true;

    // Initial fetch of current network state
    NetInfo.fetch().then((state) => {
      if (!isMounted) return;
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        isOffline,
        connectionType: state.type,
      });
    });

    // Listen to network transitions
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!isMounted) return;
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        isOffline,
        connectionType: state.type,
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return status;
}
