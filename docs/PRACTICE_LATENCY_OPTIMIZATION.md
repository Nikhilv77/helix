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
| 2.1 | Confirm focus | `confirm` | Full profile read, eligibility query, write | 🟡 | done | Profile read and rate limit run together (0.6); eligibility is an in-memory check. |
| 2.2 | Prepare / start path | `prepare`, `start-path` | Full profile, eligibility, AI (reasoning) story-candidate generation with a Groq fallback, runner audit of each executable question, transaction with owner lock, + refresh | 🔴 | done | K1 fixed: the first path starts from its reviewed, critic-approved version. Measured 0.3 s, against 40-80 s for the live personalised chain (66 s when Gemini is overloaded, ending on this same path). |
| 2.3 | Draft autosave | `draft` | Transaction | 🟢 | done | One transaction read builds the reply; no read after commit. Autosave waits 1 s after typing stops. |
| 2.4 | Reveal hint | `hint` | Transaction | 🟢 | done | The hint count comes from the same read, and the reply reuses it: two round trips fewer. |
| 2.5 | Run code | `run` | Transaction, then one Vercel Sandbox for the syntax check and the tests, then save the result | 🔴 | done | Was two sandboxes per run, each waiting ~4 s for shutdown. Measured 11.8–13.1 s → 1.8–2.8 s. |
| 2.6 | Submit a choice or code answer | `attempt` | Graded without AI, transaction, + refresh | 🟡 | done | The reply is built from the row read in the transaction; no read after commit. |
| 2.7 | Submit a written answer | `attempt` | AI (fast) grading, transaction, + refresh | 🔴 | done | Grading measured at 1.8-2.7 s. Second request after 5 s, 12 s per attempt, 2 attempts. |
| 2.8 | Learn instead | `learn` | Transaction, + refresh | 🟡 | done | No read after commit. |
| 2.9 | Continue to the next path | `continue` | Several reads and writes, runner audit of new questions, + refresh | 🟡 | done | Starts from the reviewed path like 2.2, instead of the live personalised chain. |
| 2.10 | Start assessment | `assessment/start` | Creates or resumes an interview session | 🟡 | done | Profile read and rate limit run together; one lock call. The room speaks short pre-recorded lines per moment (opening, next question, next coding task, finish); follow-up questions are still read in full. |
| 2.11 | Finish assessment | `assessment/finalize` | Claim transaction; AI (reasoning) grading now runs after the response | 🟡 | done | Responds after saving the claim; grading runs in `after()` and the page refreshes every 5 s until the report lands. Retry appears after 3 min or on error. |

## 3. Applied Engineering (Node.js)

Roles: backend, full-stack. API prefix: `/api/practice/applied-engineering`. Same structure as
Core Technical.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1 | Confirm focus | `confirm` | Full profile read, eligibility query, write | 🟡 | done | Profile read and rate limit run together; eligibility is an in-memory check. |
| 3.2 | Prepare / start path | `prepare`, `start-path` | Full profile, eligibility, ranking, transaction with owner lock, + refresh | 🟡 | done | Preparation ranks reviewed incidents without AI. |
| 3.3 | Draft autosave | `draft` | Transaction | 🟢 | done | One transaction read builds the reply; no read after commit. Autosave waits 1 s after typing stops. |
| 3.4 | Reveal hint | `hint` | Transaction | 🟢 | done | The hint count comes from the same read: two round trips fewer. |
| 3.5 | Run code | `run` | One sandbox for check and tests, then transaction | 🔴 | done | Shares the Core Technical runner (2.5). |
| 3.6 | Submit a choice or code answer | `attempt` | Graded without AI, transaction, + refresh | 🟡 | done | The reply is built from the row read in the transaction; no read after commit. |
| 3.7 | Submit a written answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | done | Grading measured at 1.8-2.3 s. Now hedged after 5 s and capped at 12 s x 2 attempts (it had neither). |
| 3.8 | Learn instead | `learn` | Transaction, + refresh | 🟡 | done | No read after commit. |
| 3.9 | Continue to the next incident | `continue` | Several reads and writes, + refresh | 🟡 | done | Moves to the next reviewed incident without AI. |
| 3.10 | Start assessment | `assessment/start` | Creates or resumes an interview session | 🟡 | done | Moved from the Gemini Live voice room to the typed assessment room shared with Core Technical and Architecture (`/practice/applied-engineering/assessment`): short pre-recorded lines per moment, follow-ups read in full, no per-minute Live cost. |
| 3.11 | Finish assessment | `assessment/finalize` | Claim transaction; AI (reasoning) grading now runs after the response | 🟡 | done | Same as 2.11. |

## 4. Architecture & Design

Roles: backend, full-stack, AI/ML. API prefix: `/api/practice/architecture-design`.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Confirm / prepare / start path | `confirm`, `prepare`, `start-path` | Full profile, eligibility, ranking, transaction, + refresh | 🟡 | done | Preparation ranks reviewed scenarios without AI; profile read and rate limit run together. |
| 4.2 | Draft autosave | `draft` | Transaction | 🟢 | done | One transaction read builds the reply; no read after commit. |
| 4.3 | Reveal hint | `hint` | Transaction | 🟢 | done | The hint count comes from the same read: two round trips fewer. |
| 4.4 | Canvas autosave | `GET`/`PUT canvas/:id` | Read or write the diagram document | 🟢 | won't do | Already debounced 800 ms, saves are queued in order, and a local copy is kept. |
| 4.5 | Knowledge check | `knowledge-check` | Graded without AI, write | 🟢 | done | Graded without AI in one write. |
| 4.6 | Submit a design answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | done | Grading measured at 1.8-2.0 s. Now hedged after 5 s and capped at 12 s x 2 attempts (it had neither). |
| 4.7 | Learn / continue | `learn`, `continue` | Transaction, + refresh | 🟡 | done | Learn replies without a read after commit. |
| 4.8 | Start assessment | `assessment/start` | Creates or resumes an interview session | 🟡 | done | Shares the Core Technical assessment room: short pre-recorded lines per moment; follow-ups read in full. |
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

### K1. Core Technical "Preparing your personalised practice path" fails (fixed 2026-09-27)

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

## DSA end to end (2026-09-26)

DSA is shared by the backend, full-stack, frontend, and data roles, so every change below
applies to all four. AI/ML has no DSA; its story tracks replace it. Changes marked
**(all tracks)** also reach Core Technical, Applied Engineering, Architecture, and the
AI/ML, frontend, and data story tracks.

None of these changes needs a database migration.

### Question page

| Step | What changed | Effect |
| --- | --- | --- |
| Back arrow | Goes to `/practice/dsa` (DSA practice) instead of the old `/dsa-questions` library. The "question not found" page and the "DSA practice" search result also point there. The old library page and route remain, unlinked except for the "Open question library" button on DSA practice. | Back from a question, including one opened from Progress, returns to DSA practice. |
| Back buttons **(all tracks)** | The arrow becomes a small spinner while the destination loads (`BackLinkIcon`, using Next.js `useLinkStatus`). It appears only after 120 ms, so fast navigations do not flicker. | A slow page no longer makes the click look ignored. |
| Review tab | Approaches, Common mistakes, Interview signals, Follow-up questions, and Key insight open and close with a smooth height and fade animation (the shared `.smooth-disclosure` CSS). | Chrome and Edge animate height; Safari fades; Firefox opens instantly; reduced-motion users get no animation. |
| Skip question | Moves to the next question immediately. The roadmap write (about 17 sequential database calls) finishes in the background with `keepalive` and two retries that reuse the same request id. The last question still waits and rolls back on failure. | Skip is instant instead of waiting for the write and then the next page. |

### Teacher feedback after an accepted run

| What changed | Why |
| --- | --- |
| Feedback is given only for code the runner accepted. `/api/code/run` records the accepted code (Redis, 6 hours); `/api/dsa/practice-feedback` returns 422 without that record. | The endpoint used to trust the browser's "all tests passed", so anyone could trigger AI calls for any code. |
| The model names the lines it praises, and the server checks they are real code. "A good part of your code" shows those lines, capped at six. | The old keyword heuristic usually showed the function header. |
| The spoken script says complexity in words ("O of n"). | Text-to-speech read "O(n)" symbol by symbol. |
| Hedged AI request: if no answer arrives in 4 s, a second identical request races the first; each attempt is capped at 12 s, two attempts. | About 1 in 5 calls to `gemini-flash-lite-latest` stalled with no answer, holding the modal for 30–60 s. Measured after: 9 of 10 calls took 1.6–2.3 s, and the stalled one took 5.9 s. |

The hedge is an opt-in `hedgeAfterMs` option on the Gemini provider. Written-answer grading
also uses it, hedging after 5 s **(all tracks)**.

### Ask a mate

| What changed | Why |
| --- | --- |
| The 10-minute request limit is spent only when at least one mate can be invited. A separate limit (6 per minute) bounds availability checks. | Before, finding nobody available still blocked the learner for 10 minutes. |
| Up to 150 best-ranked mates are invited. With 150 or fewer eligible, everyone is invited, as before. | Invitations grew with the user base. |
| Creating a request and claiming one run their independent reads in parallel. | Fewer sequential round trips. |
| The learner's waiting state refreshes on the workspace help poll's change signal, with a 60 s fallback, instead of its own 15 s poll. | Same responsiveness, fewer requests. |

Known limit: matching scores every user with help notifications enabled (all users by
default). That is fine at current scale; restrict it to online helpers when it grows.

### Block assessment (mastery checkpoint)

Scoring fixes. The coding problem's AI evaluation supplies 70% of the overall score, and three
bugs affected it:

1. **Metric names did not match.** The evaluator scores DSA parameters such as
   `approach-reasoning` and `complexity-scalability`; the report looked for
   `pattern-recognition`, `efficiency`, and `code-quality`. Only `communication` matched, so
   the other three always scored 0. Finalization now maps each metric to the closest
   evaluator score. Code quality uses the overall implementation score.
2. **The report could be written before the evaluation.** The evaluator had one second, so it
   usually became a background job, while the report was saved at once and never updated.
   Coding submissions are now graded before the response (up to 12 s). When an assessment
   ends, that session's queued evaluations run before the report is written (decide, skip,
   and end routes).
3. **Mixed score scales.** Some evaluations scored parameters out of 10. The prompt now
   requires 100, new evaluations are rescaled, and stored ones are rescaled when read.

Flow and voice:

- A coding submission ends that problem: no follow-up questions (`maxFollowUps: 0`), and no
  AI decider call, whose sentence was replaced by a fixed acknowledgement anyway.
- The teacher speaks a short pre-recorded line for each moment: opening, quick-check verdict,
  hand-off to coding, code submitted or skipped, and finished. The screen still shows the
  full feedback, explanation, and next question. The opening went from about 30 s of live
  speech to about 5 s. The 19 lines are recorded for all 8 teachers
  (`public/voice/`, 152 files) and play almost instantly at no per-play cost. Replay repeats
  what was said.

Old reports: `pnpm assessments:rescore:dev` and `pnpm assessments:rescore:production` rescore
completed assessments from their saved sessions. They are dry runs unless given
`-- --apply`, which first writes a backup of the replaced reports. Development had two
affected reports (25 → 55 and 20 → 51, applied). Production had no completed block
assessments on 2026-09-26.

### Code runners (Core Technical and Applied Engineering)

DSA itself runs on Judge0 and keeps its single blocking call. The Node.js runner used by
Core Technical and Applied Engineering changed:

- The syntax check and the tests share one Vercel Sandbox, and shutdown is no longer awaited.
  Measured on Vercel Sandbox: 11.8–13.1 s per run before, 1.8–2.8 s after.
- Question audits during prepare and continue share one sandbox per question, run in
  parallel, and passing audits are cached per server instance.
- The runner is pinned to Node **22.22.2**, the version Vercel's `node22` sandbox runs. The
  old 22.23.2 pin made every production code run fail closed. If Vercel changes the image,
  runs fail with "does not provide pinned Node.js …"; re-pin to the reported version in
  `runner-contracts.ts` and the `node` dependency in `package.json`.

Deployment notes for these changes are in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Change log

| Date | Item | Change | Measured effect |
| --- | --- | --- | --- |
| 2026-09-27 | — | Core Technical code submit skips the interviewer decider, as DSA does; the room labels each question by stage, confirms a skip or submit on the next question, and Resume shows a spinner | One model call fewer per code submit; no follow-up can hold the learner on a submitted task |
| 2026-09-27 | 3.10 | Applied Engineering assessments open the typed room instead of the Gemini Live voice room | Same room and voice as Core Technical and Architecture; no Live minutes |
| 2026-09-27 | 5.x | Story tracks (AI/ML, frontend, data) grade through the Gemini-then-Groq fallback; practice grading makes one capped Gemini attempt then falls back | During a Gemini slowdown (11-15 s per call measured), story answers timed out; now they reach Groq |
| 2026-09-27 | 5.1 | Plan-save transaction given 10 s wait / 20 s timeout | New frontend and data users' first Practice build failed with "Transaction already closed"; now succeeds |
| 2026-09-27 | 2.11, 3.11, 4.9 | Assessment graders state the 0-100 scale (Gemini never saw the schema bounds) | Prevents out-of-10 scores being stored as percentages |
| 2026-09-27 | 3.3-3.8, 4.2-4.7 | Applied Engineering and Architecture: draft, hint, answer, and Learn reply from the in-transaction read; written grading hedged and capped with the shared limits | Grading 1.8-2.3 s measured; one to two round trips fewer per click |
| 2026-09-27 | 2.2, 2.9 (K1) | First and next paths start from the reviewed version | 66 s (measured, overloaded Gemini) -> 0.3 s |
| 2026-09-27 | 2.3, 2.4, 2.6, 2.8 | Draft, hint, answer, and Learn reply from the in-transaction read | One to two round trips fewer per click |
| 2026-09-27 | 2.7 | Written grading capped at 12 s x 2 attempts, hedged after 5 s (shared grader, all story tracks) | Worst case ~25 s before fallback instead of 90 s |
| 2026-09-27 | 2.10 | Assessment room speaks short pre-recorded lines; follow-ups stay live | Speech starts at once; 80 new recordings |
| 2026-09-27 | UI (all tracks) | Previous/Next and row links show a spinner while loading; answer and transcript panels open smoothly | — |
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
