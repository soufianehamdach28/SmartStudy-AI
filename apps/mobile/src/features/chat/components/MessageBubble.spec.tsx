import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Message } from '@smartstudy/shared';
import { MessageBubble } from './MessageBubble';

describe('MessageBubble', () => {
  const userMessage: Message = {
    id: 'msg-u',
    conversationId: 'conv-1',
    role: 'USER',
    content: 'What is photosynthesis?',
    citations: [],
    createdAt: '2026-11-17T02:00:00.000Z',
  };

  const assistantMessage: Message = {
    id: 'msg-a',
    conversationId: 'conv-1',
    role: 'ASSISTANT',
    content: 'Photosynthesis is the process plants use to convert light into energy.',
    citations: [
      {
        chunkId: 'chunk-1',
        page: 4,
        excerpt: 'Plants use sunlight to synthesize nutrients.',
      },
    ],
    createdAt: '2026-11-17T02:00:02.000Z',
  };

  it('renders user message cleanly without assistant badge or citations', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MessageBubble message={userMessage} />,
      );
    });

    const root = renderer!.root;
    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');

    expect(allText).toContain('What is photosynthesis?');
    expect(allText).not.toContain('AI Tutor');
    expect(allText).not.toContain('Sources:');
  });

  it('renders assistant message with AI badge and citation pills', () => {
    const onCitationPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MessageBubble
          message={assistantMessage}
          onCitationPress={onCitationPress}
        />,
      );
    });

    const root = renderer!.root;
    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');

    expect(allText).toContain('AI Tutor');
    expect(allText).toContain('Sources:');
    expect(allText).toContain('Page 4');

    // Press the citation pill
    const citationPill = root.findByProps({
      testID: 'citation-pill-chunk-1',
    });
    act(() => {
      citationPill.props.onPress();
    });

    expect(onCitationPress).toHaveBeenCalledWith(assistantMessage.citations[0]);
  });
});
