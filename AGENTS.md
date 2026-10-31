# AGENTS.md — SmartStudy AI

> Instructions for the AI coding agent working on this repository.
> Read this file fully before doing anything. If something here conflicts with a user request, ask before deviating.
> You can rename this file to `CLAUDE.md`, `.cursorrules`, or similar if your tool expects another name.

---

## 1. Project summary

**SmartStudy AI** is a mobile learning assistant. A student imports a course (PDF or TXT), then the AI helps them study it:

- summarize the document,
- generate flashcards and quizzes,
- answer questions about the document in a chat, with **citations** (page or excerpt),
- keep history, favorites and quiz results.

**This is a portfolio project.** The goal is to prove the builder can deliver a complete, professional application: mobile app, API, database, async processing, AI integration, tests and deployment. Quality, security and clarity matter more than the number of features.

**The builder is learning.** Explain new concepts briefly when you introduce them (what it is, why we use it). Never dump a large amount of unexplained code.

The original specification (in French) defines the MVP. This file is the working reference for all technical decisions.

---

## 2. How you must work (rules of engagement)

1. **Propose before coding** when starting a new step or a new module: outline the plan (files, entities, endpoints), then **wait for validation**.
2. **Small, testable steps.** Each change should leave the project in a working state. One feature or one module at a time.
3. **Explain, then implement.** Give a short explanation of the approach, then the code. Mention which files you create or modify.
4. **Never invent package APIs.** If unsure about a library's current API or version, say so and check its documentation. Prefer well-maintained packages.
5. **Write tests with the feature**, not afterwards (see section 12).
6. **No secrets in the repo or the mobile app.** Ever. Only `.env.example` with placeholder values.
7. **Do not add features outside the MVP** (see section 16) without asking.
8. **Ask when a decision is ambiguous**, with a recommended default. Ask one question at a time.
9. **Keep the "Current status" section (section 15) up to date** after finishing a step.
10. **Be honest about limits.** If something is a trade-off, a shortcut, or not production-ready, say it.
11. Respond in the language the builder uses (currently English). Code, comments, commit messages and documentation are in **English**.

---

## 3. Decisions already made

| Topic | Decision | Reason |
|---|---|---|
| Mobile | **React Native CLI** (not Expo) + TypeScript | Builder's choice: full native control and learning the native side |
| Backend | **NestJS** + TypeScript | Same language as mobile, modular structure, scalable, shared schemas |
| Database | **PostgreSQL** + **Prisma** | Relational data, migrations, type safety |
| Queue | **BullMQ + Redis** | Standard with NestJS, scales with separate workers |
| Storage | **S3-compatible** (SeaweedFS local, Cloudflare R2 in prod) | Portable, cheap; MinIO's official images are no longer publicly distributed |
| Validation | **Zod**, shared between mobile and API | One source of truth for types |
| Auth | **JWT access + rotating refresh tokens**, `argon2` hashing | Standard, secure |
| LLM | **Free providers** behind our own `LlmClient` interface | Builder has no budget for paid APIs |
| Retrieval | **PostgreSQL full-text search** first, pgvector later (optional) | Fewer AI calls, simpler |
| Package manager | **npm** workspaces (monorepo) | Builder's choice: ships with Node, nothing extra to install |
| Admin | `role` field in DB only, **no admin screens** in MVP | Spec lists the role but defines no admin feature |

Why not Expo: it is a valid choice, but the builder chose React Native CLI. Keep almost all code in `src/` independent of native specifics so migrating later stays cheap.

---

## 4. Tech stack

### 4.1 Mobile (`apps/mobile`) — React Native CLI + TypeScript

| Need | Package |
|---|---|
| Navigation | `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context` |
| Server state (cache, retries, polling) | `@tanstack/react-query` |
| Light global state | `zustand` |
| HTTP | `axios` (interceptors for auth + refresh) |
| Forms + validation | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Secure token storage | `react-native-keychain` |
| Fast local storage | `react-native-mmkv` (non-sensitive data only) |
| File picking | `@react-native-documents/picker` (successor of `react-native-document-picker`; verify current docs) |
| Upload with progress | `react-native-blob-util` |
| Network status | `@react-native-community/netinfo` |
| Gestures / animation | `react-native-gesture-handler`, `react-native-reanimated` |
| Long lists | `@shopify/flash-list` |
| Markdown in chat | `react-native-markdown-display` |
| Icons | `react-native-svg` / `react-native-vector-icons` |
| Tests | `jest`, `@testing-library/react-native`, Maestro (E2E, later) |
| Quality | ESLint, Prettier, Husky, lint-staged |

### 4.2 Backend (`apps/api`) — NestJS + TypeScript

| Need | Package |
|---|---|
| Framework | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config` |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `argon2` |
| Validation | `zod` + `nestjs-zod` |
| Database | `prisma`, `@prisma/client` |
| Storage | `@aws-sdk/client-s3` |
| Upload | `multer`, `file-type` (magic-byte detection) |
| PDF extraction | `unpdf` or `pdfjs-dist` (page-aware) |
| Queue | `@nestjs/bullmq`, `bullmq`, `ioredis` |
| Rate limiting | `@nestjs/throttler` |
| Security headers | `helmet` |
| API docs | `@nestjs/swagger` (OpenAPI) |
| Logging | `nestjs-pino` |
| Health | `@nestjs/terminus` |
| Tests | `vitest`, `supertest`, `testcontainers` (Nest 12 scaffolds Vitest instead of Jest) |

### 4.3 Shared (`packages/shared`)

Zod schemas and inferred TypeScript types used by both apps (auth payloads, document DTOs, error format, quiz shapes, enums).

### 4.4 Infrastructure and tooling

- **Local:** Docker Compose with Postgres (pgvector image), Redis, SeaweedFS (S3-compatible).
- **Hosting (later):** API on Railway / Render / Fly.io (Docker), DB on Neon or Supabase, storage on Cloudflare R2, Redis on Upstash.
- **CI/CD:** GitHub Actions (lint, type-check, test, build).
- **Monitoring:** Sentry (mobile + API).
- **Distribution:** Firebase App Distribution / Play Internal Testing / TestFlight.
- **Dev tools:** Node LTS (includes npm), Git, Android Studio, JDK, Watchman, Xcode + CocoaPods (macOS only), Postman or Bruno.

---

## 5. Repository structure

```
smartstudy/
├── apps/
│   ├── mobile/
│   │   ├── android/  ios/               # native projects (RN CLI)
│   │   ├── index.js  metro.config.js  babel.config.js
│   │   └── src/
│   │       ├── app/                     # root component, navigation, providers
│   │       ├── shared/                  # truly shared code
│   │       │   ├── api/                 # axios client, interceptors
│   │       │   ├── components/          # shared UI kit & state views (Loading/Empty/Error)
│   │       │   ├── lib/                 # config, storage, helpers
│   │       │   └── theme/               # styles, colors, typography
│   │       ├── features/                # self-contained feature folders
│   │       │   ├── auth/                # screens, hooks, components, store
│   │       │   ├── documents/
│   │       │   ├── chat/
│   │       │   └── quiz/
│   │       └── __tests__/
│   └── api/
│       ├── prisma/                      # schema.prisma, migrations, seed
│       ├── test/                        # integration / e2e tests
│       └── src/
│           ├── main.ts  app.module.ts
│           ├── core/                    # shared core: config, prisma, common guards/filters
│           │   ├── config/              # env validation (zod)
│           │   ├── prisma/              # prisma service and module
│           │   └── common/              # guards, filters, interceptors
│           └── modules/                 # cohesive business modules
│               ├── health/              # liveness & readiness checks
│               ├── auth/                # registration, login, refresh, users
│               ├── documents/           # upload, storage, chunking/ingestion, detail, delete
│               ├── ai/                  # summaries, flashcards, quizzes & chat retrieval
│               └── usage/               # quotas and usage records
├── packages/
│   └── shared/                          # zod schemas + types
├── docker-compose.yml
├── .github/workflows/
├── .env.example
├── AGENTS.md
└── README.md
```

**Backend module layout** (every module): `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/`, `<name>.service.spec.ts`. Controllers stay thin (parse, call service, return); business logic lives in services.

**Mobile feature layout:** each folder in `features/` owns its own screens, hooks (React Query), components and local state. Reusable cross-feature UI and utilities live in `shared/`.

---

## 6. Architecture and main flow

```
Mobile app ──HTTPS/JWT──▶ NestJS API ──▶ PostgreSQL
                              │  ├──▶ S3 storage (original files)
                              │  └──▶ Redis queue ──▶ Worker (extract + chunk)
                              └──▶ LlmClient ──▶ LLM provider (backend only)
```

**Document upload flow:**

1. Mobile sends a multipart upload to `POST /api/documents`.
2. API validates auth, size, extension **and magic bytes**, stores the file in S3, creates `Document` with status `UPLOADED`, enqueues a job, returns **202**.
3. Worker downloads the file, extracts text **per page**, splits it into chunks (~500–800 tokens, keep page number and character offsets), stores `DocumentChunk` rows, sets status `READY` (or `FAILED` with an error message).
4. Mobile polls `GET /api/documents/:id` every 2–3 s with backoff until the status is final.
5. For chat: the API retrieves the top relevant chunks (full-text search), builds a prompt, calls the LLM, validates the answer, and returns it with citations that reference real chunks.

**Principles:** the API is **stateless** (scales horizontally); heavy work goes to the queue; the mobile app never calls an LLM.

---

## 7. Data model (Prisma)

| Entity | Key fields |
|---|---|
| **User** | id, email (unique), passwordHash, role (`STUDENT` / `ADMIN`), createdAt |
| **RefreshToken** | id, userId, tokenHash, expiresAt, revokedAt, replacedById (rotation + reuse detection) |
| **Document** | id, userId, title, mimeType, sizeBytes, storageKey, status (`UPLOADED` / `PROCESSING` / `READY` / `FAILED`), errorMessage, pageCount, summary (cached, nullable), createdAt |
| **DocumentChunk** | id, documentId, index, page, text, charStart, charEnd, tsv (full-text), embedding (optional, later) |
| **Conversation** | id, userId, documentId, title, createdAt |
| **Message** | id, conversationId, role (`USER` / `ASSISTANT`), content, citations (JSON: chunkId, page, excerpt), createdAt |
| **Flashcard** | id, documentId, front, back |
| **Quiz** | id, documentId, title, createdAt |
| **QuizQuestion** | id, quizId, prompt, options (JSON), correctIndex, explanation, sourceChunkId |
| **QuizAttempt** | id, quizId, userId, answers (JSON), score, completedAt |
| **Favorite** | userId, targetType, targetId |
| **UsageRecord** | id, userId, kind, provider, model, tokensIn, tokensOut, costEstimate, status, latencyMs, createdAt |

**Rules:**
- Every private resource must be reachable only by its owner (`userId` directly, or through `Document`).
- Deleting a document **cascades**: chunks, flashcards, quizzes, questions, attempts, conversations, messages, favorites **and the S3 object**. Real deletion, not a soft flag.
- Add indexes on foreign keys, `Document(userId, createdAt)`, `DocumentChunk(documentId, index)` and a GIN index on `tsv`.
- All schema changes go through Prisma migrations. Never edit the database by hand.

---

## 8. API contract

Base path: `/api`. JSON in and out (except upload: multipart). Documented with Swagger/OpenAPI.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Access token (15 min) + refresh token |
| POST | `/api/auth/refresh` | Rotate refresh token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/me` | Current profile |
| POST | `/api/documents` | Upload (multipart), returns 202 |
| GET | `/api/documents` | Paginated list (cursor or page) |
| GET | `/api/documents/:id` | Detail + processing status |
| DELETE | `/api/documents/:id` | Real deletion + derived data |
| POST | `/api/documents/:id/summarize` | Summary (cached in DB) |
| POST | `/api/documents/:id/flashcards` | Generate flashcards |
| POST | `/api/documents/:id/quizzes` | Generate a quiz |
| POST | `/api/quizzes/:id/attempts` | Submit answers, compute score |
| POST | `/api/conversations` | New conversation linked to a document |
| GET | `/api/conversations` | History |
| POST | `/api/conversations/:id/messages` | Question → answer with citations |
| PUT / DELETE | `/api/favorites/...` | Manage favorites |
| GET | `/api/usage` | Consumption and remaining quota |
| GET | `/health` | Liveness / readiness |

> Note: the original spec lists `GET /api/usage.` with a stray trailing dot. The correct route is `/api/usage`.

**Single error format** for every failure:

```json
{ "error": { "code": "QUOTA_EXCEEDED", "message": "Daily AI quota reached.", "details": {} } }
```

Stable error codes (the mobile app maps them to friendly messages): `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `DOCUMENT_NOT_READY`, `DOCUMENT_PROCESSING_FAILED`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `LLM_UNAVAILABLE`, `LLM_INVALID_OUTPUT`, `INTERNAL_ERROR`.

Return **404** (not 403) when a user requests another user's resource, so existence is not leaked.

---

## 9. LLM layer (free providers)

The builder has **no budget for paid APIs**. All AI access goes through our own abstraction so providers can be swapped or combined freely.

```ts
interface LlmClient {
  generateText(input: { system: string; prompt: string; maxTokens?: number }): Promise<LlmResult>;
  generateJson<T>(input: { system: string; prompt: string; schema: ZodType<T> }): Promise<LlmResult<T>>;
}
```

**Implementations (in `infra/llm/`):**

| Provider | Role | Notes |
|---|---|---|
| **Ollama** (local) | Development and tests, unlimited | OpenAI-compatible endpoint on localhost; small model (e.g. Llama 3.2 3B / Qwen) |
| **Google Gemini (AI Studio)** | Main for summaries, quizzes | Free tier, Flash models, long context; low request limits |
| **Groq** | Main for chat (fast) | Free tier, OpenAI-compatible |
| **Mistral** | Fallback / volume | Large monthly token allowance |
| **OpenRouter** | Optional fallback | One key, many free models, low daily cap |
| **Mock** | Automated tests | Deterministic, no network |

Free-tier limits change often and have been reduced in the past. **Never hardcode provider limits and never depend on a single provider.** Verify current limits in the provider dashboard.

**Required behavior of the layer:**
- Configurable provider order (`LLM_PROVIDER` + `LLM_FALLBACK_PROVIDERS`); on `429` / timeout / 5xx, retry (limited, with backoff), then fall back to the next provider.
- Hard **timeout** on every call (`LLM_TIMEOUT_MS`).
- **Structured output:** ask for JSON, validate with Zod, retry **once** with the validation error if invalid, then fail with `LLM_INVALID_OUTPUT`.
- **Log every call** in `UsageRecord` (provider, model, tokens, latency, status). Never log document content or full prompts in production.
- **Save tokens:** send only relevant chunks, never the whole document; cache summaries/flashcards/quizzes in the database; avoid regenerating identical results.
- Token budgets: cap input chunks and `maxTokens` per feature.

**Privacy note (put it in the README):** on some free tiers, submitted content may be used by the provider to improve its products. Use public course material for demos.

---

## 10. Security rules (non-negotiable)

1. **No LLM key or any private secret in the mobile app.** Mobile talks only to our API.
2. Secrets live in server environment variables; validate the environment at startup (Zod) and fail fast.
3. Passwords hashed with `argon2`. Never log passwords, tokens or full request bodies with sensitive data.
4. **Access token** short-lived (15 min). **Refresh token** rotated on every use, stored hashed, revoked on logout; reuse of an old refresh token revokes the whole family.
5. Mobile stores tokens in **Keychain / Keystore** (`react-native-keychain`), never in plain storage or MMKV.
6. **Every private endpoint** is behind an auth guard **and** checks resource ownership (prevent IDOR). Write an integration test for each.
7. **Validate every input** on the server with Zod (body, query, params). Never trust the client.
8. **Uploads:** max size (default 10 MB), allowed types PDF/TXT, verify **magic bytes** with `file-type` (not only extension/MIME), generate our own storage key (never use the client file name as a path), limit pages/characters processed.
9. **Treat document content as untrusted data (prompt injection):**
   - Put document text inside clearly delimited blocks and state in the system prompt that it is data, not instructions.
   - Never let document text change the system prompt, tools, or output format.
   - Validate LLM outputs with schemas; citations must reference chunk IDs that were actually provided.
10. **Rate limiting** per IP and per user (`@nestjs/throttler`) and **AI quotas** per user (daily/monthly) checked **before** any LLM call.
11. `helmet`, CORS restricted to known origins, no stack traces in responses, generic messages for auth failures.
12. Show a visible notice in the app: **"AI answers may be incorrect."** (chat, summaries, quizzes).
13. Provide a **real deletion** path for documents and all derived data.

---

## 11. Coding conventions

### General
- **TypeScript strict mode** in all packages. No `any` without a comment explaining why.
- Prefer small functions, explicit names, early returns. Avoid clever code.
- Environment variables are read **only** through the config module (backend) or a typed config file (mobile), never `process.env` scattered in code.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`). One logical change per commit.
- Format with Prettier, lint with ESLint. CI must pass before merging.

### Backend (NestJS)
- Controller → Service → (Prisma / infra). No Prisma calls in controllers.
- DTOs are Zod schemas (from `packages/shared` when shared with mobile).
- Use Nest guards for auth/roles, interceptors for logging/response shaping, and a global exception filter producing the single error format (section 8).
- Long work (extraction, large generations) must not block a request: use the queue.
- Pagination on every list endpoint. Never return unbounded lists.
- Idempotency: re-running a job must not duplicate chunks (delete/replace in a transaction).
- Structured logs with request IDs.

### Mobile (React Native)
- Functional components and hooks only.
- **Server data goes through React Query** (queries, mutations, polling). Zustand is only for small client state (e.g. auth session, UI flags).
- API calls live in `src/api/`, never inside components.
- **Every screen that loads data handles all states:** loading, success, empty, error (with retry), and offline (NetInfo). Reuse the shared state components.
- Accessibility: labels (`accessibilityLabel`, roles), sufficient contrast, touch targets ≥ 44 pt, dynamic text sizes.
- Responsive to small and large phone screens; use safe-area insets; handle the keyboard in forms and chat.
- Use `FlashList` for long lists (documents, messages).
- Axios interceptor: attach access token; on 401 `TOKEN_EXPIRED`, refresh **once** (queue concurrent requests), then retry; on refresh failure, log out.
- User-facing messages come from error codes, written in clear language.

---

## 12. Testing strategy

| Level | Tooling | What to cover |
|---|---|---|
| Unit (API) | Vitest | Chunking, score calculation, quota logic, LLM output parsing, refresh token rotation |
| Integration (API) | Vitest + Supertest + Testcontainers (real Postgres/Redis) | Auth flow, upload with invalid file, **access to another user's document → 404**, quota exceeded, cascade deletion |
| Unit/UI (mobile) | Jest + Testing Library | Hooks, key screens, loading/empty/error/offline states, token refresh interceptor |
| E2E (later) | Maestro | Register → upload → summary → quiz → delete |

Rules:
- LLM calls are **always mocked** in automated tests (`MockLlmClient`). No test hits a real provider.
- Test business rules, not framework internals.
- A feature is not finished until its tests pass in CI.

---

## 13. Environment variables

Maintain `.env.example` (no real secrets). Backend variables:

```bash
# App
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:8081

# Database / queue
DATABASE_URL=postgresql://smartstudy:smartstudy@localhost:5432/smartstudy
# Compose publishes Redis on 6380 so it does not clash with a host Redis.
REDIS_URL=redis://localhost:6380

# Auth
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Storage (SeaweedFS locally, R2/S3 in production)
S3_ENDPOINT=http://localhost:8333
S3_REGION=auto
S3_BUCKET=smartstudy-documents
S3_ACCESS_KEY_ID=smartstudy
S3_SECRET_ACCESS_KEY=smartstudy-dev
S3_FORCE_PATH_STYLE=true

# Uploads
MAX_UPLOAD_BYTES=10485760
MAX_PAGES=300

# LLM
LLM_PROVIDER=ollama
LLM_FALLBACK_PROVIDERS=gemini,groq,mistral
LLM_TIMEOUT_MS=30000
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2
GEMINI_API_KEY=
GEMINI_MODEL=
GROQ_API_KEY=
GROQ_MODEL=
MISTRAL_API_KEY=
MISTRAL_MODEL=
OPENROUTER_API_KEY=

# Quotas and rate limits (tune to provider free limits)
QUOTA_AI_REQUESTS_PER_DAY=20
QUOTA_AI_REQUESTS_PER_MONTH=300
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_MAX=60
```

Mobile reads only a public config (for example `API_BASE_URL`). **No secret ever goes in the mobile config.** On Android emulators, the host machine is `10.0.2.2`, not `localhost`.

---

## 14. Roadmap (each step is demoable)

### Step 0 — Foundations
- [x] Monorepo with npm workspaces (`"workspaces": ["apps/*", "packages/*"]` in the root `package.json`)
- [x] `docker-compose.yml` (Postgres + pgvector, Redis, SeaweedFS in place of MinIO) running
- [x] Empty NestJS app with config validation and `/health` (`/health`, `/health/live`, `/health/ready`)
- [x] Empty React Native CLI app running on a physical Android device (Xiaomi Mi 9T, API 30, `arm64-v8a`) over wireless adb
- [x] `packages/shared` consumed by both apps (Metro `watchFolders` configured)
- [x] ESLint (mobile), oxlint (API), Prettier, Husky, lint-staged, GitHub Actions CI
- [x] `.env.example`, first README

### Step 1 — Accounts
- [ ] Prisma `User` + `RefreshToken`, migration
- [ ] `register`, `login`, `refresh`, `logout`, `/me`
- [ ] Global error filter + validation pipe
- [ ] Mobile: login/register screens, secure token storage, axios refresh interceptor, auth navigation
- [ ] Tests: hashing, token rotation, auth integration

### Step 2 — Documents
- [ ] Upload endpoint with size/type/magic-byte checks, S3 storage
- [ ] Queue + worker: extract text per page, chunk, store, update status
- [ ] List / detail / delete with cascade (including S3 object)
- [ ] Mobile: picker, upload progress, list, status polling, delete
- [ ] Tests: invalid file, ownership (404), cascade deletion, chunking

### Step 3 — AI features
- [ ] `LlmClient` + Ollama, Gemini, Groq, Mock implementations + fallback
- [ ] Summary (cached), flashcards, quiz generation with Zod-validated output
- [ ] Quiz attempts and scoring
- [ ] `UsageRecord` logging, `/api/usage`
- [ ] Mobile: summary, flashcards, quiz screens, AI disclaimer

### Step 4 — Chat with sources
- [ ] Full-text retrieval behind a `Retriever` interface
- [ ] Conversations and messages with citations referencing real chunks
- [ ] Prompt-injection defenses in prompts and output validation
- [ ] History and favorites
- [ ] Mobile: chat UI (markdown, citations that open the page/excerpt)

### Step 5 — Hardening and delivery
- [ ] Final quotas and rate limits, per-user and per-IP
- [ ] Integration test coverage for critical endpoints
- [ ] Sentry on mobile and API
- [ ] Dockerfile, deployment (API + DB + Redis + storage)
- [ ] Android release build, internal distribution
- [ ] README: install, run, test, deploy, env vars, data schema, request examples

### Step 6 — Demo
- [ ] Screenshots and a short demo video
- [ ] Verify the acceptance criteria below

---

## 15. Current status

> The agent updates this section after each step.

- **Current step:** Step 1 — not started
- **Done:** Step 0 foundations: npm workspaces monorepo (`apps/api`, `apps/mobile`, `packages/shared`); Docker Compose with Postgres 17 + pgvector, Redis (host port 6380) and SeaweedFS; NestJS 12 app with Zod env validation, Prisma 7 wiring (schema only, no models yet) and Terminus health endpoints; React Native 0.88 app with monorepo-aware Metro and Gradle config, built as a debug APK and verified running on a physical Xiaomi Mi 9T (`arm64-v8a`, API 30); shared Zod package consumed by both apps; Prettier, Husky + lint-staged, GitHub Actions CI, `.env.example` and README.
- **Next action:** propose the Step 1 plan (Prisma `User` + `RefreshToken`, auth endpoints, global error filter + validation pipe, mobile auth screens) and wait for validation.
- **Open questions:** operating system of the builder for iOS builds (needs macOS); which LLM provider accounts are already created; whether to keep Nest 12's Vitest default or switch the API to Jest as originally planned.

---

## 16. Out of scope for the MVP

Do **not** build these unless explicitly asked: payments or subscriptions, admin screens, social login, many file types (DOCX, images/OCR), push notifications, real-time collaboration, multi-language UI, vector search (pgvector) before the full-text version works, microservice split. Priority order: **MVP → tests → security → deployment → secondary features.**

---

## 17. Acceptance criteria (definition of done)

- [ ] A user can register, log in, and stay signed in with automatic session renewal.
- [ ] A user can import a valid PDF/TXT; invalid type or oversize files are rejected with a clear message.
- [ ] The user can follow the processing status (`UPLOADED` → `PROCESSING` → `READY`/`FAILED`).
- [ ] The user can generate a summary, flashcards and a quiz, and see quiz results.
- [ ] The user can chat about a document and see citations (page or excerpt) when available.
- [ ] The user can see conversation history, favorites and usage/quota.
- [ ] The user can delete a document, and all derived data and the stored file are really deleted.
- [ ] No AI key or private secret exists in the mobile app; private endpoints reject unauthenticated and non-owner access.
- [ ] Loading, empty, error and offline states are handled on every data screen.
- [ ] Automated tests cover the critical business rules and endpoints; CI is green.
- [ ] README, `.env.example`, database schema, request examples, screenshots and a short demo are delivered.

---

## 18. Known gotchas

- **npm workspaces + Metro:** npm hoists dependencies to the root `node_modules` and symlinks workspace packages, and Metro does not follow this by default. In `apps/mobile/metro.config.js`, add the monorepo root and `packages/shared` to `watchFolders`, and set `resolver.nodeModulesPaths` to include both `apps/mobile/node_modules` and the root `node_modules`. Run installs from the repo root (`npm install`), and use `npm run <script> -w apps/api` (or `-w apps/mobile`) to target one workspace. Keep a single version of `react` and `react-native` across workspaces, since duplicates cause hard-to-debug errors. If this becomes painful, copy the schemas or generate a client from the OpenAPI spec.
- **React Native CLI:** iOS builds require macOS, Xcode and CocoaPods. Android needs Android Studio, JDK and correctly set `ANDROID_HOME`.
- **Android emulator networking:** use `http://10.0.2.2:<port>` to reach the host. Cleartext HTTP needs explicit configuration for debug builds only.
- **Document picker:** `react-native-document-picker` was superseded by `@react-native-documents/picker`; check the current docs before installing.
- **Free LLM limits** change and can be low; rely on quotas, caching, fallbacks and the Ollama dev provider.
- **PDF extraction:** scanned PDFs (images) have no text layer. OCR is out of scope; detect empty extraction and set `FAILED` with a clear message.
- **Library versions:** do not assume versions from memory. Check the current release and its documentation before installing or upgrading.
- **MinIO images:** the official `minio/minio` and `minio/mc` images are no longer publicly pullable (Docker Hub, Quay and GHCR all deny access). We use SeaweedFS behind the same S3 API; production still targets Cloudflare R2.
- **Redis port:** local Redis is published on **6380** because a host Redis often owns 6379.
- **Prisma 7:** the client is Rust-free and requires a driver adapter (`@prisma/adapter-pg` + `pg`); `new PrismaClient()` without an adapter throws. The client is generated to `apps/api/src/generated/prisma` and the CLI reads the root `.env` through `apps/api/prisma.config.ts`.
- **Zod 4 + Metro:** Zod ships `export * as` ESM syntax that the React Native Babel preset does not transform. `apps/mobile/babel.config.js` adds `@babel/plugin-transform-export-namespace-from`.
- **npm 11 install scripts:** npm 11 blocks lifecycle scripts by default and lists them after install (`npm install-scripts ls` / `approve`). Prisma still generates correctly, but approve its scripts if generation ever fails.
- **Gradle + npm workspaces:** RN's template hardcodes `../node_modules` for the Gradle plugin and React Native sources, but npm hoists both to the repo root. `apps/mobile/android/settings.gradle` resolves `@react-native/gradle-plugin` from either location, and the `react {}` block in `apps/mobile/android/app/build.gradle` points `reactNativeDir`, `codegenDir` and `cliFile` at `../../../../node_modules/...`. Re-apply these if the Android project is regenerated.
- **Android ABI:** `reactNativeArchitectures` in `gradle.properties` is set to `arm64-v8a` only (test device). Add `x86_64` back to build for the emulator; building all four ABIs roughly doubles build time and disk use.
- **Physical device API URL:** `10.0.2.2` is an emulator-only alias. On a real phone, set `DEV_API_HOST` in `apps/mobile/src/lib/config.ts` to the computer's LAN IP (`hostname -I`). Wireless adb needs `adb reverse tcp:8081 tcp:8081` so the phone reaches Metro.
