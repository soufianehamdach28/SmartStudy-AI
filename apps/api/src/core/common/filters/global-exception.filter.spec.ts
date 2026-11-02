import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { apiErrorSchema } from '@smartstudy/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue({ status: mockStatus }),
        getRequest: vi.fn().mockReturnValue({ method: 'GET', url: '/test' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats BadRequestException with validation issues correctly', () => {
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid email address',
      details: { field: 'email' },
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email address',
        details: { field: 'email' },
      },
    });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('formats standard UnauthorizedException with code UNAUTHORIZED', () => {
    const exception = new UnauthorizedException('Authentication required.');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('detects expired token in UnauthorizedException and sets code to TOKEN_EXPIRED', () => {
    const exception = new UnauthorizedException('Jwt token expired');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Jwt token expired',
      },
    });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('formats NotFoundException with code NOT_FOUND', () => {
    const exception = new NotFoundException('User account not found.');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'User account not found.',
      },
    });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('formats string-based HttpException', () => {
    const exception = new HttpException('Forbidden access', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden access',
      },
    });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('handles Prisma P2002 unique constraint violation as 409 Conflict', () => {
    const prismaError = {
      code: 'P2002',
      message: 'Unique constraint failed on the fields: (`email`)',
      meta: { target: ['email'] },
    };

    filter.catch(prismaError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const payload = mockJson.mock.calls[0][0];
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.message).toContain('Unique constraint failed on: email');
    expect(payload.error.details).toEqual({ target: ['email'] });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('handles Prisma P2025 record not found as 404 NOT_FOUND', () => {
    const prismaError = {
      code: 'P2025',
      message: 'An operation failed because it depends on one or more records that were required but not found.',
    };

    filter.catch(prismaError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });

  it('masks unhandled errors as 500 INTERNAL_ERROR without leaking stack trace', () => {
    const unhandledError = new Error('Unexpected crash in internal engine');

    filter.catch(unhandledError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = mockJson.mock.calls[0][0];
    expect(payload).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred.',
      },
    });
    expect(payload.error).not.toHaveProperty('stack');
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });
});
