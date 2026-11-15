import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUserPayload } from '../../core/common/decorators/current-user.decorator.js';
import type { FlashcardsService } from '../ai/flashcards.service.js';
import type { SummaryService } from '../ai/summary.service.js';
import { DocumentsController } from './documents.controller.js';
import type { DocumentsService } from './documents.service.js';

describe('DocumentsController - AI endpoints', () => {
  let controller: DocumentsController;
  let documentsServiceMock: Partial<DocumentsService>;
  let summaryServiceMock: {
    summarizeDocument: ReturnType<typeof vi.fn>;
  };
  let flashcardsServiceMock: {
    generateFlashcards: ReturnType<typeof vi.fn>;
    getFlashcards: ReturnType<typeof vi.fn>;
  };

  const user: CurrentUserPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'student@example.com',
    role: 'STUDENT',
  };
  const docId = '223e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    documentsServiceMock = {};
    summaryServiceMock = {
      summarizeDocument: vi.fn(),
    };
    flashcardsServiceMock = {
      generateFlashcards: vi.fn(),
      getFlashcards: vi.fn(),
    };

    controller = new DocumentsController(
      documentsServiceMock as DocumentsService,
      summaryServiceMock as unknown as SummaryService,
      flashcardsServiceMock as unknown as FlashcardsService,
    );
  });

  it('delegates summarize request to SummaryService', async () => {
    const expectedResponse = {
      documentId: docId,
      summary: '# Summary content',
      cached: false,
    };

    summaryServiceMock.summarizeDocument.mockResolvedValue(expectedResponse);

    const result = await controller.summarize(user, docId);

    expect(summaryServiceMock.summarizeDocument).toHaveBeenCalledWith(user.userId, docId);
    expect(result).toEqual(expectedResponse);
  });

  it('delegates generateFlashcards request to FlashcardsService', async () => {
    const expectedResponse = {
      documentId: docId,
      flashcards: [
        {
          id: '323e4567-e89b-12d3-a456-426614174002',
          documentId: docId,
          front: 'What is HTTP?',
          back: 'Hypertext Transfer Protocol.',
        },
      ],
      cached: false,
    };

    flashcardsServiceMock.generateFlashcards.mockResolvedValue(expectedResponse);

    const result = await controller.generateFlashcards(user, docId, { count: 12 });

    expect(flashcardsServiceMock.generateFlashcards).toHaveBeenCalledWith(user.userId, docId, 12);
    expect(result).toEqual(expectedResponse);
  });

  it('delegates getFlashcards request to FlashcardsService', async () => {
    const expectedResponse = {
      documentId: docId,
      flashcards: [
        {
          id: '323e4567-e89b-12d3-a456-426614174002',
          documentId: docId,
          front: 'What is HTTP?',
          back: 'Hypertext Transfer Protocol.',
        },
      ],
      cached: true,
    };

    flashcardsServiceMock.getFlashcards.mockResolvedValue(expectedResponse);

    const result = await controller.getFlashcards(user, docId);

    expect(flashcardsServiceMock.getFlashcards).toHaveBeenCalledWith(user.userId, docId);
    expect(result).toEqual(expectedResponse);
  });
});
