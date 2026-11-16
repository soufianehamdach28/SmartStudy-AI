import { AxiosError } from 'axios';
import {
  fetchQuizzes,
  generateQuiz,
  parseQuizErrorMessage,
  submitQuizAttempt,
} from './quiz.api';
import { apiClient } from '../../../shared/api/client';

jest.mock('../../../shared/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('quiz.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchQuizzes', () => {
    it('calls GET /documents/:id/quizzes and returns quizzes array', async () => {
      const mockQuizzes = [
        {
          id: 'quiz-1',
          documentId: 'doc-1',
          title: 'Physics Quiz',
          createdAt: '2026-11-16T00:00:00.000Z',
          questions: [],
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockQuizzes });

      const result = await fetchQuizzes('doc-1');

      expect(apiClient.get).toHaveBeenCalledWith('/documents/doc-1/quizzes');
      expect(result).toEqual(mockQuizzes);
    });
  });

  describe('generateQuiz', () => {
    it('calls POST /documents/:id/quizzes with questionCount', async () => {
      const mockQuiz = {
        id: 'quiz-1',
        documentId: 'doc-1',
        title: 'Physics Quiz',
        createdAt: '2026-11-16T00:00:00.000Z',
        questions: [],
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockQuiz });

      const result = await generateQuiz('doc-1', 7);

      expect(apiClient.post).toHaveBeenCalledWith('/documents/doc-1/quizzes', {
        questionCount: 7,
      });
      expect(result).toEqual(mockQuiz);
    });
  });

  describe('submitQuizAttempt', () => {
    it('calls POST /quizzes/:id/attempts with submitted answers', async () => {
      const mockAttempt = {
        id: 'attempt-1',
        quizId: 'quiz-1',
        userId: 'user-1',
        score: 100,
        correctCount: 2,
        totalQuestions: 2,
        answers: [],
        completedAt: '2026-11-16T00:00:00.000Z',
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockAttempt });

      const payload = {
        answers: [{ questionId: 'q-1', selectedIndex: 2 }],
      };

      const result = await submitQuizAttempt('quiz-1', payload);

      expect(apiClient.post).toHaveBeenCalledWith('/quizzes/quiz-1/attempts', payload);
      expect(result).toEqual(mockAttempt);
    });
  });

  describe('parseQuizErrorMessage', () => {
    function createAxiosError(status: number, data?: unknown): AxiosError {
      const error = new AxiosError('Request failed');
      error.response = {
        status,
        statusText: 'Error',
        headers: {},
        config: {} as any,
        data,
      };
      return error;
    }

    it('translates QUOTA_EXCEEDED error code', () => {
      const error = createAxiosError(429, {
        error: { code: 'QUOTA_EXCEEDED' },
      });
      expect(parseQuizErrorMessage(error)).toBe(
        'Daily AI request quota reached. Please try again tomorrow.',
      );
    });

    it('translates network error without response', () => {
      const error = new AxiosError('Network Error');
      expect(parseQuizErrorMessage(error)).toBe(
        'Unable to connect to the server. Please check your internet connection.',
      );
    });
  });
});
