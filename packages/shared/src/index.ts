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

/** Maximum upload size for a course document (10 MB). */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum pages allowed in a single PDF document. */
export const MAX_DOCUMENT_PAGES = 300;

/** Allowed MIME types for uploaded documents. */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
] as const;

export const documentMimeTypeSchema = z.enum(ALLOWED_DOCUMENT_MIME_TYPES);
export type DocumentMimeType = z.infer<typeof documentMimeTypeSchema>;

/** Allowed file extensions. */
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.txt'] as const;
export const documentExtensionSchema = z.enum(ALLOWED_DOCUMENT_EXTENSIONS);
export type DocumentExtension = z.infer<typeof documentExtensionSchema>;

/** Lifecycle of an uploaded document as it goes through ingestion. */
export const DOCUMENT_STATUSES = ['UPLOADED', 'PROCESSING', 'READY', 'FAILED'] as const;
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/** Document representation returned over the wire. */
export const documentResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  title: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: documentStatusSchema,
  errorMessage: z.string().nullable().optional(),
  pageCount: z.number().int().nonnegative().nullable().optional(),
  summary: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

/** Response returned by POST /api/documents (HTTP 202 Accepted). */
export const documentUploadResponseSchema = z.object({
  document: documentResponseSchema,
  message: z.string().optional(),
});
export type DocumentUploadResponse = z.infer<typeof documentUploadResponseSchema>;

/** Query parameters for GET /api/documents. */
export const documentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

/** Paginated documents response shape. */
export const paginatedDocumentsResponseSchema = z.object({
  items: z.array(documentResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type PaginatedDocumentsResponse = z.infer<typeof paginatedDocumentsResponseSchema>;

/** Document chunk representation for ingestion and retrieval. */
export const documentChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  text: z.string().min(1),
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().positive(),
});
export type DocumentChunk = z.infer<typeof documentChunkSchema>;

/** Health payload exposed by `GET /health`. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  info: z.record(z.string(), z.object({ status: z.string() })).optional(),
  error: z.record(z.string(), z.object({ status: z.string() })).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** User system roles. */
export const USER_ROLES = ['STUDENT', 'ADMIN'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Public user profile (safe to return over the wire). */
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  createdAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/** Register payload. */
export const registerRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password is too long'),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** Login payload. */
export const loginRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Refresh token payload. */
export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

/** Issued tokens shape. */
export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Complete auth response returned on register, login, and refresh. */
export const authResponseSchema = z.object({
  tokens: authTokensSchema,
  user: userProfileSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
