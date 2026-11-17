import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Clipboard, Text } from 'react-native';
import type { Citation } from '@smartstudy/shared';
import { SourceExcerptModal } from './SourceExcerptModal';

jest.spyOn(Clipboard, 'setString');

describe('SourceExcerptModal', () => {
  const mockCitation: Citation = {
    chunkId: 'chunk-123',
    page: 4,
    excerpt: 'Mitochondria are double-membrane-bound organelles.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when citation is null', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SourceExcerptModal
          visible={true}
          citation={null}
          onClose={jest.fn()}
        />,
      );
    });

    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders document title, page badge, excerpt text, and verified note when visible', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SourceExcerptModal
          visible={true}
          citation={mockCitation}
          documentTitle="Biology 101.pdf"
          onClose={jest.fn()}
        />,
      );
    });

    const root = renderer!.root;
    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');

    expect(allText).toContain('Biology 101.pdf');
    expect(allText).toContain('Page 4');
    expect(allText).toContain(mockCitation.excerpt);
    expect(allText).toContain('extracted directly from page 4');
  });

  it('calls onClose when close button or done button is pressed', () => {
    const onClose = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SourceExcerptModal
          visible={true}
          citation={mockCitation}
          onClose={onClose}
        />,
      );
    });

    const root = renderer!.root;
    const closeBtn = root.findByProps({ testID: 'close-modal-button' });
    act(() => {
      closeBtn.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const doneBtn = root.findByProps({ testID: 'done-modal-button' });
    act(() => {
      doneBtn.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls Clipboard.setString and displays Copied state when copy button is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SourceExcerptModal
          visible={true}
          citation={mockCitation}
          onClose={jest.fn()}
        />,
      );
    });

    const root = renderer!.root;
    const copyBtn = root.findByProps({ testID: 'copy-excerpt-button' });

    act(() => {
      copyBtn.props.onPress();
    });

    expect(Clipboard.setString).toHaveBeenCalledWith(mockCitation.excerpt);

    const allText = root.findAllByType(Text).map((t) => t.props.children).flat().join(' ');
    expect(allText).toContain('Copied');
  });
});
