import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  documentChunkSchema,
  documentExtensionSchema,
  documentListQuerySchema,
  documentMimeTypeSchema,
  documentResponseSchema,
  documentUploadResponseSchema,
  loginRequestSchema,
  paginatedDocumentsResponseSchema,
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

describe('document schemas', () => {
  const validDoc = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Intro to Computer Science',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 500,
    status: 'UPLOADED' as const,
    errorMessage: null,
    pageCount: 12,
    summary: null,
    createdAt: new Date().toISOString(),
  };

  it('validates a valid document response', () => {
    const parsed = documentResponseSchema.parse(validDoc);
    expect(parsed.id).toBe(validDoc.id);
    expect(parsed.status).toBe('UPLOADED');
    expect(parsed.pageCount).toBe(12);
  });

  it('rejects an invalid document status', () => {
    const result = documentResponseSchema.safeParse({
      ...validDoc,
      status: 'NOT_A_REAL_STATUS',
    });
    expect(result.success).toBe(false);
  });

  it('validates document upload response (202 Accepted)', () => {
    const uploadRes = {
      document: validDoc,
      message: 'Document uploaded successfully and queued for ingestion',
    };
    const parsed = documentUploadResponseSchema.parse(uploadRes);
    expect(parsed.document.title).toBe(validDoc.title);
  });

  it('validates documentListQuerySchema and applies default page and limit', () => {
    const parsed = documentListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
  });

  it('coerces string query parameters to numbers', () => {
    const parsed = documentListQuerySchema.parse({ page: '2', limit: '25' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it('rejects query limits over 50', () => {
    const result = documentListQuerySchema.safeParse({ limit: 51 });
    expect(result.success).toBe(false);
  });

  it('validates paginated documents response', () => {
    const paginated = {
      items: [validDoc],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    const parsed = paginatedDocumentsResponseSchema.parse(paginated);
    expect(parsed.items.length).toBe(1);
    expect(parsed.total).toBe(1);
  });

  it('validates allowed document mime types and rejects unsupported ones', () => {
    expect(documentMimeTypeSchema.safeParse('application/pdf').success).toBe(true);
    expect(documentMimeTypeSchema.safeParse('text/plain').success).toBe(true);
    expect(documentMimeTypeSchema.safeParse('image/png').success).toBe(false);
    expect(documentMimeTypeSchema.safeParse('application/msword').success).toBe(false);
  });

  it('validates allowed document extensions', () => {
    expect(documentExtensionSchema.safeParse('.pdf').success).toBe(true);
    expect(documentExtensionSchema.safeParse('.txt').success).toBe(true);
    expect(documentExtensionSchema.safeParse('.docx').success).toBe(false);
  });

  it('validates a document chunk schema', () => {
    const chunk = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      documentId: '223e4567-e89b-12d3-a456-426614174001',
      index: 0,
      page: 1,
      text: 'First chunk of course document text',
      charStart: 0,
      charEnd: 35,
    };
    const parsed = documentChunkSchema.parse(chunk);
    expect(parsed.index).toBe(0);
    expect(parsed.page).toBe(1);
    expect(parsed.charStart).toBe(0);
    expect(parsed.charEnd).toBe(35);
  });
});
