import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import {
  useNetworkStatus,
  setupNetworkManager,
  type NetworkStatus,
} from './useNetworkStatus';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupNetworkManager', () => {
    it('wires onlineManager event listener with NetInfo.addEventListener', () => {
      const setEventListenerSpy = jest.spyOn(onlineManager, 'setEventListener');
      const cleanup = setupNetworkManager();

      expect(setEventListenerSpy).toHaveBeenCalled();
      expect(typeof cleanup).toBe('function');
    });

    it('sets online state based on NetInfo state', () => {
      let listenerCallback: any;
      jest.spyOn(NetInfo, 'addEventListener').mockImplementation((callback) => {
        listenerCallback = callback;
        return jest.fn();
      });

      const setOnlineMock = jest.fn();
      onlineManager.setEventListener = jest.fn((fn) => {
        fn(setOnlineMock);
      });

      setupNetworkManager();

      // Trigger online
      listenerCallback({ isConnected: true, isInternetReachable: true });
      expect(setOnlineMock).toHaveBeenCalledWith(true);

      // Trigger disconnected
      listenerCallback({ isConnected: false, isInternetReachable: false });
      expect(setOnlineMock).toHaveBeenCalledWith(false);
    });
  });

  describe('useNetworkStatus hook', () => {
    it('returns initial online status when NetInfo is connected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });

      let hookValue!: NetworkStatus;
      function TestComponent() {
        hookValue = useNetworkStatus();
        return null;
      }

      await act(async () => {
        ReactTestRenderer.create(<TestComponent />);
      });

      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      });

      expect(hookValue.isConnected).toBe(true);
      expect(hookValue.isOffline).toBe(false);
      expect(hookValue.connectionType).toBe('wifi');
    });

    it('updates to offline state when NetInfo fires disconnected event', async () => {
      let listenerCallback: any;
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        listenerCallback = callback;
        return jest.fn();
      });

      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });

      let hookValue!: NetworkStatus;
      function TestComponent() {
        hookValue = useNetworkStatus();
        return null;
      }

      await act(async () => {
        ReactTestRenderer.create(<TestComponent />);
      });

      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      });

      expect(hookValue.isOffline).toBe(false);

      // Simulate network loss
      await act(async () => {
        listenerCallback({
          type: 'none',
          isConnected: false,
          isInternetReachable: false,
        });
      });

      expect(hookValue.isConnected).toBe(false);
      expect(hookValue.isOffline).toBe(true);
      expect(hookValue.connectionType).toBe('none');
    });
  });
});
