import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractText } from 'unpdf';
import type { Env } from '../../../core/config/env.js';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  pageCount: number;
  pages: ExtractedPage[];
}

@Injectable()
export class DocumentExtractorService {
  private readonly logger = new Logger(DocumentExtractorService.name);
  private readonly maxPages: number;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.maxPages = this.config.get('MAX_PAGES', { infer: true });
  }

  /**
   * Extract text per page from PDF or TXT buffer.
   * Throws if:
   * - Total pages exceed MAX_PAGES
   * - PDF has no selectable text (scanned PDF)
   * - TXT is completely empty
   * - Unsupported MIME type
   */
  async extract(buffer: Buffer, mimeType: string): Promise<ExtractedDocument> {
    if (mimeType === 'application/pdf') {
      return this.extractPdf(buffer);
    }

    if (mimeType === 'text/plain') {
      return this.extractTxt(buffer);
    }

    throw new Error(`Unsupported MIME type for extraction: ${mimeType}`);
  }

  private async extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
    let result: { totalPages: number; text: string[] };

    try {
      result = await extractText(new Uint8Array(buffer), { mergePages: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to parse PDF: ${message}`);
      throw new Error(`Failed to extract text from PDF: ${message}`);
    }

    if (!result || result.totalPages === 0) {
      throw new Error(
        'This document contains no pages or could not be read as a valid PDF.',
      );
    }

    if (result.totalPages > this.maxPages) {
      throw new Error(
        `Document has ${result.totalPages} pages, exceeding the maximum allowed limit of ${this.maxPages} pages.`,
      );
    }

    const pages: ExtractedPage[] = [];
    let totalTextLength = 0;

    for (let i = 0; i < result.totalPages; i++) {
      const pageText = (result.text[i] ?? '').trim();
      totalTextLength += pageText.length;
      pages.push({
        pageNumber: i + 1,
        text: pageText,
      });
    }

    // Check for scanned PDF / image-only PDF
    if (totalTextLength === 0) {
      throw new Error(
        'This document contains no extractable text. Scanned PDFs without an OCR text layer are not currently supported.',
      );
    }

    return {
      pageCount: result.totalPages,
      pages,
    };
  }

  private extractTxt(buffer: Buffer): ExtractedDocument {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      throw new Error('The text document contains no readable content.');
    }

    // Support standard form-feed character (\f) for multi-page TXT files
    if (text.includes('\f')) {
      const rawPages = text.split('\f');
      const pages: ExtractedPage[] = [];

      for (let i = 0; i < rawPages.length; i++) {
        const pageText = rawPages[i].trim();
        if (pageText.length > 0) {
          pages.push({
            pageNumber: pages.length + 1,
            text: pageText,
          });
        }
      }

      if (pages.length > 0) {
        return {
          pageCount: pages.length,
          pages,
        };
      }
    }

    return {
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: trimmed,
        },
      ],
    };
  }
}
