# Trailgrad

Trailgrad is an AI interview workspace with text and realtime voice interviews.
The Next.js app plans questions, owns the interview state, decides follow-ups,
and produces the final report. Gemini Live handles interview speech directly in
the browser; LiveKit is used only for human peer-help calls.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- PostgreSQL and Prisma
- Clerk authentication
- Gemini for interview planning, with optional Groq for low-latency turn decisions
- Gemini Live for native interview audio; LiveKit for peer-help calls

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm prisma generate
pnpm prisma migrate deploy
pnpm dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

## Required environment

The root `.env` needs:

```text
DATABASE_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
GEMINI_API_KEY
GEMINI_FAST_MODEL
GEMINI_REASONING_MODEL
GEMINI_EMBEDDING_MODEL
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```

`GROQ_API_KEY` is optional but recommended for quicker spoken follow-ups. See
[.env.example](./.env.example) for defaults and optional settings.
Production also requires `INTERVIEW_AUTH_SECRET` (at least 32 random bytes),
`UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. The secret signs anonymous interview
ownership and short-lived voice-worker access. Upstash provides shared rate limits and distributed
interview locks. Local development and tests use process-local fallbacks when these three values are
omitted.

## Voice architecture

```text
Browser microphone ──► Gemini Live
                            │
                            │ submit_answer → POST /api/interview/decide
                            ▼
                     Next.js interview brain
                            │
                            ▼
                       Gemini audio ──► Browser audio
```

Interview state is persisted in PostgreSQL. This matters on Vercel, where
separate API calls may run in different serverless instances.

## Production

Link the repository once with `npx vercel link`, then deploy the Next.js app with:

```bash
pnpm deploy:production
```

This builds locally, verifies that the generated output stays within Vercel Hobby's 12-function
limit, and deploys the exact prebuilt artifact. Automatic Git deployments are disabled because
Vercel's Git `patchBuild` step incorrectly rejects this project after a successful build. Also run
database migrations when a release includes schema changes:

```bash
pnpm prisma migrate deploy
```

## Verification

```bash
pnpm lint
pnpm test
pnpm build
cd agent && .venv/bin/python -m compileall .
```
