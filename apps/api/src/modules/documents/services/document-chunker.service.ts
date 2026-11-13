import { Injectable } from '@nestjs/common';
import type { ExtractedPage } from './document-extractor.service.js';

export interface RawChunk {
  index: number;
  page: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface ChunkerOptions {
  /** Target chunk character length (~500 tokens). Defaults to 2000. */
  targetSize: number;
  /** Maximum chunk character length before forcing a cut (~800 tokens). Defaults to 3200. */
  maxSize: number;
  /** Overlap in characters between adjacent chunks. Defaults to 200. */
  overlap: number;
}

const DEFAULT_CHUNKER_OPTIONS: ChunkerOptions = {
  targetSize: 2000,
  maxSize: 3200,
  overlap: 200,
};

@Injectable()
export class DocumentChunkerService {
  /**
   * Split an array of extracted pages into chunks with page numbers and character offsets.
   * Chunks are generated per page so citations can pinpoint the exact page and excerpt.
   */
  chunkPages(
    pages: ExtractedPage[],
    customOptions?: Partial<ChunkerOptions>,
  ): RawChunk[] {
    const options: ChunkerOptions = {
      ...DEFAULT_CHUNKER_OPTIONS,
      ...customOptions,
    };

    const allChunks: RawChunk[] = [];
    let globalIndex = 0;

    for (const page of pages) {
      const pageText = page.text;
      if (!pageText || pageText.trim().length === 0) {
        continue;
      }

      const pageChunks = this.chunkSinglePage(
        pageText,
        page.pageNumber,
        globalIndex,
        options,
      );

      for (const chunk of pageChunks) {
        allChunks.push(chunk);
        globalIndex++;
      }
    }

    return allChunks;
  }

  private chunkSinglePage(
    text: string,
    pageNumber: number,
    startIndex: number,
    options: ChunkerOptions,
  ): RawChunk[] {
    const chunks: RawChunk[] = [];
    const len = text.length;
    let currentIndex = startIndex;

    // Small page fits in a single chunk
    if (len <= options.maxSize) {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        const leading = text.length - text.trimStart().length;
        const trailing = text.length - text.trimEnd().length;
        chunks.push({
          index: currentIndex,
          page: pageNumber,
          text: trimmed,
          charStart: leading,
          charEnd: len - trailing,
        });
      }
      return chunks;
    }

    let start = 0;

    while (start < len) {
      let end = Math.min(start + options.targetSize, len);

      if (end < len) {
        // Search for a natural semantic boundary between start and start + maxSize
        const searchMax = Math.min(start + options.maxSize, len);
        const searchSlice = text.slice(start, searchMax);
        const boundary = this.findBoundary(searchSlice, options.overlap);

        if (boundary > options.overlap) {
          end = start + boundary;
        } else {
          // If no natural boundary was found, clamp to searchMax
          end = searchMax;
        }
      }

      const rawChunk = text.slice(start, end);
      const trimmed = rawChunk.trim();

      if (trimmed.length > 0) {
        const leading = rawChunk.length - rawChunk.trimStart().length;
        const trailing = rawChunk.length - rawChunk.trimEnd().length;
        chunks.push({
          index: currentIndex++,
          page: pageNumber,
          text: trimmed,
          charStart: start + leading,
          charEnd: end - trailing,
        });
      }

      if (end >= len) {
        break;
      }

      // Next chunk starts before 'end' by 'overlap' characters, but must always advance
      start = Math.max(start + 1, end - options.overlap);
    }

    return chunks;
  }

  /**
   * Find a semantic break position in `slice`, prioritizing:
   * 1. Paragraph breaks (\n\n)
   * 2. Sentence terminators (.!?) followed by whitespace
   * 3. Single newlines (\n)
   * 4. Word boundary (spaces)
   */
  private findBoundary(slice: string, minLength: number): number {
    if (slice.length <= minLength) {
      return slice.length;
    }

    // 1. Paragraph boundary
    const paragraphIndex = slice.lastIndexOf('\n\n');
    if (paragraphIndex >= minLength) {
      return paragraphIndex;
    }

    // 2. Sentence boundary
    const sentenceMatches = [...slice.matchAll(/[.!?]\s+/g)];
    if (sentenceMatches.length > 0) {
      const lastMatch = sentenceMatches[sentenceMatches.length - 1];
      const endPos = (lastMatch.index ?? 0) + lastMatch[0].length;
      if (endPos >= minLength) {
        return endPos;
      }
    }

    // 3. Single newline
    const newlineIndex = slice.lastIndexOf('\n');
    if (newlineIndex >= minLength) {
      return newlineIndex;
    }

    // 4. Word boundary (whitespace)
    const spaceIndex = slice.lastIndexOf(' ');
    if (spaceIndex >= minLength) {
      return spaceIndex;
    }

    // 5. Fallback
    return slice.length;
  }
}
