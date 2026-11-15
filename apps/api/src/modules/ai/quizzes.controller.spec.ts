import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUserPayload } from '../../core/common/decorators/current-user.decorator.js';
import type { QuizService } from './quiz.service.js';
import { QuizzesController } from './quizzes.controller.js';

describe('QuizzesController', () => {
  let controller: QuizzesController;
  let quizServiceMock: {
    submitAttempt: ReturnType<typeof vi.fn>;
  };

  const user: CurrentUserPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'student@example.com',
    role: 'STUDENT',
  };
  const quizId = '523e4567-e89b-12d3-a456-426614174004';

  beforeEach(() => {
    quizServiceMock = {
      submitAttempt: vi.fn(),
    };

    controller = new QuizzesController(quizServiceMock as unknown as QuizService);
  });

  it('delegates submitAttempt to QuizService', async () => {
    const expectedResponse = {
      id: 'attempt-id',
      quizId,
      userId: user.userId,
      score: 100,
      correctCount: 1,
      totalQuestions: 1,
      answers: [],
      completedAt: '2026-11-15T12:00:00.000Z',
    };

    quizServiceMock.submitAttempt.mockResolvedValue(expectedResponse);

    const result = await controller.submitAttempt(user, quizId, {
      answers: [
        {
          questionId: '623e4567-e89b-12d3-a456-426614174005',
          selectedIndex: 1,
        },
      ],
    });

    expect(quizServiceMock.submitAttempt).toHaveBeenCalledWith(user.userId, quizId, {
      answers: [
        {
          questionId: '623e4567-e89b-12d3-a456-426614174005',
          selectedIndex: 1,
        },
      ],
    });
    expect(result).toEqual(expectedResponse);
  });
});
