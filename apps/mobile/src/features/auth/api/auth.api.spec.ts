import { AxiosError } from 'axios';
import { rawClient } from '../../../shared/api/client';
import {
  loginUser,
  parseAuthErrorMessage,
  registerUser,
} from './auth.api';

describe('auth.api', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    it('calls /auth/login with credentials and returns response data', async () => {
      const mockResponse = {
        tokens: {
          accessToken: 'test-access',
          refreshToken: 'test-refresh',
          tokenType: 'Bearer' as const,
          expiresIn: 900,
        },
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'STUDENT' as const,
          createdAt: new Date().toISOString(),
        },
      };

      jest.spyOn(rawClient, 'post').mockResolvedValueOnce({ data: mockResponse });

      const result = await loginUser({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(rawClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('registerUser', () => {
    it('calls /auth/register with credentials and returns response data', async () => {
      const mockResponse = {
        tokens: {
          accessToken: 'test-access',
          refreshToken: 'test-refresh',
          tokenType: 'Bearer' as const,
          expiresIn: 900,
        },
        user: {
          id: 'user-1',
          email: 'new@example.com',
          role: 'STUDENT' as const,
          createdAt: new Date().toISOString(),
        },
      };

      jest.spyOn(rawClient, 'post').mockResolvedValueOnce({ data: mockResponse });

      const result = await registerUser({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(rawClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'new@example.com',
        password: 'password123',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('parseAuthErrorMessage', () => {
    it('returns network error message when there is no response', () => {
      const error = new AxiosError('Network Error');
      error.response = undefined;

      const message = parseAuthErrorMessage(error);
      expect(message).toBe('Unable to connect to server. Please check your internet connection.');
    });

    it('returns custom message for UNAUTHORIZED error code', () => {
      const error = new AxiosError('Unauthorized');
      error.response = {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {} as any,
        data: { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      };

      const message = parseAuthErrorMessage(error);
      expect(message).toBe('Incorrect email or password. Please try again.');
    });

    it('returns custom message for RATE_LIMITED error code', () => {
      const error = new AxiosError('Too Many Requests');
      error.response = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {},
        config: {} as any,
        data: { error: { code: 'RATE_LIMITED', message: 'Throttled' } },
      };

      const message = parseAuthErrorMessage(error);
      expect(message).toBe('Too many attempts. Please try again in a few moments.');
    });

    it('returns already exists message for 409 conflict', () => {
      const error = new AxiosError('Conflict');
      error.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: { error: { code: 'CONFLICT', message: 'User already exists' } },
      };

      const message = parseAuthErrorMessage(error);
      expect(message).toBe('An account with this email already exists.');
    });

    it('returns validation message for VALIDATION_ERROR code', () => {
      const error = new AxiosError('Bad Request');
      error.response = {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: { error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' } },
      };

      const message = parseAuthErrorMessage(error);
      expect(message).toBe('Invalid email address');
    });

    it('falls back to Error.message for standard JavaScript errors', () => {
      const error = new Error('Something broke');
      expect(parseAuthErrorMessage(error)).toBe('Something broke');
    });

    it('falls back to generic message for unknown errors', () => {
      expect(parseAuthErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
    });
  });
});
