# 4. AI, voice and scoring

## Models and where they are used

All AI calls go through `AiService` (`src/server/ai/ai.service.ts`), which wraps one provider.
`FallbackAiService` wraps two services: a primary and a fallback, with per-call timeouts and a
cooldown. After a primary failure it sends traffic to the fallback for a while (60 s by default).
Wiring is in `src/server/app-container.ts`.

| Model | Config | Used for |
| --- | --- | --- |
| Gemini fast (`gemini-flash-lite-latest`) | `GEMINI_FAST_MODEL` | Short, latency-sensitive calls |
| Gemini reasoning (`gemini-flash-latest`) | `GEMINI_REASONING_MODEL` | Resume extraction, roast, evaluation, content generation |
| Gemini Live | `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_TRANSCRIPTION_MODEL` | Voice interviews: speech in and out in the browser |
| Gemini embeddings | `GEMINI_EMBEDDING_MODEL` | Retrieval settings (legacy knowledge index) |
| Groq (`openai/gpt-oss-20b`) | `GROQ_API_KEY`, `GROQ_DECIDER_MODEL` | Interview planning, turn decisions, evaluation when configured |

Routing:

| Path | Primary | Fallback |
| --- | --- | --- |
| Interview decisions and live grading (server-led rounds) | Groq (if a key is set) | Gemini; each path has its own cooldown so an evaluator failure does not move the decider |
| Interview grading after the response (all voice rounds) | Gemini reasoning, 15 s | Groq, 8 s |
| General generation | Gemini | Groq |
| Resume Roast (score pass and roast pass) | Gemini, 15 s timeout | Groq, 20 s timeout; no third attempt |
| Resume analysis in onboarding | Gemini | Gemini reasoning model, hedged after 12 s, all inside a 52 s budget. Groq could not produce this extraction reliably, so it is not used here |

All structured output uses strict JSON schemas (`strict-json-schema.ts`) validated with Zod.
A response that does not validate counts as a failure and triggers the fallback.

## Voice

### Interviews: Gemini Live

```text
Browser microphone ──► Gemini Live (token from /api/interview/gemini-live/token)
                            │
                            │ complete_interview_turn → POST /api/interview/decide
                            ▼
                     Next.js interview brain (state machine, follow-up budget, grading queue)
                            │
                            ▼
                    Gemini Live audio ──► Browser speaker
```

The browser talks to Gemini Live directly for speech. The server decides what happens next and
stores all state, so a call can run on any serverless instance. `GEMINI_LIVE_INTERVIEWS_ENABLED`
turns the voice path on or off. Voice interviews cost about $0.68 per session, which makes them
the most expensive feature.

- **The server locks the Live settings into the one-use token:** system instruction, tools,
  transcription, and context compression. A token with constraints ignores anything the browser
  sends, so these must never be set only on the client. The browser never sees the instruction.
- **Connections rotate** every 8 minutes, on `goAway`, or on an unexpected close, using a
  `rotation` token (fresh credential, saved history, silent start). Gemini ends each connection
  after about ten minutes, and resuming by handle loses context with ephemeral tokens.
- Full engine design: [INTERVIEW_ENGINE.md](../INTERVIEW_ENGINE.md).

### Teacher speech (TTS)

- **Pre-recorded lines.** Fixed lines (greetings, intros, hand-offs, report openers) are MP3s in
  `public/voice/`: about 950 files, 117 lines for each of 8 teachers plus greetings. They load in
  about 0.1 s. `src/lib/avatars/static-voice.generated.ts` maps text to files. Regenerate with
  `pnpm voice:lines --provider deepgram`. Details in [STATIC_VOICE_LINES.md](STATIC_VOICE_LINES.md).
- **Live lines.** Anything that depends on the learner goes to `/api/voice/speak`, using the
  provider set by `NEXT_PUBLIC_TTS_PROVIDER` (Deepgram by default, Gemini otherwise), and falls
  back to the other provider on failure. Uncached TTS is rate limited.
- A missing MP3 falls back to live speech automatically.

### Peer-help calls: LiveKit

Trailmate help sessions are LiveKit rooms. Tokens are rate limited, and reconnects reuse the same
room and identity. LiveKit is not used for AI interviews.

## Scoring

The rule across the product: **the model observes, code scores.** The model is asked what it saw
against a fixed rubric. Weights, caps, gates, and the final number are computed in TypeScript.
This makes scores reproducible, explainable, and testable.

### Interviews

- The model rates each round parameter on an anchored 1–5 scale with evidence (0 = not asked by
  this question) and gives a correctness verdict. Code converts levels to 94 / 78 / 55 / 30 / 10,
  averages them, and caps the answer and every parameter by the verdict (incorrect ≤ 44, partially
  correct ≤ 69, mostly correct ≤ 84) and by test results. Temperature 0, fixed seed.
- DSA code runs store authored test results. Failed tests cap correctness. Running code without
  tests does not prove correctness.
- MCQs use the authored answer key, not the model.
- Each question is graded once, when it closes. The round score is answer quality times coverage:
  declined questions and questions skipped by ending early count as zero.
- If grading fails, the answer is marked unverified, left out of the score and adaptation, and
  retried.

### Practice checkpoints

Assessments score with deterministic rubrics per track. DSA block assessments can be rescored
from stored evidence (`pnpm assessments:rescore:dev`).

### Resume Roast

- Five recruiter-style areas, each 1–5, with integer weights in
  `src/features/resume-roast/server/resume-roast.rubric.ts` (`RESUME_ROAST_RUBRIC_VERSION = "rubric-v1"`).
- The score out of 10 is computed in code. Gates stop inflated scores: a 10 is only possible when
  every area is 5.
- The score pass runs at temperature 0 with a fixed seed (7) and is cached per resume version,
  target, and rubric version. The same resume gets the same score.
- The roast pass runs in parallel at temperature 0.7 (prompt v7) and must use grounded rewrites
  of the learner's own lines. Internal IDs are stripped and sections validated.
- `pnpm resume-roast:eval` runs a live quality check.

### Language

Feedback is written the way a person would say it. Rules applied across prompts and copy:

- No AI filler ("delve", "leverage", "robust", "it's important to note").
- Address the learner, not a third person. Evaluator notes like "Candidate failed to provide a
  career story" are rewritten deterministically into "Next time, provide a career story."
  (`src/features/interviews/domain/learner-next-step.ts`), including in saved reports.
- Say what is missing and what to do next. Do not soften a weak result into praise.
- Label things plainly ("Strongest area", "Not scored").

## Cost notes

| Item | Approximate cost |
| --- | --- |
| Voice interview session | $0.68 |
| Trailmate help session (LiveKit) | $0.05 |
| Pre-recorded teacher line | Effectively free after generation (CDN) |
| Resume Roast | 2 model calls on first roast; the score pass is cached afterwards |

The Gemini key hit 429 at about 16 calls per minute during the roast eval. Watch provider quota
before any launch. See [Known issues](08_KNOWN_ISSUES.md).
