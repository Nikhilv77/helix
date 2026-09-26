# Practice Latency Optimization

Last updated: September 26, 2026

This document tracks latency work on the Practice tracks: what each user action waits on,
what has been optimized, and what is left. Update the status column and the log at the end
whenever an item changes.

The inventory below comes from reading the code, not from measurements. Replace the cost
estimates with measured p50/p95 timings once endpoint timing logs exist (see item 0.1).

## Reading the timings

Every Practice action is wrapped by `timeAction` in `src/server/http/action-timing.ts`:

- **Server logs:** each request logs `api.action_timing` with `action`, `status`, and
  `durationMs`. Actions taking 2 seconds or more log as warnings. In Vercel, filter logs by
  `api.action_timing`.
- **Browser:** each response carries a `Server-Timing` header. In DevTools → Network, select
  the request and open **Timing** to see the server duration next to the network time.

Action names:

| Name | Covers |
| --- | --- |
| `practice.<track>/<action>` | Every Core Technical, Applied Engineering, Architecture & Design, and story-track action, for example `practice.core-technical/attempt` or `practice.ai-ml/learn` |
| `practice.architecture-design/canvas.get` / `.put` | Canvas reads and autosaves |
| `dsa.code-run` | DSA, Core Technical assessment, and block-assessment code runs |
| `dsa.practice-feedback` | Daniel's feedback after an accepted run |
| `dsa.question-attempt.<open\|submit\|complete\|skip>` | DSA progress writes |
| `dsa.block-assessment.start` / `.skip` | DSA block assessments |

Local timings are not representative: a Mumbai laptop reaches the Ohio development database
at about 217 ms per round trip. Take the baseline from production, where the functions (`iad1`)
and the database (`us-east-2`) are in neighbouring regions.

## Baseline (production)

Fill in after deploying 0.1 and collecting a few days of traffic. Record p50 and p95.

| Action | p50 | p95 | Requests | Date |
| --- | --- | --- | --- | --- |
| `practice.core-technical/assessment/finalize` | | | | |
| `practice.core-technical/attempt` | | | | |
| `practice.ai-ml/attempt` | | | | |
| `dsa.code-run` | | | | |
| `dsa.practice-feedback` | | | | |
| `dsa.question-attempt.complete` | | | | |

## Legend

| Symbol | Meaning |
| --- | --- |
| 🔴 | The user waits seconds (AI model call, code runner, or sandbox startup) |
| 🟡 | Roughly a second (several database round trips or a transaction) |
| 🟢 | A few quick database calls |
| **+ refresh** | After responding, the request rebuilds the Practice page snapshot and the Overview/Progress snapshot. The user does not wait, but the server does the work. |
| AI (fast) | One Gemini call on the fast model class |
| AI (reasoning) | One Gemini call on the reasoning model class |

Status values: `todo`, `in progress`, `done`, `won't do` (with a reason).

## 0. Cross-cutting work

| # | Item | Why | Status |
| --- | --- | --- | --- |
| 0.1 | Add timing logs (duration, route, action, outcome) to every Practice action endpoint | Establish a measured baseline before optimizing; compare after each change | done (baseline pending) |
| 0.2 | Decide whether Overview/Progress should rebuild on visit instead of after every answer | Every submit, learn, and continue currently rebuilds both snapshots | won't do for now: the rebuild runs after the response and is coalesced per user (0.4). Rebuilding on visit would show the learner old progress on their next Overview visit. Revisit with a queue if `*_rebuild_slow` or database load grows. |
| 0.3 | Remove extra re-reads after writes (return the updated row from the write) | Several actions read the question again after saving it | done for story tracks (5.3, 5.4, 5.5–5.7); Core Technical, Applied Engineering, and Architecture draft/hint still re-read (todo) |
| 0.4 | Coalesce concurrent Practice page rebuilds per user | Overlapping answers each started a full rebuild | done |
| 0.5 | Run the rate limit and lock checks in one parallel Upstash round trip | Saved one sequential Redis call per request | done (`interview/decide`, `code/run`, `voice/speak`) |
| 0.6 | Read the profile and spend the rate limit in parallel | Every Practice action did a database read, then a Redis call | done (`route-kit` owner helpers and story-track `_shared`) |
| 0.7 | Autosave drafts after 1 s instead of 0.6 s | Drafts are the most frequent Practice write; the response is not used | done |
| 0.8 | Database triggers that mark snapshots dirty | Checked for per-write cost | won't do: they run inside Postgres in the same transaction (no network round trip). Interview turns re-mark the same rows, which collapse into one rebuild. |

## 1. DSA

Roles: backend, full-stack, frontend, data.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Open a question | Server page render | Question, tests, and progress reads | 🟡 | todo | |
| 1.2 | Run code | `POST /api/code/run` | Rate limit + lock, Judge0 with `wait=true`, then save the run | 🔴 | todo | The request blocks until Judge0 finishes. The Python language lookup is already cached. |
| 1.3 | Teacher feedback after the first accepted run | `POST /api/dsa/practice-feedback` | Accepted-run and cache check (one parallel Redis trip), rate limit, AI (fast) with a hedged second request | 🔴 | done | Healthy calls take ~2 s; ~1 in 5 stalled with no answer and used to hold the 30 s timeout (up to 60 s with retries). A second request now races after 4 s. The voice starts ~1 s after the text (Deepgram first audio). |
| 1.4 | Record solved after the first accepted run | `POST /api/roadmap/question-attempt` (`complete`) | Roadmap transaction that recalculates session and chapter totals, + refresh | 🟡 | todo | The client then calls `router.refresh()`, which re-renders the whole page. |
| 1.5 | Skip | `POST /api/roadmap/question-attempt` (`skip`) | Same transaction, + refresh | 🟡 | done | Navigation no longer waits for the write (~17 sequential round trips recalculating the roadmap). The next question opens at once; the write finishes in the background with `keepalive` and two idempotent retries. The last question still waits and rolls back on failure. |
| 1.6 | Start block assessment | `POST /api/interview/dsa/block-assessment/start` | Creates an interview session | 🟡 | todo | |
| 1.7 | Skip block assessment | `POST /api/interview/dsa/block-assessment/skip` | Answer path + finalization | 🟡 | todo | |

## 2. Core Technical (Node.js)

Roles: backend, full-stack. API prefix: `/api/practice/core-technical`.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Confirm focus | `confirm` | Full profile read, eligibility query, write | 🟡 | todo | |
| 2.2 | Prepare / start path | `prepare`, `start-path` | Full profile, eligibility, AI (reasoning) story-candidate generation with a Groq fallback, runner audit of each executable question, transaction with owner lock, + refresh | 🔴 | in progress | Runner audits now share one sandbox per question, run in parallel, and a passing audit is cached per server instance. The AI failure is still open (K1). |
| 2.3 | Draft autosave | `draft` | Transaction | 🟢 | todo | Fires often while typing. |
| 2.4 | Reveal hint | `hint` | Transaction | 🟢 | todo | |
| 2.5 | Run code | `run` | Transaction, then one Vercel Sandbox for the syntax check and the tests, then save the result | 🔴 | done | Was two sandboxes per run, each waiting ~4 s for shutdown. Measured 11.8–13.1 s → 1.8–2.8 s. |
| 2.6 | Submit a choice or code answer | `attempt` | Graded without AI, transaction, + refresh | 🟡 | todo | |
| 2.7 | Submit a written answer | `attempt` | AI (fast) grading, transaction, + refresh | 🔴 | won't do | Grading on `gemini-3.5-flash-lite` takes ~1.5 s and uses no thinking tokens; setting a minimal thinking level measured the same. |
| 2.8 | Learn instead | `learn` | Transaction, + refresh | 🟡 | todo | |
| 2.9 | Continue to the next path | `continue` | Several reads and writes, runner audit of new questions, + refresh | 🟡 | in progress | Benefits from the audit changes in 2.2. |
| 2.10 | Start assessment | `assessment/start` | Creates or resumes an interview session | 🟡 | todo | |
| 2.11 | Finish assessment | `assessment/finalize` | Claim transaction; AI (reasoning) grading now runs after the response | 🟡 | done | Responds after saving the claim; grading runs in `after()` and the page refreshes every 5 s until the report lands. Retry appears after 3 min or on error. |

## 3. Applied Engineering (Node.js)

Roles: backend, full-stack. API prefix: `/api/practice/applied-engineering`. Same structure as
Core Technical.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1 | Confirm focus | `confirm` | Full profile read, eligibility query, write | 🟡 | todo | |
| 3.2 | Prepare / start path | `prepare`, `start-path` | Full profile, eligibility, ranking, transaction with owner lock, + refresh | 🟡 | todo | |
| 3.3 | Draft autosave | `draft` | Transaction | 🟢 | todo | |
| 3.4 | Reveal hint | `hint` | Transaction | 🟢 | todo | |
| 3.5 | Run code | `run` | One sandbox for check and tests, then transaction | 🔴 | done | Shares the Core Technical runner (2.5). |
| 3.6 | Submit a choice or code answer | `attempt` | Graded without AI, transaction, + refresh | 🟡 | todo | |
| 3.7 | Submit a written answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | won't do | See 2.7. |
| 3.8 | Learn instead | `learn` | Transaction, + refresh | 🟡 | todo | |
| 3.9 | Continue to the next incident | `continue` | Several reads and writes, + refresh | 🟡 | todo | |
| 3.10 | Start assessment | `assessment/start` | Creates or resumes an interview session | 🟡 | todo | |
| 3.11 | Finish assessment | `assessment/finalize` | Claim transaction; AI (reasoning) grading now runs after the response | 🟡 | done | Same as 2.11. |

## 4. Architecture & Design

Roles: backend, full-stack, AI/ML. API prefix: `/api/practice/architecture-design`.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Confirm / prepare / start path | `confirm`, `prepare`, `start-path` | Full profile, eligibility, ranking, transaction, + refresh | 🟡 | todo | |
| 4.2 | Draft autosave | `draft` | Transaction | 🟢 | todo | |
| 4.3 | Reveal hint | `hint` | Transaction | 🟢 | todo | |
| 4.4 | Canvas autosave | `GET`/`PUT canvas/:id` | Read or write the diagram document | 🟢 | won't do | Already debounced 800 ms, saves are queued in order, and a local copy is kept. |
| 4.5 | Knowledge check | `knowledge-check` | Graded without AI, write | 🟢 | todo | |
| 4.6 | Submit a design answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | won't do | See 2.7. |
| 4.7 | Learn / continue | `learn`, `continue` | Transaction, + refresh | 🟡 | todo | |
| 4.8 | Start assessment | `assessment/start` | Creates or resumes an interview session | 🟡 | todo | |
| 4.9 | Finish assessment | `assessment/finalize` | Claim transaction; AI (reasoning) grading now runs after the response | 🟡 | done | Same as 2.11. |

## 5. Story tracks: AI/ML, Frontend, Data

Roles: AI/ML, frontend, data. Each has Core Technical and Applied Engineering tracks.
All disciplines share the API prefix `/api/practice/ai-ml`; questions are owner-scoped by id.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 5.1 | Open a track (first visit) | Server page render | Creates the session and all questions in one transaction | 🟡 once | todo | Later visits use a lock-free read of the published session. |
| 5.2 | Open a question | Server page render | One query for the question and its path | 🟢 | todo | |
| 5.3 | Draft autosave | `draft` | Question read, then write | 🟢 | done | The response is built from the row already read. |
| 5.4 | Reveal hint | `hint` | Read, conditional write | 🟢 | done | Same as 5.3. |
| 5.5 | Submit a choice answer | `attempt` | Graded without AI, transaction with owner lock, + refresh | 🟡 | done | No re-read after the transaction. |
| 5.6 | Submit a written answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | done (re-read); AI won't do | See 2.7. |
| 5.7 | Learn instead | `learn` | Read, transaction, + refresh | 🟡 | done | No re-read. |

## Known issues

### K1. Core Technical "Preparing your personalised practice path" fails (open)

Seen in production on 2026-09-26 after onboarding as a backend engineer. The page shows
"We could not prepare the complete practice path. Nothing partial was saved; try again."

What happened (`POST /api/practice/core-technical/prepare`, 55,062 ms, status 503):

1. `core-technical-story-candidates` on Gemini `gemini-flash-latest` (reasoning) returned
   **503** on all three attempts (4.3 s, 8.6 s, 3.8 s).
2. The Groq fallback (`openai/gpt-oss-20b`) returned output that **did not match the schema**,
   then was **rate-limited with 429 (request-size)**: the request is larger than Groq's
   free-tier per-request token limit.
3. The request gave up after 55 s. Nothing partial was saved.

To investigate later:

- Whether Gemini's 503 was a transient outage or tied to the free tier / model version.
- Shrinking the candidate-generation prompt so the Groq fallback fits, or using a Gemini
  model as the fallback instead.
- Falling back to an already published story (`NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS`)
  when generation fails, so learners are never blocked.
- Moving generation off the request path (respond at once, prepare in the background, and
  poll), which also removes the 55 s wait.

### K2. Vercel Sandbox Node version no longer matched the runner pin (fixed)

Found on 2026-09-26 while measuring 2.5. Vercel's `node22` sandbox image reports `v22.22.2`,
but the runner pinned `22.23.2` and fails closed on a mismatch, so on Vercel every Core
Technical and Applied Engineering code run, and every runner audit during prepare/continue,
threw "Vercel Sandbox does not provide pinned Node.js 22.23.2".

Fixed on 2026-09-26 by re-pinning to `22.22.2`: `CORE_TECHNICAL_NODE_RUNTIME_VERSION`,
`CORE_TECHNICAL_RUNNER_VERSION` (`core-technical-nodejs-22.22.2-isolated-v1`), and the local
runner's `node` package in `package.json`. Saved runs keep the version they were graded on;
their schemas accept any version string. If Vercel moves `node22` again, runs fail closed
with the same message; re-pin to the version the sandbox reports.

## Priority order

1. ~~Assessment finalize (2.11, 3.11, 4.9)~~ — done on 2026-09-26.
2. AI-graded written answers (2.7, 3.7, 4.6, 5.6, 1.3): stream feedback or show progress
   instead of a silent wait.
3. ~~Code runners (2.5, 3.5)~~ — done on 2026-09-26. Judge0 (1.2) keeps `wait=true`: one
   blocking call is faster than submitting and polling.
4. Background work after writes (0.2, 0.3, 1.4): remove extra re-reads, the full page refresh
   after a DSA solve, and eager Overview rebuilds.

## Change log

| Date | Item | Change | Measured effect |
| --- | --- | --- | --- |
| 2026-09-26 | 1.5 | Skip navigates immediately; the roadmap write runs in the background and retries with the same request id | The click-to-next-question wait no longer includes the write |
| 2026-09-26 | 1.3, 2.7, 3.7, 4.6, 5.6 | Opt-in `hedgeAfterMs` on the Gemini provider: a second identical request races a stalled one. Used by DSA feedback (4 s) and written-answer grading (5 s). DSA feedback also caps attempts at 12 s × 2. | Raw `gemini-flash-lite-latest`: 8 of 10 calls ~2 s, 2 of 10 no answer after 40 s. Hedged: 9 of 10 at 1.6–2.3 s, the stalled one 5.9 s |
| 2026-09-26 | 1.3 | Feedback requires a runner-verified accepted run (recorded by `/api/code/run`) instead of trusting the request's pass count; the model names the praised lines for "A good part of your code"; the voice script says complexity in words | Closes free AI calls for unverified code |
| 2026-09-26 | 2.5, 3.5 | One sandbox per run for the syntax check and tests; shutdown handed to `after()` instead of awaited; runtime check overlaps the file upload | Real Vercel Sandbox from Mumbai: 11.8–13.1 s → 2.2–2.8 s per run |
| 2026-09-26 | 2.2, 2.9 | Runner audits share one sandbox per question, run in parallel, and passing audits are cached per instance | An uncached audit was 2 × (2 + mutants) sandboxes of ~6 s each |
| 2026-09-26 | 0.3, 5.3–5.7 | Story-track draft, hint, learn, and attempt render from the row already read | One fewer query per action |
| 2026-09-26 | 0.6 | Profile read and rate limit run in parallel for every Practice action | One sequential Redis round trip saved |
| 2026-09-26 | 0.7 | Draft autosave waits 1 s after typing stops | About half the draft requests while typing |
| 2026-09-26 | 2.7 | Measured grading latency with and without a minimal thinking level | ~1.5 s both ways; no change made |
| 2026-09-26 | K2 | Re-pinned the runner to Node 22.22.2, the version Vercel's `node22` sandbox runs | Real sandbox: runs accepted in 1.8 s; uncached question audit 7.0 s, cached 1 ms |
| 2026-09-26 | K2 | Logged: sandbox Node version no longer matches the pin | All Vercel code runs fail closed |
| 2026-09-26 | 0.4 | Practice page rebuilds coalesce per user on each server instance | Not measured |
| 2026-09-26 | 0.5 | `enforceAndAcquire` runs rate limit and lock in parallel | One Upstash round trip saved per call |
| 2026-09-26 | — | Inventory created | — |
| 2026-09-26 | K1 | Logged: Core Technical prepare fails when Gemini returns 503 and the Groq fallback is rate-limited | 55 s, then 503 |
| 2026-09-26 | 0.1 | `timeAction` logs and `Server-Timing` headers on all Practice and DSA actions | Baseline pending production deploy |
| 2026-09-26 | 2.11, 3.11, 4.9 | Finalize saves the claim and grades after the response; the page polls every 5 s. Track landing pages no longer wait for grading during render (recovery moved to `after()`). A call grades only if it made the FINALIZING claim or the claim is older than 3 minutes, so the room, the page, and Retry no longer grade the same assessment twice. A grading failure makes the claim immediately retryable. | Request no longer waits on the reasoning model (up to ~55 s with fallback); confirm with `practice.*/assessment/finalize` timings |
