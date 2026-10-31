#  

A mobile learning assistant: import a course (PDF or TXT), then let the AI summarize it,
generate flashcards and quizzes, and answer questions with citations.

**AI answers may be incorrect.** On some free LLM tiers, submitted content may be used by the
provider to improve its products — use public course material for demos.

> Portfolio project. See [AGENTS.md](./AGENTS.md) for the full technical reference.

## Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Mobile   | React Native CLI + TypeScript                        |
| API      | NestJS + TypeScript                                  |
| Database | PostgreSQL + Prisma                                  |
| Queue    | BullMQ + Redis                                       |
| Storage  | S3-compatible (MinIO locally, Cloudflare R2 in prod) |
| LLM      | Free providers behind an internal `LlmClient`        |

## Repository layout

```
apps/mobile     React Native app
apps/api        NestJS API
packages/shared Zod schemas and types shared by both apps
```

## Prerequisites

- Node.js **22.13+** (24 LTS recommended) and npm
- Docker + Docker Compose
- Android Studio, JDK 17+ and `ANDROID_HOME` for Android builds
- Xcode + CocoaPods for iOS builds (macOS only)

## Getting started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start local infrastructure (Postgres + pgvector, Redis, MinIO)
cp .env.example .env
npm run infra:up

# 3. Start the API (http://localhost:3000, health at /health)
npm run dev:api

# 4. Start Metro for the mobile app
npm run dev:mobile
# then, in another terminal:
npm run android -w @smartstudy/mobile
```

## Useful scripts

| Command              | Description                             |
| -------------------- | --------------------------------------- |
| `npm run lint`       | ESLint across all workspaces            |
| `npm run typecheck`  | TypeScript checks across all workspaces |
| `npm test`           | Unit tests across all workspaces        |
| `npm run build`      | Build all workspaces                    |
| `npm run infra:up`   | Start Postgres, Redis and MinIO         |
| `npm run infra:down` | Stop local infrastructure               |

## Environment variables

All backend configuration lives in `.env` (see `.env.example`). Secrets are **never** bundled
into the mobile app; the app only reads a public `API_BASE_URL` and talks exclusively to our API.

> On the Android emulator, the host machine is reachable at `http://10.0.2.2:3000`.

## Documentation

- [AGENTS.md](./AGENTS.md) — architecture, data model, API contract, security rules, roadmap.

## License

Private portfolio project. All rights reserved.
