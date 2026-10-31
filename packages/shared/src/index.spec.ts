import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  registerRequestSchema,
  userProfileSchema,
} from './index.js';

describe('auth schemas', () => {
  it('validates a valid register request and normalizes email', () => {
    const parsed = registerRequestSchema.parse({
      email: '  STUDENT@ExamPle.Com ',
      password: 'strong-password-123',
    });

    expect(parsed.email).toBe('student@example.com');
    expect(parsed.password).toBe('strong-password-123');
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = registerRequestSchema.safeParse({
      email: 'student@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid emails', () => {
    const result = registerRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'strong-password-123',
    });

    expect(result.success).toBe(false);
  });

  it('validates a valid login request', () => {
    const parsed = loginRequestSchema.parse({
      email: ' Student@Example.com ',
      password: 'any-password',
    });

    expect(parsed.email).toBe('student@example.com');
  });

  it('validates a refresh token request', () => {
    const parsed = refreshTokenRequestSchema.parse({
      refreshToken: 'sample-refresh-token',
    });

    expect(parsed.refreshToken).toBe('sample-refresh-token');
  });

  it('validates a user profile with valid uuid and datetime', () => {
    const profile = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'student@example.com',
      role: 'STUDENT',
      createdAt: new Date().toISOString(),
    };

    const parsed = userProfileSchema.parse(profile);
    expect(parsed.role).toBe('STUDENT');
  });

  it('validates an auth response payload', () => {
    const response = {
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'student@example.com',
        role: 'STUDENT',
        createdAt: new Date().toISOString(),
      },
    };

    const parsed = authResponseSchema.parse(response);
    expect(parsed.tokens.tokenType).toBe('Bearer');
    expect(parsed.tokens.expiresIn).toBe(900);
  });
});
