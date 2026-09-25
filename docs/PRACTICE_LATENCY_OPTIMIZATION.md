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
| 0.2 | Decide whether Overview/Progress should rebuild on visit instead of after every answer | Every submit, learn, and continue currently rebuilds both snapshots | todo |
| 0.3 | Remove extra re-reads after writes (return the updated row from the write) | Several actions read the question again after saving it | todo |
| 0.4 | Coalesce concurrent Practice page rebuilds per user | Overlapping answers each started a full rebuild | done |
| 0.5 | Run the rate limit and lock checks in one parallel Upstash round trip | Saved one sequential Redis call per request | done (`interview/decide`, `code/run`, `voice/speak`) |

## 1. DSA

Roles: backend, full-stack, frontend, data.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Open a question | Server page render | Question, tests, and progress reads | 🟡 | todo | |
| 1.2 | Run code | `POST /api/code/run` | Rate limit + lock, Judge0 with `wait=true`, then save the run | 🔴 | todo | The request blocks until Judge0 finishes. The Python language lookup is already cached. |
| 1.3 | Daniel's feedback after the first accepted run | `POST /api/dsa/practice-feedback` | Cache check, rate limit, AI (fast) | 🔴 | todo | Runs in the background behind a loading modal. |
| 1.4 | Record solved after the first accepted run | `POST /api/roadmap/question-attempt` (`complete`) | Roadmap transaction that recalculates session and chapter totals, + refresh | 🟡 | todo | The client then calls `router.refresh()`, which re-renders the whole page. |
| 1.5 | Skip | `POST /api/roadmap/question-attempt` (`skip`) | Same transaction, + refresh | 🟡 | todo | The UI updates optimistically, then navigates. |
| 1.6 | Start block assessment | `POST /api/interview/dsa/block-assessment/start` | Creates an interview session | 🟡 | todo | |
| 1.7 | Skip block assessment | `POST /api/interview/dsa/block-assessment/skip` | Answer path + finalization | 🟡 | todo | |

## 2. Core Technical (Node.js)

Roles: backend, full-stack. API prefix: `/api/practice/core-technical`.

| # | User action | API | Waits on | Cost | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Confirm focus | `confirm` | Full profile read, eligibility query, write | 🟡 | todo | |
| 2.2 | Prepare / start path | `prepare`, `start-path` | Full profile, eligibility, deterministic ranking (no AI), transaction with owner lock, + refresh | 🟡 | todo | |
| 2.3 | Draft autosave | `draft` | Transaction | 🟢 | todo | Fires often while typing. |
| 2.4 | Reveal hint | `hint` | Transaction | 🟢 | todo | |
| 2.5 | Run code | `run` | Transaction, then a new Vercel Sandbox for every run (1 vCPU), then save the result | 🔴 | todo | Sandbox startup is paid on every run. |
| 2.6 | Submit a choice or code answer | `attempt` | Graded without AI, transaction, + refresh | 🟡 | todo | |
| 2.7 | Submit a written answer | `attempt` | AI (fast) grading, transaction, + refresh | 🔴 | todo | |
| 2.8 | Learn instead | `learn` | Transaction, + refresh | 🟡 | todo | |
| 2.9 | Continue to the next path | `continue` | Several reads and writes, + refresh | 🟡 | todo | |
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
| 3.5 | Run code | `run` | New sandbox run, then transaction | 🔴 | todo | |
| 3.6 | Submit a choice or code answer | `attempt` | Graded without AI, transaction, + refresh | 🟡 | todo | |
| 3.7 | Submit a written answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | todo | |
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
| 4.4 | Canvas autosave | `GET`/`PUT canvas/:id` | Read or write the diagram document | 🟢 | todo | Frequent; check the debounce interval. |
| 4.5 | Knowledge check | `knowledge-check` | Graded without AI, write | 🟢 | todo | |
| 4.6 | Submit a design answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | todo | |
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
| 5.3 | Draft autosave | `draft` | Question read, write, then the question is read again | 🟢 | todo | Three round trips; see 0.3. |
| 5.4 | Reveal hint | `hint` | Read, conditional write, read again | 🟢 | todo | See 0.3. |
| 5.5 | Submit a choice answer | `attempt` | Graded without AI, transaction with owner lock, + refresh | 🟡 | todo | |
| 5.6 | Submit a written answer | `attempt` | AI (fast), transaction, + refresh | 🔴 | todo | |
| 5.7 | Learn instead | `learn` | Transaction, re-read, + refresh | 🟡 | todo | |

## Priority order

1. ~~Assessment finalize (2.11, 3.11, 4.9)~~ — done on 2026-09-26.
2. AI-graded written answers (2.7, 3.7, 4.6, 5.6, 1.3): stream feedback or show progress
   instead of a silent wait.
3. Code runners (1.2, 2.5, 3.5): reuse a warm sandbox and review Judge0's blocking wait.
4. Background work after writes (0.2, 0.3, 1.4): remove extra re-reads, the full page refresh
   after a DSA solve, and eager Overview rebuilds.

## Change log

| Date | Item | Change | Measured effect |
| --- | --- | --- | --- |
| 2026-09-26 | 0.4 | Practice page rebuilds coalesce per user on each server instance | Not measured |
| 2026-09-26 | 0.5 | `enforceAndAcquire` runs rate limit and lock in parallel | One Upstash round trip saved per call |
| 2026-09-26 | — | Inventory created | — |
| 2026-09-26 | 0.1 | `timeAction` logs and `Server-Timing` headers on all Practice and DSA actions | Baseline pending production deploy |
| 2026-09-26 | 2.11, 3.11, 4.9 | Finalize saves the claim and grades after the response; the page polls every 5 s. Track landing pages no longer wait for grading during render (recovery moved to `after()`). A call grades only if it made the FINALIZING claim or the claim is older than 3 minutes, so the room, the page, and Retry no longer grade the same assessment twice. A grading failure makes the claim immediately retryable. | Request no longer waits on the reasoning model (up to ~55 s with fallback); confirm with `practice.*/assessment/finalize` timings |
