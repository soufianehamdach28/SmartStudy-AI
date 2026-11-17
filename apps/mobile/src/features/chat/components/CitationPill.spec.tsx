import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Citation } from '@smartstudy/shared';
import { CitationPill } from './CitationPill';

describe('CitationPill', () => {
  const mockCitation: Citation = {
    chunkId: '11111111-1111-1111-1111-111111111111',
    page: 5,
    excerpt: 'Photosynthesis is essential for plant growth.',
  };

  it('renders page label and icon', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <CitationPill citation={mockCitation} />,
      );
    });

    const root = renderer!.root;
    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');

    expect(allText).toContain('📄');
    expect(allText).toContain('Page 5');
    expect(allText).toContain('›');
  });

  it('triggers onPress with the citation when tapped', () => {
    const onPress = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <CitationPill citation={mockCitation} onPress={onPress} />,
      );
    });

    const root = renderer!.root;
    const pill = root.findByProps({
      testID: `citation-pill-${mockCitation.chunkId}`,
    });

    act(() => {
      pill.props.onPress();
    });

    expect(onPress).toHaveBeenCalledWith(mockCitation);
  });
});
