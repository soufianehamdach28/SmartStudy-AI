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

// ============================================================================
// AI Learning Tools Schemas (Summaries, Flashcards, Quizzes, Usage)
// ============================================================================

/** Structured summary JSON output expected from the LLM. */
export const llmSummaryOutputSchema = z.object({
  summary: z.string().min(1),
  keyTakeaways: z.array(z.string().min(1)).min(1),
});
export type LlmSummaryOutput = z.infer<typeof llmSummaryOutputSchema>;

/** Response returned by POST /api/documents/:id/summarize. */
export const documentSummaryResponseSchema = z.object({
  documentId: z.string().uuid(),
  summary: z.string().min(1),
  cached: z.boolean(),
});
export type DocumentSummaryResponse = z.infer<typeof documentSummaryResponseSchema>;

/** Request payload for POST /api/documents/:id/flashcards. */
export const generateFlashcardsRequestSchema = z.object({
  count: z.coerce.number().int().min(1).max(30).default(10),
});
export type GenerateFlashcardsRequest = z.infer<typeof generateFlashcardsRequestSchema>;

/** Individual flashcard shape expected from the LLM. */
export const llmFlashcardItemSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});
export type LlmFlashcardItem = z.infer<typeof llmFlashcardItemSchema>;

/** Structured flashcards JSON output expected from the LLM. */
export const llmFlashcardsOutputSchema = z.object({
  flashcards: z.array(llmFlashcardItemSchema).min(1),
});
export type LlmFlashcardsOutput = z.infer<typeof llmFlashcardsOutputSchema>;

/** Flashcard representation stored in DB and returned over the wire. */
export const flashcardSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  front: z.string().min(1),
  back: z.string().min(1),
});
export type Flashcard = z.infer<typeof flashcardSchema>;

/** Response returned by POST /api/documents/:id/flashcards. */
export const flashcardsResponseSchema = z.object({
  documentId: z.string().uuid(),
  flashcards: z.array(flashcardSchema),
});
export type FlashcardsResponse = z.infer<typeof flashcardsResponseSchema>;

/** Request payload for POST /api/documents/:id/quizzes. */
export const generateQuizRequestSchema = z.object({
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  title: z.string().trim().min(1).max(120).optional(),
});
export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;

/** Individual quiz question shape expected from the LLM. */
export const llmQuizQuestionItemSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        prompt: obj.prompt ?? obj.question,
      };
    }
    return val;
  },
  z.object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(1),
    sourceChunkId: z.string().uuid().nullable().optional(),
  }),
);
export type LlmQuizQuestionItem = z.infer<typeof llmQuizQuestionItemSchema>;

/** Structured quiz JSON output expected from the LLM. */
export const llmQuizOutputSchema = z.preprocess(
  (val: unknown) => {
    if (Array.isArray(val)) {
      return {
        title: 'Quiz',
        questions: val,
      };
    }
    return val;
  },
  z.object({
    title: z.string().min(1),
    questions: z.array(llmQuizQuestionItemSchema).min(1),
  }),
);
export type LlmQuizOutput = z.infer<typeof llmQuizOutputSchema>;

/** Quiz question representation returned over the wire. */
export const quizQuestionSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  sourceChunkId: z.string().uuid().nullable().optional(),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

/** Full quiz representation returned by POST /api/documents/:id/quizzes. */
export const quizResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  questions: z.array(quizQuestionSchema).min(1),
});
export type QuizResponse = z.infer<typeof quizResponseSchema>;

/** Single answer entry submitted in a quiz attempt. */
export const quizAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(3),
});
export type QuizAnswerInput = z.infer<typeof quizAnswerInputSchema>;

/** Request payload for POST /api/quizzes/:id/attempts. */
export const submitQuizAttemptRequestSchema = z.object({
  answers: z.array(quizAnswerInputSchema).min(1),
});
export type SubmitQuizAttemptRequest = z.infer<typeof submitQuizAttemptRequestSchema>;

/** Graded answer breakdown for a single quiz question. */
export const quizAnswerResultSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(3),
  correctIndex: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  explanation: z.string().min(1),
});
export type QuizAnswerResult = z.infer<typeof quizAnswerResultSchema>;

/** Response returned by POST /api/quizzes/:id/attempts. */
export const quizAttemptResponseSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  userId: z.string().uuid(),
  score: z.number().min(0).max(100),
  correctCount: z.number().int().nonnegative(),
  totalQuestions: z.number().int().positive(),
  answers: z.array(quizAnswerResultSchema).min(1),
  completedAt: z.string().datetime(),
});
export type QuizAttemptResponse = z.infer<typeof quizAttemptResponseSchema>;

/** Kinds of tracked AI usage operations. */
export const USAGE_KINDS = ['SUMMARY', 'FLASHCARDS', 'QUIZ', 'CHAT'] as const;
export const usageKindSchema = z.enum(USAGE_KINDS);
export type UsageKind = z.infer<typeof usageKindSchema>;

/** Response returned by GET /api/usage. */
export const usageQuotaResponseSchema = z.object({
  dailyLimit: z.number().int().nonnegative(),
  dailyUsed: z.number().int().nonnegative(),
  dailyRemaining: z.number().int().nonnegative(),
  monthlyLimit: z.number().int().nonnegative(),
  monthlyUsed: z.number().int().nonnegative(),
  monthlyRemaining: z.number().int().nonnegative(),
});
export type UsageQuotaResponse = z.infer<typeof usageQuotaResponseSchema>;

// ─── Chat, Conversations & Citations ────────────────────────────────────────

/** Roles in a document conversation. */
export const MESSAGE_ROLES = ['USER', 'ASSISTANT'] as const;
export const messageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof messageRoleSchema>;

/** Source citation referencing a real document chunk and page. */
export const citationSchema = z.object({
  chunkId: z.string().uuid(),
  page: z.number().int().positive(),
  excerpt: z.string().min(1),
});
export type Citation = z.infer<typeof citationSchema>;

/** Individual chat message representation returned over the wire. */
export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: messageRoleSchema,
  content: z.string().min(1),
  citations: z.array(citationSchema).default([]),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof messageSchema>;

/** Structured chat JSON output expected from the LLM. */
export const llmChatOutputSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(citationSchema).default([]),
});
export type LlmChatOutput = z.infer<typeof llmChatOutputSchema>;

/** Conversation summary item representation. */
export const conversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  documentId: z.string().uuid(),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof conversationSchema>;

/** Conversation with its full ordered message history. */
export const conversationDetailResponseSchema = conversationSchema.extend({
  messages: z.array(messageSchema),
});
export type ConversationDetailResponse = z.infer<typeof conversationDetailResponseSchema>;

/** Request payload for POST /api/conversations. */
export const createConversationRequestSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
});
export type CreateConversationRequest = z.infer<typeof createConversationRequestSchema>;

/** Request payload for POST /api/conversations/:id/messages. */
export const sendMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

/** Response returned by POST /api/conversations/:id/messages. */
export const sendMessageResponseSchema = z.object({
  userMessage: messageSchema,
  assistantMessage: messageSchema,
});
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

/** Query parameters for GET /api/conversations. */
export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  documentId: z.string().uuid().optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

/** Paginated list of conversations returned by GET /api/conversations. */
export const paginatedConversationsResponseSchema = z.object({
  items: z.array(conversationSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type PaginatedConversationsResponse = z.infer<
  typeof paginatedConversationsResponseSchema
>;
