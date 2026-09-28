# 6. Development

## Setup

```bash
pnpm install
cp .env.example .env.local   # fresh checkout only
pnpm db:verify:dev           # refuses to run against production
pnpm prisma generate
pnpm db:init:dev             # applies migrations to the dev database
pnpm dev                     # http://localhost:3001
```

`.env.local` must hold a **separate development database** (`DATABASE_URL` pooled, `DIRECT_URL`
non-pooled). `.env` may point at production. Startup and every database-writing script fail
closed if `.env.local` is missing or matches `.env` or the pulled Vercel production environment.

## Environment

The schema is `src/server/config/environment.schema.ts` (Zod). The full list with defaults is in
`.env.example`.

| Group | Variables |
| --- | --- |
| Required | `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_FAST_MODEL`, `GEMINI_REASONING_MODEL`, `GEMINI_EMBEDDING_MODEL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| Required in production | `INTERVIEW_AUTH_SECRET` (32+ random bytes), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET` |
| Voice | `GEMINI_LIVE_INTERVIEWS_ENABLED`, `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_TRANSCRIPTION_MODEL`, `NEXT_PUBLIC_TTS_PROVIDER`, `DEEPGRAM_API_KEY`, `DEEPGRAM_TTS_MODEL` |
| Optional AI | `GROQ_API_KEY`, `GROQ_DECIDER_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES` |
| Code execution | `RAPIDAPI_KEY`, `RAPIDAPI_HOST` (Judge0) |
| Email | `NOTIFICATION_EMAIL_ENABLED`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` |
| Interviews | `INTERVIEW_DAILY_LIMIT`, `INTERVIEW_*_RETENTION_DAYS`, `INTERVIEW_RETENTION_BATCH_SIZE`, `INTERVIEW_METRICS_SAMPLE_LIMIT` |
| Operators | `OPERATOR_USER_IDS`, `INTERVIEW_OPERATIONS_ADMIN_USER_ID` |

Without Upstash and the interview secret, local development uses in-process rate limits and
locks. That is fine for one machine but does not test cross-instance behaviour.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Verifies the dev DB, generates Prisma, runs Next on port 3001 |
| `pnpm build` | Prisma generate, engine pruning, `next build` |
| `pnpm test` / `test:watch` | Vitest |
| `pnpm lint` | ESLint |
| `npx tsc --noEmit -p .` | Type check (there is no `typecheck` script) |
| `pnpm prisma:migrate:dev` | Create and apply a migration on the dev DB |
| `pnpm prisma:studio` | Prisma Studio on the dev DB |
| `pnpm prisma:seed` | Seed the dev DB |
| `pnpm db:migrate:production` | Apply migrations to production (see [Operations](07_OPERATIONS.md)) |
| `pnpm deploy:production` | Build locally and deploy the prebuilt artifact |
| `pnpm vercel:verify` | Check function count, Prisma engines, no local env files |
| `pnpm core-technical:generate` / `:publish` | Generate and publish Core Technical content |
| `pnpm applied-engineering:publish`, `architecture-design:publish` | Publish those tracks |
| `pnpm dsa-cases:verify` | Verify authored DSA test cases |
| `pnpm interview:quality` | Interview quality eval (live models) |
| `pnpm resume-roast:eval` | Resume Roast quality eval (live models) |
| `pnpm voice:lines --provider deepgram` | Regenerate pre-recorded teacher lines |
| `pnpm avatar:optimize` | Optimise avatar images |
| `pnpm analytics:backfill:dev`, `profile:analytics:dev` | Rebuild and profile analytics snapshots |
| `pnpm assessments:rescore:dev` / `:production` | Rescore DSA block assessments |
| `pnpm compatibility:audit` | Check old data against current contracts |
| `pnpm data:reset-user` | Reset one user's data on the dev DB |
| `pnpm trailmate:demo` / `--undo` | Add or remove the Trailmate demo data on the dev DB (demo account only) |

## Conventions

- **Where code goes.** New product code lives in `src/features/<area>/` under `contracts`,
  `domain`, `server`, or `ui`. Keep route handlers thin; put logic in a service.
- **No new route files without need.** Add a path or method to an existing router to stay under
  the 12-function limit.
- **Wire services in `app-container.ts`.** Choose models, timeouts, and fallbacks there.
- **Validate at the edges.** Zod contracts for API input and AI output.
- **Scores in code.** Never let a model produce a final number directly.
- **Theme.** Six accents are user-selectable. Use accent tokens; never hard-code a brand hex.
  Check light and dark, desktop and phone.
- **UI consistency.** Copy an existing pattern from a neighbouring page rather than inventing
  one. Prefer smooth transitions.
- **Copy.** Plain, human language addressed to the learner. No AI filler.
- **Transactions.** Give interactive transactions `{ maxWait: 10_000, timeout: 20_000 }`.
- **After a schema change,** restart `pnpm dev`; the running server keeps the old Prisma client.

## Testing

- Unit and service tests sit next to the code as `*.test.ts(x)` or `*.spec.ts`: 327 files, about
  2,000 tests. The full suite passes as of September 28.
- Before handing over a change, run the type check, ESLint on touched directories, and the full
  `npx vitest run`.
- Live-model evals (`interview:quality`, `resume-roast:eval`) cost quota. Run them deliberately.

## Dev data

- Two dev accounts: a demo account holds seeded Trailmate history; the other is kept empty to
  see new-user behaviour.
- Trailmate demo data: `pnpm trailmate:demo` to seed, `pnpm trailmate:demo --undo` to remove. It
  only involves the demo account.
- Emails are not in the database; look accounts up through the Clerk API.

## Local latency

The dev database is in us-east-2. From India that is about 215 ms per round trip, so local pages
are much slower than production (where functions run in `iad1`, next to the database). Neon also
suspends when idle, so the first request after a pause can time out. Judge latency from
production `api.action_timing` logs, not from localhost.
