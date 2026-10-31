import { z } from 'zod';

/** Base path for every API route. */
export const API_PREFIX = '/api';

/**
 * Stable error codes returned by the API. The mobile app maps these to
 * user-facing messages, so they must not change casually.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE_TYPE',
  'DOCUMENT_NOT_READY',
  'DOCUMENT_PROCESSING_FAILED',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'LLM_UNAVAILABLE',
  'LLM_INVALID_OUTPUT',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * The single error shape returned by the API for every failure:
 * `{ "error": { "code": "...", "message": "...", "details": {} } }`
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Lifecycle of an uploaded document as it goes through ingestion. */
export const documentStatusSchema = z.enum(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/** Health payload exposed by `GET /health`. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  info: z.record(z.string(), z.object({ status: z.string() })).optional(),
  error: z.record(z.string(), z.object({ status: z.string() })).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
