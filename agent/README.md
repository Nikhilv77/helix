# Trailgrad voice worker

This service is the realtime speech edge for Trailgrad. It joins dispatched
LiveKit rooms, transcribes the candidate with Deepgram Flux, sends completed
turns to the Next.js interview brain, and streams Aura-2 speech back.

It deliberately owns no interview state or LLM prompt.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
cp .env.example .env.local
```

Fill in:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
DEEPGRAM_API_KEY
TRAILGRAD_API_BASE_URL=http://localhost:3001
```

The LiveKit values must match the root Next.js environment.

## Run

From the repository root:

```bash
pnpm agent:dev
```

Production workers use:

```bash
pnpm agent:start
```

The first log line prints the resolved STT, end-of-turn, TTS, and API settings.
For production, deploy this directory to a persistent worker platform and set
`TRAILGRAD_API_BASE_URL` to the public Trailgrad URL.

## Conversation pipeline

```text
candidate audio
  -> Flux conversational STT and end-of-turn
  -> POST /api/interview/decide
  -> streamed Aura-2 response
```

Transient decision failures are spoken as a short retry prompt rather than
silently abandoning the turn. The Next.js decision endpoint also has a strict
latency budget and falls back to a planned probe.
