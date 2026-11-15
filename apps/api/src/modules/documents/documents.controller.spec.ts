import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUserPayload } from '../../core/common/decorators/current-user.decorator.js';
import type { FlashcardsService } from '../ai/flashcards.service.js';
import type { QuizService } from '../ai/quiz.service.js';
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
  let quizServiceMock: {
    generateQuiz: ReturnType<typeof vi.fn>;
    getDocumentQuizzes: ReturnType<typeof vi.fn>;
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
    quizServiceMock = {
      generateQuiz: vi.fn(),
      getDocumentQuizzes: vi.fn(),
    };

    controller = new DocumentsController(
      documentsServiceMock as DocumentsService,
      summaryServiceMock as unknown as SummaryService,
      flashcardsServiceMock as unknown as FlashcardsService,
      quizServiceMock as unknown as QuizService,
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

  it('delegates generateQuiz request to QuizService', async () => {
    const expectedResponse = {
      id: 'quiz-123',
      documentId: docId,
      title: 'Biology Quiz',
      createdAt: '2026-11-15T12:00:00.000Z',
      questions: [],
    };

    quizServiceMock.generateQuiz.mockResolvedValue(expectedResponse);

    const result = await controller.generateQuiz(user, docId, { questionCount: 5 });

    expect(quizServiceMock.generateQuiz).toHaveBeenCalledWith(user.userId, docId, { questionCount: 5 });
    expect(result).toEqual(expectedResponse);
  });

  it('delegates getQuizzes request to QuizService', async () => {
    const expectedResponse = [
      {
        id: 'quiz-123',
        documentId: docId,
        title: 'Biology Quiz',
        createdAt: '2026-11-15T12:00:00.000Z',
        questions: [],
      },
    ];

    quizServiceMock.getDocumentQuizzes.mockResolvedValue(expectedResponse);

    const result = await controller.getQuizzes(user, docId);

    expect(quizServiceMock.getDocumentQuizzes).toHaveBeenCalledWith(user.userId, docId);
    expect(result).toEqual(expectedResponse);
  });
});
