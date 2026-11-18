import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { OfflineBanner } from './OfflineBanner';
import * as useNetworkStatusModule from '../hooks/useNetworkStatus';

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when device is online', () => {
    jest.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      isOffline: false,
      connectionType: 'wifi',
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<OfflineBanner />);
    });

    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders banner with default message when device is offline', () => {
    jest.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      isOffline: true,
      connectionType: 'none',
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<OfflineBanner />);
    });

    const root = renderer!.root;
    const banner = root.findByProps({ testID: 'offline-banner' });
    expect(banner).toBeDefined();

    const textNodes = root.findAllByType('Text' as any);
    const textContents = textNodes.map((n) => n.props.children);
    expect(
      textContents.includes('No internet connection. Viewing cached content.'),
    ).toBe(true);
  });

  it('renders custom message when specified', () => {
    jest.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      isOffline: true,
      connectionType: 'none',
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <OfflineBanner message="Custom offline notice" />,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType('Text' as any);
    const textContents = textNodes.map((n) => n.props.children);
    expect(textContents.includes('Custom offline notice')).toBe(true);
  });
});
