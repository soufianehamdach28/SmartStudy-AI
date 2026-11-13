import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentExtractorService } from './document-extractor.service.js';

function createPdfWithText(text: string): Buffer {
  const content = `BT /F1 18 Tf 100 100 Td (${text}) Tj ET`;
  const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const pdfStr = [
    '%PDF-1.4',
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj',
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj',
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R>> endobj',
    '4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj',
    '5 0 obj ' + stream + ' endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    'trailer <</Size 6 /Root 1 0 R>>',
    'startxref',
    '500',
    '%%EOF',
  ].join('\n');
  return Buffer.from(pdfStr);
}

function createBlankPdf(): Buffer {
  const pdfStr = [
    '%PDF-1.4',
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj',
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj',
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>>>> endobj',
    'xref',
    '0 4',
    '0000000000 65535 f ',
    'trailer <</Size 4 /Root 1 0 R>>',
    'startxref',
    '250',
    '%%EOF',
  ].join('\n');
  return Buffer.from(pdfStr);
}

describe('DocumentExtractorService', () => {
  let service: DocumentExtractorService;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockConfigService = {
      get: (key: string) => {
        if (key === 'MAX_PAGES') return 10;
        return undefined;
      },
    } as unknown as ConfigService;

    service = new DocumentExtractorService(mockConfigService as any);
  });

  describe('extractTxt', () => {
    it('extracts text from a single-page TXT document', async () => {
      const buffer = Buffer.from('Hello SmartStudy!\nThis is a physics course.');
      const result = await service.extract(buffer, 'text/plain');

      expect(result.pageCount).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toEqual({
        pageNumber: 1,
        text: 'Hello SmartStudy!\nThis is a physics course.',
      });
    });

    it('extracts multi-page TXT separated by form-feed characters', async () => {
      const buffer = Buffer.from('Page 1 content\fPage 2 content\fPage 3 content');
      const result = await service.extract(buffer, 'text/plain');

      expect(result.pageCount).toBe(3);
      expect(result.pages).toHaveLength(3);
      expect(result.pages[0]).toEqual({ pageNumber: 1, text: 'Page 1 content' });
      expect(result.pages[1]).toEqual({ pageNumber: 2, text: 'Page 2 content' });
      expect(result.pages[2]).toEqual({ pageNumber: 3, text: 'Page 3 content' });
    });

    it('throws when TXT file is completely empty or only whitespace', async () => {
      const buffer = Buffer.from('   \n\t  \n  ');
      await expect(service.extract(buffer, 'text/plain')).rejects.toThrow(
        'The text document contains no readable content.',
      );
    });
  });

  describe('extractPdf', () => {
    it('extracts text from a valid PDF document with text layer', async () => {
      const pdf = createPdfWithText('Photosynthesis is the process...');
      const result = await service.extract(pdf, 'application/pdf');

      expect(result.pageCount).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].text).toContain('Photosynthesis is the process');
    });

    it('detects scanned/empty PDF and throws descriptive error', async () => {
      const blankPdf = createBlankPdf();
      await expect(service.extract(blankPdf, 'application/pdf')).rejects.toThrow(
        /Scanned PDFs without an OCR text layer are not currently supported/,
      );
    });

    it('throws when document exceeds MAX_PAGES', async () => {
      // Configure service with maxPages = 0 to trigger the check
      const lowLimitService = new DocumentExtractorService({
        get: () => 0,
      } as any);

      const pdf = createPdfWithText('Some text');
      await expect(lowLimitService.extract(pdf, 'application/pdf')).rejects.toThrow(
        /exceeding the maximum allowed limit of 0 pages/,
      );
    });

    it('throws on corrupted PDF buffer', async () => {
      const corrupted = Buffer.from('%PDF-1.4\ncorrupted data that cannot be parsed');
      await expect(service.extract(corrupted, 'application/pdf')).rejects.toThrow(
        /Failed to extract text from PDF/,
      );
    });
  });

  describe('unsupported MIME', () => {
    it('throws on unsupported MIME type', async () => {
      const buffer = Buffer.from('something');
      await expect(service.extract(buffer, 'image/png')).rejects.toThrow(
        /Unsupported MIME type for extraction: image\/png/,
      );
    });
  });
});
