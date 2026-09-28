# 2. Architecture

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server components for page data, route handlers for APIs |
| Styling | Tailwind CSS plus `src/app/globals.css` | Six user-selectable accents; always use the accent tokens, never a brand hex |
| Database | PostgreSQL on Neon (us-east-2) via Prisma 6 | 92 models, 101 migrations |
| Shared state | Upstash Redis | Rate limits and distributed locks across serverless instances |
| Auth | Clerk (`@clerk/nextjs` 7) | Interviews can also run with a signed anonymous-browser identity |
| AI | Gemini (`@google/genai`), Groq | Behind a fallback service; see [AI, voice and scoring](04_AI_VOICE_AND_SCORING.md) |
| Voice interviews | Gemini Live in the browser | The server owns interview state and decisions |
| Teacher speech | Deepgram TTS (default) or Gemini TTS, plus pre-recorded MP3s | `NEXT_PUBLIC_TTS_PROVIDER` picks the provider |
| Peer calls | LiveKit | Used only for Trailmate help rooms |
| Code execution | Judge0 via RapidAPI (DSA); Vercel Sandbox (Core Technical runner, Node 22.22.2) | |
| Email | Resend | Off unless `NOTIFICATION_EMAIL_ENABLED` |
| Editor and docs | Monaco, Yjs, pdf-lib, pdf-parse, mammoth, three | Code editor, shared editing, PDF export, resume parsing, 3D visuals |
| Hosting | Vercel Hobby | At most 12 serverless functions; daily cron |
| Tests | Vitest (327 test files, about 2,000 tests) | |

## Folder layout

```text
src/
  app/                    Routes: pages and API route handlers (thin)
    api/<area>/...        One route file per area; many use catch-all routers
  features/<area>/        Product areas
    contracts/            Zod schemas and types shared by UI and server
    domain/               Pure logic, no I/O (scoring, formatting, state machines)
    server/               Services, stores, page-data loaders, prompts
    ui/                   React components
  server/                 Cross-cutting server code
    app-container.ts      Builds every service once (dependency wiring)
    ai/                   AiService, FallbackAiService, providers, strict JSON schema
    rate-limit/           shared-guard.ts: Redis rate limits and leases
    auth/                 request-user, onboarding guards
    config/               Environment schema (Zod) and app config
    http/                 api-error, api-response, action timing
    database/             Prisma client
  lib/                    Client-safe shared code: avatars and personas, voice, theme,
                          curriculum, roadmap, reports, api-client
prisma/                   schema.prisma, migrations, seed
scripts/                  Deploy helpers, evals, publishers, backfills
public/voice/             Pre-recorded teacher lines (about 950 MP3s)
```

Feature areas in `src/features`: account, analytics, dashboard, interviews, marketing,
notifications, onboarding, peer-help, practice (ai-ml, applied-engineering, architecture-design,
core-technical, dsa, shared, story-tracks), preparation-onboarding, profile, progress, reports,
resume-roast, search, trailguide.

## Request flow

```text
Browser
  │  page request
  ▼
proxy.ts (Clerk middleware)  ── adds x-trailgrad-pathname; gates nothing
  │
  ▼
Server component page ── calls a features/<area>/server/*-page-data.ts loader
  │                        (reads snapshots or services via getAppContainer())
  ▼
Client components ── call /api/<area> through lib/api/api-client.ts
  │
  ▼
Route handler ── auth (request-user) → shared guard (rate limit / lease)
  │              → service → apiSuccess / apiError envelope
  ▼
Prisma (Neon)  ·  Redis (Upstash)  ·  AI providers  ·  after() for post-response work
```

- Nothing is gated at the edge. Interviews can run logged out, and every API authorises itself.
- `getAppContainer()` builds services once per instance. Wiring (which AI goes where, timeouts,
  fallbacks) lives there, not in the services.
- Responses use one envelope (`apiSuccess` / `apiError` with a code and status).

## Fitting inside 12 functions

Vercel Hobby allows 12 serverless functions. The build produces about 10. To stay under the limit:

- Related endpoints share one route file with a path router, for example
  `api/help/[...path]`, `api/practice/[track]/[...action]`, `api/v1/[...path]`.
- A new endpoint should be a new method or path on an existing router, not a new route file.
- The Prisma engine pruning in the build is part of this. See [Operations](07_OPERATIONS.md#the-prisma-engine-and-function-limit).

## Read models (snapshots)

Pages that aggregate a lot of data read a precomputed snapshot instead of running the
aggregation on every visit.

| Snapshot | Used by |
| --- | --- |
| `CandidateAnalyticsSnapshot` | Progress, parts of Home |
| `PracticeHomeSnapshot` | Practice home |
| `WorkspacePageSnapshot` (pages: interviews, resume-roast, trailmate, reports) | Those pages |

How they stay correct:

1. A write that changes the inputs bumps `dirtyVersion` (triggers or explicit marks).
2. A read serves the snapshot if `builtVersion == dirtyVersion` and it has not expired.
3. If it is stale, the read either waits up to `waitForFreshMs` for a rebuild (used right after
   practice, so the learner sees their new result) or serves the stale copy and rebuilds in the
   background (stale-while-revalidate).
4. Each page has a schema version (`WORKSPACE_PAGE_SCHEMA_VERSION`). Bumping it invalidates old
   snapshots when the shape changes.
5. The daily cron calls `recoverDirtySnapshots` to rebuild anything left dirty.

If a fresh wait times out, a `*_fresh_wait_exceeded` log line is written; see
[Operations](07_OPERATIONS.md#logs-to-watch).

## Concurrency and consistency

- **Single-flight with partial unique indexes.** Where only one of something may run (one
  generating Resume Roast per user, one live help session per request), a partial unique index
  enforces it in the database. A second tab joins the running one instead of starting another.
- **Optimistic versions.** Interview sessions carry a version. Concurrent answers or code runs
  cannot overwrite newer state.
- **Idempotent turns.** Each interview answer has a turn ID. A retry of a finished turn replays the
  stored response; a different concurrent turn gets a conflict.
- **Distributed leases.** `shared-guard.ts` provides Redis leases so only one answer evaluation or
  code run happens per scope, across all instances. Code runs release the lease exactly once.
- **Rate limits.** Also in `shared-guard.ts`: interview starts, answer evaluation, LiveKit tokens,
  code execution, resume uploads, and uncached TTS. Local development falls back to in-process
  limits when Upstash is not configured.
- **Post-response work.** `after()` runs work that must not block the response and must survive a
  disconnect, for example finishing a Resume Roast when the user refreshes.
- **Interactive transactions** use `{ maxWait: 10_000, timeout: 20_000 }` because the database is
  far from some developers (about 215 ms per round trip from Mumbai).

## Latency patterns

- **Hedged requests.** If the primary model has not answered after `hedgeAfterMs`, start the
  fallback in parallel and take whichever finishes first (resume analysis hedges at 12 s).
- **Parallel reads.** Page loaders issue independent queries together.
- **Pre-recorded audio.** Fixed teacher lines come from the CDN in about 0.1 s, instead of 7–9 s of
  live TTS.
- **Bounded fresh waits** instead of always-fresh reads (see snapshots above).
- **Client events instead of refreshes.** For example, solving a DSA question announces
  `DSA_QUESTION_SOLVED_EVENT` rather than calling `router.refresh()`.

## Security model

- API routes check the Clerk user, a signed anonymous-browser identity (`INTERVIEW_AUTH_SECRET`), or
  a short-lived voice-worker capability bound to one session.
- Launch APIs resolve plan and blueprint IDs on the server; clients cannot choose arbitrary ones.
- Operator pages check `OPERATOR_USER_IDS`.
- Cron requires `CRON_SECRET`.
- The deploy artifact excludes `.env` and `.env.local`.
- Resume text is not stored raw after extraction.
