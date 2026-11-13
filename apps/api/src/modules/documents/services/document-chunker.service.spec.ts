import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentChunkerService } from './document-chunker.service.js';
import type { ExtractedPage } from './document-extractor.service.js';

describe('DocumentChunkerService', () => {
  let chunker: DocumentChunkerService;

  beforeEach(() => {
    chunker = new DocumentChunkerService();
  });

  it('creates a single chunk when page content is smaller than maxSize', () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: 'Introduction to Mechanics.\n\nVelocity is the derivative of position.',
      },
    ];

    const chunks = chunker.chunkPages(pages);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      index: 0,
      page: 1,
      text: 'Introduction to Mechanics.\n\nVelocity is the derivative of position.',
      charStart: 0,
      charEnd: pages[0].text.length,
    });
  });

  it('skips empty and whitespace-only pages', () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: 'First page text' },
      { pageNumber: 2, text: '   \n\t  ' },
      { pageNumber: 3, text: 'Third page text' },
    ];

    const chunks = chunker.chunkPages(pages);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].page).toBe(3);
    expect(chunks[1].index).toBe(1);
  });

  it('increments global index sequentially across multiple pages', () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: 'Page 1' },
      { pageNumber: 2, text: 'Page 2' },
      { pageNumber: 3, text: 'Page 3' },
    ];

    const chunks = chunker.chunkPages(pages);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(chunks.map((c) => c.page)).toEqual([1, 2, 3]);
  });

  it('splits large page text into multiple chunks with overlap', () => {
    const paragraph1 = 'A'.repeat(1500);
    const paragraph2 = 'B'.repeat(1500);
    const paragraph3 = 'C'.repeat(1500);
    const text = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

    const pages: ExtractedPage[] = [{ pageNumber: 1, text }];
    const chunks = chunker.chunkPages(pages, {
      targetSize: 1600,
      maxSize: 2200,
      overlap: 100,
    });

    expect(chunks.length).toBeGreaterThan(1);

    // Verify all chunks have index and correct page
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      expect(chunks[i].page).toBe(1);
      expect(chunks[i].text.length).toBeGreaterThan(0);
      expect(chunks[i].text.length).toBeLessThanOrEqual(2200);
    }
  });

  it('ensures charStart and charEnd accurately match chunk text in the original page', () => {
    const text =
      'Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles.\n\n' +
      'It is the foundation of all quantum physics including quantum chemistry, quantum field theory, quantum technology, and quantum information science.\n\n' +
      'Classical physics, the collection of theories that existed before the advent of quantum mechanics, describes many aspects of nature at an ordinary scale.\n\n' +
      'Most theories in classical physics can be derived from quantum mechanics as an approximation valid at large scale.\n\n' +
      'Planck postulated that energy is radiated and absorbed in discrete quanta.';

    const pages: ExtractedPage[] = [{ pageNumber: 1, text }];

    const chunks = chunker.chunkPages(pages, {
      targetSize: 180,
      maxSize: 250,
      overlap: 40,
    });

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const slice = text.slice(chunk.charStart, chunk.charEnd);
      expect(slice).toBe(chunk.text);
    }
  });

  it('prefers breaking on paragraph boundaries when available', () => {
    const p1 = 'First paragraph with some text.';
    const p2 = 'Second paragraph with additional information.';
    const text = `${p1}\n\n${p2}`;

    const pages: ExtractedPage[] = [{ pageNumber: 1, text }];

    const chunks = chunker.chunkPages(pages, {
      targetSize: 40,
      maxSize: 60,
      overlap: 10,
    });

    expect(chunks[0].text).toBe(p1);
  });
});
