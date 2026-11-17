import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator } from 'react-native';
import { ChatInputBar } from './ChatInputBar';

describe('ChatInputBar', () => {
  it('disables send button when input is empty or whitespace', () => {
    const onSend = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(<ChatInputBar onSend={onSend} />);
    });

    const root = renderer!.root;
    const sendButton = root.findByProps({ testID: 'send-message-button' });

    expect(sendButton.props.disabled).toBe(true);

    const input = root.findByProps({ testID: 'chat-input' });
    act(() => {
      input.props.onChangeText('   ');
    });

    expect(sendButton.props.disabled).toBe(true);

    act(() => {
      sendButton.props.onPress();
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('enables send button and triggers onSend when non-empty text is submitted', () => {
    const onSend = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(<ChatInputBar onSend={onSend} />);
    });

    const root = renderer!.root;
    const input = root.findByProps({ testID: 'chat-input' });
    const sendButton = root.findByProps({ testID: 'send-message-button' });

    act(() => {
      input.props.onChangeText('How does osmosis work?');
    });

    expect(sendButton.props.disabled).toBe(false);

    act(() => {
      sendButton.props.onPress();
    });

    expect(onSend).toHaveBeenCalledWith('How does osmosis work?');
    expect(input.props.value).toBe('');
  });

  it('shows ActivityIndicator and disables input when disabled=true', () => {
    const onSend = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ChatInputBar onSend={onSend} disabled={true} />,
      );
    });

    const root = renderer!.root;
    const spinner = root.findByType(ActivityIndicator);
    const input = root.findByProps({ testID: 'chat-input' });

    expect(spinner).toBeTruthy();
    expect(input.props.editable).toBe(false);
  });
});
