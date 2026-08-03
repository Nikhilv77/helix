# Helix

Helix is an AI interview workspace with text and realtime voice interviews. The
Next.js app plans questions, owns the interview state, decides follow-ups, and
produces the final report. A small LiveKit worker handles streaming speech in
and speech out.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- PostgreSQL and Prisma
- Clerk authentication
- Gemini for interview planning, with optional Groq for low-latency turn decisions
- LiveKit Agents, Deepgram Flux STT, Aura-2 TTS, and Silero VAD

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm prisma generate
pnpm prisma migrate deploy
pnpm dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

The voice worker has its own Python environment and secrets:

```bash
cd agent
python3 -m venv .venv
.venv/bin/pip install -e .
cp .env.example .env.local
cd ..
pnpm agent:dev
```

Both `.env` files must point to the same LiveKit project. The worker must be
running before a voice interview is opened.

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

The agent's `agent/.env.local` needs:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
DEEPGRAM_API_KEY
HELIX_API_BASE_URL=http://localhost:3001
```

## Voice architecture

```text
Browser microphone
      │ WebRTC
      ▼
LiveKit room ──► Python voice worker ──► Deepgram Flux STT
                       │
                       │ POST /api/interview/decide
                       ▼
                Next.js interview brain
                       │
                       ▼
                 Aura-2 streaming TTS ──► Browser audio
```

Interview state is persisted in PostgreSQL. This matters on Vercel, where
separate API calls may run in different serverless instances.

## Production

Deploy the Next.js app to Vercel and run:

```bash
pnpm prisma migrate deploy
```

Deploy the Python worker as a persistent LiveKit Agent worker, such as LiveKit
Cloud Agents. A Vercel function cannot host that long-running WebSocket worker.
Set `HELIX_API_BASE_URL=https://tryhelix.online` in the deployed worker.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
cd agent && .venv/bin/python -m compileall .
```
