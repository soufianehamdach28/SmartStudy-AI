import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { OfflineView } from './OfflineView';

describe('OfflineView', () => {
  it('renders default offline message and title', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<OfflineView />);
    });

    const root = renderer!.root;
    const view = root.findByProps({ testID: 'offline-view' });
    expect(view).toBeDefined();

    const textNodes = root.findAllByType('Text' as any);
    const textContents = textNodes.map((n) => n.props.children);

    expect(textContents.includes('You are offline')).toBe(true);
    expect(
      textContents.includes(
        'Please check your internet connection to access or update this content.',
      ),
    ).toBe(true);
  });

  it('renders custom title and message when provided', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <OfflineView
          title="No Network"
          message="Connect to Wi-Fi or cellular."
        />,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType('Text' as any);
    const textContents = textNodes.map((n) => n.props.children);

    expect(textContents.includes('No Network')).toBe(true);
    expect(textContents.includes('Connect to Wi-Fi or cellular.')).toBe(true);
  });

  it('renders and invokes retry button when onRetry is provided', () => {
    const onRetryMock = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<OfflineView onRetry={onRetryMock} />);
    });

    const root = renderer!.root;
    const retryBtn = root.findByProps({ testID: 'offline-view-retry' });
    expect(retryBtn).toBeDefined();

    act(() => {
      retryBtn.props.onPress();
    });

    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is omitted', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<OfflineView />);
    });

    const root = renderer!.root;
    const retryBtns = root.findAllByProps({ testID: 'offline-view-retry' });
    expect(retryBtns.length).toBe(0);
  });
});
