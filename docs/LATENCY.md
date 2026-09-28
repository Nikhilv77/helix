# Latency

Last updated: September 28, 2026

How to measure latency in Trailgrad, the production baseline to fill in, what is still open, and
the lessons from the work so far. The history of each change is in [CHANGELOG.md](CHANGELOG.md).

## Reading the timings

Every Practice and DSA action is wrapped by `timeAction` in `src/server/http/action-timing.ts`:

- **Server logs:** each request logs `api.action_timing` with `action`, `status`, and
  `durationMs`. Actions taking 2 s or more log as warnings. In Vercel, filter by
  `api.action_timing`.
- **Browser:** each response carries a `Server-Timing` header. In DevTools → Network, select the
  request and open **Timing**.

| Action name | Covers |
| --- | --- |
| `practice.<track>/<action>` | Every Core Technical, Applied Engineering, Architecture & Design, and story-track action, e.g. `practice.core-technical/attempt`, `practice.ai-ml/learn` |
| `practice.architecture-design/canvas.get` / `.put` | Canvas reads and autosaves |
| `dsa.code-run` | DSA, Core Technical assessment, and block-assessment code runs |
| `dsa.practice-feedback` | Daniel's feedback after an accepted run |
| `dsa.question-attempt.<open\|submit\|complete\|skip>` | DSA progress writes |
| `dsa.block-assessment.start` / `.skip` | DSA block assessments |

Other areas log their own lines: `resume_roast.generation` (duration and provider per pass),
`help.request.*`, and `*_fresh_wait_exceeded` for Progress and Reports.

Local timings are not representative: a laptop in Mumbai reaches the us-east-2 database at about
215 ms per round trip. Production functions (`iad1`) sit next to the database. Take baselines
from production.

## Production baseline

Fill in after a few days of real traffic. Record p50 and p95.

| Action | p50 | p95 | Requests | Date |
| --- | --- | --- | --- | --- |
| `practice.core-technical/assessment/finalize` | | | | |
| `practice.core-technical/attempt` | | | | |
| `practice.ai-ml/attempt` | | | | |
| `dsa.code-run` | | | | |
| `dsa.practice-feedback` | | | | |
| `dsa.question-attempt.complete` | | | | |
| `resume_roast.generation` | | | | |
| Voice interview turn (not instrumented yet) | | | | |

## Where the time goes today

Measured during the September work, before the production baseline.

| Action | Typical wait | What it waits on |
| --- | --- | --- |
| Open a DSA question | One round trip | Question bank in memory; progress reads in parallel |
| DSA code run | 0.7–1.0 s | Judge0 with `wait=true` (one blocking call beats submit-and-poll here) |
| DSA feedback after an accepted run | About 2 s | Gemini fast, hedged after 4 s |
| Core Technical / Applied Engineering code run | 1.8–2.8 s | One Vercel Sandbox for check and tests |
| Written-answer grading (all tracks) | 1.8–2.7 s | Gemini fast, hedged after 5 s, 12 s × 2 attempts, then Groq |
| Start a Core Technical path | 0.3 s | Reviewed version, no generation |
| Assessment finalize | One transaction | Grading runs after the response; the page polls every 5 s |
| Story-track assessment grading | 2–5 s | Gemini-then-Groq fallback |
| Resume Roast | About 4–5 s on a healthy Gemini | Score and roast passes in parallel |
| Resume analysis (onboarding) | Varies; 52 s budget | Gemini, hedged after 12 s with the reasoning model |
| Pre-recorded teacher line | About 0.1 s | CDN |
| Live teacher line | About 1 s to first audio (Deepgram) | TTS provider |

## Open items

| Item | Why | Status |
| --- | --- | --- |
| Audit live voice interviews | The most latency-sensitive and expensive feature; turn latency, reconnects, and cost per session are not measured | Next |
| Instrument voice turns | No timing log covers speech-end → decision → first audio | With the audit |
| Stream or show progress for AI-graded answers | Written grading and DSA feedback still show a silent wait of about 2 s (longer when hedged) | Todo |
| Overview and Progress rebuild after every answer | The rebuild runs after the response and is coalesced per user, so learners do not wait. Revisit with a queue if `*_rebuild_slow` or database load grows | Watching |
| Trailmate helper matching | Scores every eligible profile per request (about 1.3 ms each on dev) | At 1,000–2,000 users |

## Lessons

- **Hedge stalled model calls.** About 1 in 5 `gemini-flash-lite-latest` calls stalled with no
  answer. A second identical request after a few seconds (`hedgeAfterMs`) fixed the tail: 9 of
  10 calls at 1.6–2.3 s, the stalled one at 5.9 s.
- **Cap every AI attempt.** Uncapped retries turned a stall into 60–90 s waits.
- **Keep generation off the request path.** Live generation of practice paths took 40–80 s and
  failed under a Gemini outage. Reviewed content plus background work is faster and cannot block
  the learner.
- **Groq is a weak fallback for large structured output.** It failed schemas and hit per-request
  size limits on path generation and resume extraction. Use another Gemini model there.
- **Grade after the response.** Save a claim, respond, grade in `after()`, and let the page poll.
- **Pre-record fixed speech.** Live TTS took 7–9 s per line; recorded lines take 0.1 s and cost
  nothing per play.
- **Reply from the row you already read.** Re-reading after a write cost a round trip on every
  click.
- **Measure before rewriting.** Judge0 already answered in under a second, so an async
  submit-and-poll rewrite would have made it slower.
