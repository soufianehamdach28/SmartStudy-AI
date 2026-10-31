# Project Implementation Plan & Commit Roadmap

> **SmartStudy AI** — Step-by-step granular task list and commit sequence.  
> Every commit is a self-contained, testable increment that leaves the repository in a working state.

---

## Commit Guidelines
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Before each commit: run `npm run typecheck` and `npm test`.
- Check off tasks (`[x]`) as they are completed.

---

## Phase 1: Authentication & User Accounts

- [x] **Commit 01: `feat(shared): add auth contracts, zod schemas and error codes`**
  - Define user roles enum (`STUDENT`, `ADMIN`).
  - Add Zod schemas: register, login, refresh payload, auth response, and user profile DTOs.
  - Add standardized error codes enum (`VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_EXPIRED`, etc.).

- [x] **Commit 02: `feat(api): define User and RefreshToken models in Prisma schema`**
  - Add `User` (id, email, passwordHash, role, createdAt).
  - Add `RefreshToken` (id, userId, tokenHash, expiresAt, revokedAt, replacedById).
  - Create and apply initial database migration to PostgreSQL.

- [ ] **Commit 03: `feat(api): add password hashing service with argon2`**
  - Implement `PasswordService` with `hash()` and `verify()` using `argon2`.
  - Add unit tests verifying secure hashing and rejection of incorrect passwords.

- [ ] **Commit 04: `feat(api): implement JWT token service and refresh token rotation`**
  - Configure `@nestjs/jwt` with short-lived access token (15m) and refresh token (30d).
  - Implement token generation, hashing, and rotation with reuse detection.
  - Add unit tests for token rotation and revoked token detection.

- [ ] **Commit 05: `feat(api): implement auth endpoints (register, login, refresh, logout)`**
  - Create `AuthModule`, `AuthController`, and `AuthService`.
  - Implement `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
  - Integration tests for registration, valid login, invalid login, and logout.

- [ ] **Commit 06: `feat(api): add JwtAuthGuard and current user endpoint GET /api/me`**
  - Implement Passport JWT strategy and `@UseGuards(JwtAuthGuard)`.
  - Add `@CurrentUser()` parameter decorator.
  - Implement `GET /api/me` returning current user profile.
  - Integration tests verifying protected routes reject unauthorized requests.

- [ ] **Commit 07: `feat(api): add global exception filter with standardized error format`**
  - Implement NestJS exception filter mapping all exceptions to `{ error: { code, message, details } }`.
  - Map Prisma errors, Zod validation errors, and HTTP exceptions to stable codes.
  - Tests checking that errors always match the required format.

- [ ] **Commit 08: `feat(mobile): add secure token storage with react-native-keychain`**
  - Implement token storage utility (`getAccessToken`, `getRefreshToken`, `saveTokens`, `clearTokens`).
  - Store tokens securely in Keychain (iOS) / Keystore (Android).

- [ ] **Commit 09: `feat(mobile): add axios client with automatic token refresh interceptor`**
  - Configure Axios base instance pointing to `API_BASE_URL`.
  - Implement request interceptor injecting JWT Bearer token.
  - Implement response interceptor: on 401 `TOKEN_EXPIRED`, queue failed requests, refresh token once, and retry.
  - On refresh failure: clear tokens and redirect to login.

- [ ] **Commit 10: `feat(mobile): add auth Zustand store and root navigation flow`**
  - Create `useAuthStore` managing user state and loading initial session on app launch.
  - Setup React Navigation switching between `AuthStack` (Login/Register) and `AppStack` (Main screens).

- [ ] **Commit 11: `feat(mobile): implement Login and Register UI screens`**
  - Build Login and Register screens in `apps/mobile/src/features/auth/`.
  - Form validation with `react-hook-form` + `@hookform/resolvers/zod`.
  - Add loading indicators, error banners, and keyboard handling.

---

## Phase 2: Document Management & Asynchronous Processing

- [ ] **Commit 12: `feat(shared): add document DTOs, status enum and upload contracts`**
  - Define `DocumentStatus` enum (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`).
  - Add Zod schemas for document response, upload response, pagination query, and detail view.

- [ ] **Commit 13: `feat(api): add Document and DocumentChunk Prisma models`**
  - Add `Document` (id, userId, title, mimeType, sizeBytes, storageKey, status, errorMessage, pageCount, summary, createdAt).
  - Add `DocumentChunk` (id, documentId, index, page, text, charStart, charEnd, tsv).
  - Add cascade delete relation and database migration.

- [ ] **Commit 14: `feat(api): add S3 storage service for SeaweedFS/R2`**
  - Implement `StorageService` using `@aws-sdk/client-s3`.
  - Methods: `uploadFile()`, `downloadStream()`, `deleteFile()`.
  - Add unit/integration tests with SeaweedFS container.

- [ ] **Commit 15: `feat(api): implement multipart document upload endpoint (POST /api/documents)`**
  - Multer setup for PDF and TXT.
  - Validate file size (max 10MB) and verify magic bytes with `file-type`.
  - Store file in S3, create `Document` record (`UPLOADED`), and return `202 Accepted`.
  - Tests verifying file rejection for wrong extension, wrong magic bytes, and oversize files.

- [ ] **Commit 16: `feat(api): add BullMQ queue and Redis connection for document processing`**
  - Setup `@nestjs/bullmq` with Redis (host port 6380).
  - Define `document-processing` queue and job payloads.
  - Enqueue ingestion job right after file upload in `DocumentsService`.

- [ ] **Commit 17: `feat(api): implement text extraction and chunking worker`**
  - Build queue processor: download file from S3, extract text per page (`unpdf`/`pdfjs-dist`).
  - Implement token-aware sliding window chunking (~500–800 tokens, keep page and char offsets).
  - Save `DocumentChunk` records in a single database transaction.
  - Update `Document` status to `READY` (or `FAILED` with error message).

- [ ] **Commit 18: `feat(api): implement document list, detail and cascade delete endpoints`**
  - Implement `GET /api/documents` with cursor/offset pagination.
  - Implement `GET /api/documents/:id` checking user ownership (return 404 for IDOR).
  - Implement `DELETE /api/documents/:id` cascading deletion of DB chunks and original S3 file.
  - Tests ensuring User A cannot read or delete User B's documents (returns 404).

- [ ] **Commit 19: `feat(mobile): add document picker and upload hook with progress`**
  - Integrate `@react-native-documents/picker` for selecting PDF/TXT.
  - Implement file upload mutation with progress tracking (`react-native-blob-util`).

- [ ] **Commit 20: `feat(mobile): implement document list screen with status polling`**
  - Build `DocumentsListScreen` using `@shopify/flash-list`.
  - Handle all UI states: Loading, Empty ("No courses yet"), Error with retry.
  - Poll document status every 2-3s with backoff while in `PROCESSING` state until `READY`/`FAILED`.

- [ ] **Commit 21: `feat(mobile): implement document detail and delete action`**
  - Detail screen showing metadata, page count, and status badge.
  - Delete document dialog with confirmation and optimistic list update.

---

## Phase 3: AI Learning Tools (Summaries, Flashcards, Quizzes)

- [ ] **Commit 22: `feat(shared): add AI schemas for summary, flashcards and quiz structures`**
  - Zod schemas for Flashcard (`front`, `back`).
  - Zod schemas for Quiz (`title`, questions with `prompt`, `options`, `correctIndex`, `explanation`).
  - Zod schemas for QuizAttempt submission and scoring result.

- [ ] **Commit 23: `feat(api): add Flashcard, Quiz, QuizQuestion and QuizAttempt Prisma models`**
  - Add Prisma entities, relations to `Document`, and cascade deletion.
  - Run database migration.

- [ ] **Commit 24: `feat(api): implement LlmClient interface and MockLlmClient`**
  - Define `LlmClient` interface: `generateText()` and `generateJson()`.
  - Build `MockLlmClient` returning predictable test fixtures.
  - Implement JSON validation with Zod and automatic single retry on schema violation.

- [ ] **Commit 25: `feat(api): implement Ollama driver for local development`**
  - Build Ollama client (`http://localhost:11434/v1`).
  - Support model selection (`llama3.2`, `qwen`) and timeout handling.

- [ ] **Commit 26: `feat(api): implement Gemini and Groq fallback LLM drivers`**
  - Build Gemini Flash driver and Groq driver.
  - Implement provider fallback logic: on 429/timeout/5xx, switch sequentially to next provider.

- [ ] **Commit 27: `feat(api): add UsageRecord tracking and quota checking service`**
  - Add `UsageRecord` model (userId, tokensIn, tokensOut, provider, latencyMs).
  - Implement `QuotaService`: check daily/monthly AI request limits before running LLM tasks.
  - Add `GET /api/usage` endpoint.

- [ ] **Commit 28: `feat(api): implement document summary generation endpoint`**
  - `POST /api/documents/:id/summarize`.
  - Generate structured course summary and cache in `Document.summary`.
  - Return cached summary on subsequent requests without re-calling LLM.

- [ ] **Commit 29: `feat(api): implement flashcards generation endpoint`**
  - `POST /api/documents/:id/flashcards`.
  - Select key chunks, generate flashcard pairs, save to database.
  - Return saved flashcards list.

- [ ] **Commit 30: `feat(api): implement quiz generation and quiz attempt scoring endpoints`**
  - `POST /api/documents/:id/quizzes`: generate multi-choice questions with source chunk references.
  - `POST /api/quizzes/:id/attempts`: submit answers, evaluate score, save `QuizAttempt`.

- [ ] **Commit 31: `feat(mobile): implement Document Summary view with AI disclaimer`**
  - Markdown summary screen in `apps/mobile/src/features/documents/`.
  - Prominent disclaimer header: *"AI answers may be incorrect."*
  - Re-fetch and copy-to-clipboard options.

- [ ] **Commit 32: `feat(mobile): implement interactive Flashcards swipe screen`**
  - Flashcard viewer screen with tap-to-flip animation (`react-native-reanimated`).
  - Progress indicator (e.g. Card 3 of 10).

- [ ] **Commit 33: `feat(mobile): implement Quiz screen and Score Review modal`**
  - Interactive multi-choice question screen.
  - Option selection, immediate submission, and result breakdown with explanations.

---

## Phase 4: Grounded Chat with Citations

- [ ] **Commit 34: `feat(shared): add conversation and message schemas with citation types`**
  - Citation shape: `{ chunkId: string, page: number, excerpt: string }`.
  - Message shape: `{ id, role, content, citations, createdAt }`.
  - Zod schemas for creating conversation and sending messages.

- [ ] **Commit 35: `feat(api): add Conversation and Message Prisma models with GIN full-text index`**
  - Define `Conversation` and `Message`.
  - Configure PostgreSQL GIN index on `DocumentChunk.tsv` for fast text search.
  - Migration script applying full-text search triggers.

- [ ] **Commit 36: `feat(api): implement full-text search retriever for document chunks`**
  - Implement `Retriever` interface querying PostgreSQL full-text search.
  - Rank top 3–5 relevant chunks by relevance score.

- [ ] **Commit 37: `feat(api): implement chat prompt engineering with injection defenses`**
  - Build prompt builder isolating untrusted document content in clear delimiters.
  - Instruct LLM to output page citations referencing only provided chunks.
  - Validate citation IDs against retrieved chunk IDs.

- [ ] **Commit 38: `feat(api): implement conversation management and chat message endpoints`**
  - `POST /api/conversations`: create chat session for a document.
  - `GET /api/conversations`: list user's conversation history.
  - `POST /api/conversations/:id/messages`: send question, retrieve context, call LLM, return answer + citations.

- [ ] **Commit 39: `feat(mobile): implement Chat screen with FlashList and input bar`**
  - Build chat UI with `@shopify/flash-list`.
  - Message bubbles for user and assistant with markdown formatting (`react-native-markdown-display`).
  - Auto-scrolling to bottom on new message.

- [ ] **Commit 40: `feat(mobile): implement interactive citation pills and source excerpt modal`**
  - Parse citation references in assistant answers as clickable pills (e.g., `[Page 4]`).
  - Modal displaying the exact excerpt and page from the original document.

- [ ] **Commit 41: `feat(mobile): add conversation history drawer and favorites`**
  - Screen or drawer listing previous conversations per document.
  - Ability to favorite flashcards or conversations.

---

## Phase 5: Hardening, Security, Polish & Delivery

- [ ] **Commit 42: `feat(api): add rate limiting per IP and user with @nestjs/throttler`**
  - Configure throttler guard across public and sensitive endpoints.
  - Return standardized `RATE_LIMITED` error code on limit breach.

- [ ] **Commit 43: `feat(api): add OpenAPI Swagger documentation and health endpoints check`**
  - Decorate all controllers with `@nestjs/swagger`.
  - Mount Swagger docs at `/api/docs`.
  - Verify `/health/live` and `/health/ready` probe outputs.

- [ ] **Commit 44: `feat(mobile): add network status banner and offline state handling`**
  - Integrate `@react-native-community/netinfo`.
  - Global banner showing "No internet connection" when offline.
  - Disable action buttons and show cached content where appropriate.

- [ ] **Commit 45: `test(api): add end-to-end integration tests for full document lifecycle`**
  - Testcontainer integration test: Register → Upload PDF → Process → Summarize → Quiz → Delete.
  - Verify cascade deletion cleans all chunks, questions, and storage.

- [ ] **Commit 46: `chore: prepare Dockerfile, production compose and deployment config`**
  - Multi-stage Dockerfile for NestJS API.
  - Production docker-compose / hosting setup (Render, Fly.io, or Railway).

- [ ] **Commit 47: `docs: complete README with architecture diagrams, API specs and screenshots`**
  - Detailed installation guide, architecture diagram, environment variables table.
  - Curl request examples and demo screenshots.
