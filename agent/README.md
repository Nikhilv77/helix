# Helix voice agent

Speech in, speech out. This service has **no LLM and no interview state** — it
transcribes the candidate, posts the text to `/api/interview/decide`, and speaks
whatever comes back. Probe, challenge, move on, and every cap live in the
Next.js app.

```
browser ──audio──► LiveKit room ──audio──► agent (this service)
                                              │  POST /api/interview/decide
                                              ▼
                                        Next.js interview brain
                                              │  { action, utterance }
                                              ▼
                                        agent speaks it verbatim
```

## Setup

```bash
cd agent
uv sync                 # or: pip install -e .
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
| --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud → Settings → Keys |
| `DEEPGRAM_API_KEY` | console.deepgram.com — one key covers STT and TTS |

The **same** LiveKit credentials go in the repo-root `.env` so the Next.js
token endpoint mints tokens for the same project:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

## Run

```bash
# Terminal 1 — the brain
pnpm dev

# Terminal 2 — the voice
cd agent && uv run python main.py dev
```

## Testing one spoken exchange

1. Create an interview and copy its `sessionId`:

   ```bash
   curl -s -X POST http://localhost:3001/api/interview/start \
     -H 'content-type: application/json' \
     -d '{"role":"backend","level":"3-5","roundType":"behavioral",
          "intensity":"realistic","context":"Rebuilt a payments retry pipeline."}'
   ```

2. Mint a room token:

   ```bash
   curl -s -X POST http://localhost:3001/api/livekit/token \
     -H 'content-type: application/json' \
     -d '{"sessionId":"<paste-it>"}'
   ```

3. Join `interview-<sessionId>` with that token from the
   [LiveKit Agents Playground](https://agents-playground.livekit.io) and speak.

The agent should read the planned opening question aloud, wait for you to
finish, then speak the follow-up the decide endpoint returned.

## Configuration

Providers and models are all in `config.py`. TTS is roughly 60% of running
cost, so it is the first thing to swap.

## Not built yet

Barge-in tuning (Phase 3), latency instrumentation (Phase 4), and the in-app
voice client. The playground stands in for the client until then.
