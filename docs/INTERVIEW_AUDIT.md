# Interview audit

Audited September 28, 2026, from the code and the dev database (read-only). Nothing has been
changed yet. Covers `/interviews`, every round, the live voice room, per-turn processing,
evaluation, reports, and how each role (backend, full-stack, frontend, data, AI/ML) is served.

## How the interviews actually work today

| # | Round | Interviewer | Length | Built from | Shown to |
| --- | --- | --- | --- | --- | --- |
| 1 | Resume & Behavioral Defense | James | 24 min cap (card says 30), 8 questions | Resume kit (AI, generated on first start) + fixed prompts | Everyone |
| 2 | Core Technical & Projects | Claire | 40 min, 7 questions | 3 MCQs (kit, topped up from a bank), 3 project questions, 1 coding task | Everyone |
| 3 | DSA Interview | Claire | 35 min, 2 problems | Problems the learner already solved (needs 10) | Everyone except AI/ML |
| 4 | System Design | Claire | 45 min, 5 stages | Authored Architecture scenarios | Everyone |
| 5 | Hiring Manager & Final Behavioural | James | 30 min cap, 8 questions | Fixed agenda with resume names filled in | Everyone |

- All five rounds are **Gemini-led**: Gemini Live hears the candidate, calls
  `complete_interview_turn`, the server saves the turn and returns the approved line, and Gemini
  speaks it.
- Answer grading is **deferred**: each turn queues an `InterviewEvaluationJob`, graded after the
  response by Groq (`gpt-oss-20b`) with Gemini as fallback.
- Limit: 2 round starts per rolling 24 hours. Resuming an open round is free.
- The personalised plan's `final-mock` blueprint is generated but never used. The plan mainly
  feeds round 2's topics and some titles.

`INTERVIEW_ENGINE.md` still describes six sessions and a Final Mock; that is out of date.

## By role

| Role | Rounds | Problems |
| --- | --- | --- |
| Backend | 5 | Technical round's fallback MCQs include browser questions |
| Full-stack | 5 | None specific |
| Frontend | 5 shown | **System Design always fails to start** (no frontend scenarios). Fixed: frontend scenarios built |
| Data | 5 shown | **System Design always fails to start**; fallback MCQs are networking/browser; no data-specific content (SQL, pipelines) anywhere. Fixed: data pipeline scenarios built; SQL and data MCQs still missing |
| AI/ML | 4 (no DSA) | Technical fallback MCQs are the same questions as AI/ML Practice |

## Status

| Phase | Items | State |
| --- | --- | --- |
| 1 | H1, H4, M1 | Done September 28 (uncommitted); needs a live test longer than 10 minutes |
| 2 | H2 (quick fix), H3, M3, M8, plus H0 found while fixing M3 | Done September 28 (uncommitted); needs a live round |
| 3 | M4, M5, M6, M7 | Done September 28 (uncommitted); Frontend and Data System Design built; new question banks still need writing |
| 4 | M2 | Done September 28 (uncommitted); re-run the live eval once Gemini quota allows |
| 5 | L1–L7 | Done September 28 (uncommitted); L4 and L7 deliberately deferred |

## Findings

Severity: **High** hurts learners in normal use; **Medium** noticeable or unfair; **Low** debt.

### High

**H0. The interviewer's instructions never reached Gemini.** *Found and fixed September 28 while
working on M3.* A Live token with `liveConnectConstraints` locks every setting, so the system
instruction, context compression, and transcription settings the browser sent were silently
ignored. A live test confirmed it: with the instruction sent by the browser the model answered
"call me Gemini"; with it locked into the token it followed the instruction. Every round was
running without its persona, plan, or rules, steered only by per-turn tool responses, and without
context compression (so audio sessions were capped at about 15 minutes). All of these are now set
in the token.

**H1. Live voice drops every ~10 minutes and needs a manual reconnect.** *Fixed September 28.*
Google limits a Live connection to about 10 minutes and expects the client to reconnect with a
session-resumption handle; the ephemeral token also stops accepting messages at `expireTime`
(set to at most 29 minutes here). The client enables `sessionResumption` but never stores the
handle from `sessionResumptionUpdate` and never handles `goAway`. When the socket closes, the
learner sees "The live interviewer disconnected" and must press reconnect, which starts a brand
new Gemini session primed with the last 12 turns. Rounds last 30–45 minutes, so most rounds will
drop at least once, and the 45-minute System Design round will also hit the token expiry. There is
also a reported regression on `gemini-3.1-flash-live-preview` where connections close without a
`goAway`.
*What was done:* resuming with a handle loses the conversation under ephemeral tokens (an open
Google issue), so the client rotates instead. Every 8 minutes, on `goAway`, or when the socket
closes unexpectedly, it asks the token route for a `rotation` credential (fresh token, saved
history, silent start) and swaps to the new connection at the next pause. A reply saved just
before a drop, or an unheard opening, is spoken on the new connection. The error only appears
after three failed attempts.

**H2. System Design is broken for Frontend and Data learners.** *Quick fix done September 28.*
The card and entry page show it as ready, but `architectureDesign.focus.confirm` throws
`ARCHITECTURE_DESIGN_ROLE_UNSUPPORTED` for those roles; the catalogue has only backend/full-stack
and AI/ML scenarios.
*Done:* the round is hidden for these roles (and for learners with no declared role), the cards
renumber, and `/interview/design` redirects to `/interviews`.
*Frontend built September 28:* six client-architecture scenarios with frontend acts, Live rules,
and report labels; the round is shown again for Frontend. *Data built the same day* with six
pipeline scenarios, data acts, Live rules, and report labels.

**H3. Skipped and unanswered questions do not lower the score.** *Fixed September 28.*
The headline score averages only answered, graded questions. Declining, skipping, or ending early
removes a question from the average. Dev data: a System Design round scored 55/100 with 1 of 5
stages answered; a DSA round 57/100 with 1 answered. A human interviewer would not score that way.
*Done:* the score is now answer quality times the share of counted questions answered. A
declined question counts; so do questions never reached when the candidate ended before time ran
out. Pacing skips and questions cut off by the clock do not. Reports show "1 of 5 questions
answered · unanswered ones count as zero". Practice checkpoints are unchanged. Reports saved
earlier keep their old score.

**H4. A turn can fail mid-interview with "Reload the session".** *Fixed September 28.*
Two causes:
- A queued evaluation writes its result back to the live session and bumps its version. If that
  lands while a turn is being saved, the turn fails with `SESSION_VERSION_CONFLICT` and the turn ID
  is marked conflicted, so it cannot be retried.
- The browser never retries a failed turn: a network blip, a 5xx, or the retryable
  `ANSWER_IN_PROGRESS` shows an error.

*What was done:* the server replays the turn on the fresh state (up to twice) when the
conversation itself did not change; the browser retries network errors, timeouts (20 s per
attempt), 5xx, and busy 409s with the same turn ID, so a retry can never save an answer twice.

### Medium

**M1. Reports can stay partly "Not scored" for hours, and the notification score is wrong.** *Fixed September 28.*
When a round ends, only 5 of its queued evaluations are graded immediately. Failed ones retry at
1 min, 5 min, 30 min, and 2 h, but only when some other request triggers a batch or the daily cron
runs. The "report ready" notification is written in the same transaction that ends the round,
before the last answers are graded, and is never updated. Dev data shows a notification saying
20/100 for a report that now reads 86/100.
*What was done:* a finished round grades up to 20 queued answers in parallel (applied one at a
time); the notification says the score is still being worked out while any answer is ungraded,
and each applied grade rewrites it until it shows the final score; opening Reports works the
retry queue in the background.

**M2. Interview scores are the model's number, unlike Resume Roast.** *Fixed September 28.*
The evaluator returns a 0–100 score that code only bounds by verdict. It runs on Groq's 20B model
at temperature 0.1 with no seed, and the same question is regraded after every follow-up.
*Done:*
- The model now rates each parameter on an anchored 1–5 scale (5 exceptional … 1 absent or wrong)
  with evidence, plus a correctness verdict. Code turns levels into scores (94, 78, 55, 30, 10),
  averages them, then applies the verdict and test caps to the answer and to every parameter.
- On questions without a targeted parameter list the model may mark a parameter as not asked;
  it is left out instead of dragging the score down.
- Temperature 0 and a fixed seed; prompt version `evaluator-v8-anchored-levels`.
- Background grading uses Gemini's reasoning model (15 s), falling back to Groq (8 s).
- An answer to a still-open question waits 10 minutes before grading; the closing turn replaces it
  and runs at once, and ending the round releases any waiting jobs. Each question is normally
  graded once.
- Live check on September 28: a strong index explanation scored 82 (mostly correct); a wrong one
  13. A vague but true answer scored 15, which is too harsh; the guide now says shallow is a 2 and
  "insufficient evidence", not "incorrect". Re-check with `pnpm interview:quality` once the dev
  Gemini quota recovers (it returned 503 and 429 during testing).

**M3. Rubrics and the design reference answer are sent to the browser.** *Fixed September 28.*
The token route returns the full system instruction, including every question's `mustHit` list
and, for System Design, the private reference answer. The session GET deliberately hides the
design guide, so this contradicts it. The instruction is also not locked into the ephemeral
token, so it can be edited before connecting.
*Done:* the instruction (with its rubric and private guide) is locked into the token and no
longer returned. The session GET still shows each question's "expects" list outside System
Design; that is a deliberate hint in the room, not a leak.

**M4. The same content repeats across rounds and practice.** *Fixed September 28.*
- Resume & Behavioral and Hiring Manager both ask for the career story, the proudest project, and
  a mistake or setback.
- The first resume project is used in Resume, Technical, and Hiring Manager rounds.
- Kit MCQs can appear in both the Resume and Technical rounds.
- AI/ML Technical fallback MCQs are the AI/ML Practice questions.
- System Design scenarios come from the Architecture Practice bank; a learner who practised one
  can get the same scenario, with the same reference answer.
- DSA uses only problems the learner already solved, which tests recall rather than solving.

*Done:*
- Hiring Manager now asks about career direction, what gives and drains energy, learning something
  unfamiliar fast, uncertainty, conflict, a mistake, feedback, and the close. No project deep dive.
- Resume & Behavioral's behavioural question is about changing approach on the resume's own work;
  mistakes and setbacks belong to Hiring Manager.
- The Technical round uses a different project from the first one on the resume when another is
  still relevant.
- The Resume round leaves the kit's multiple choice checks to the Technical round.
- AI/ML Technical fallback questions the learner already answered in Practice go last.
- System Design skips scenarios the learner started in Architecture Practice, then past interview
  scenarios, before repeating anything.
- DSA pairs one solved problem with an unseen one from the same pattern (or another practised
  pattern), graded with the bank's tests.

**M5. Technical fallback questions ignore the role and are identical for everyone.** *Fixed September 28.*
The kit supplies at most two MCQs, so the third always comes from the fundamentals bank, whose
area order is written for frontend (networking, browser, databases, systems) and is not shuffled
here.
*Done:* areas are ordered by role (backend and data lead with databases; data gets no browser
questions) and shuffled. Still to do: write data-engineering MCQs for the bank.

**M6. Behavioural questions ignore level.** *Fixed September 28.*
A fresher is asked why they are "considering a move now", about a disagreement with their manager,
and for "the difficult decision that demonstrates your level".
*Done:* fresher versions of the career, responsibility, conflict, feedback and learning questions,
and an interviewer note that college, internship and personal work is valid evidence.

**M7. The first Resume or Technical round waits on an AI call.** *Fixed September 28.*
Onboarding stores `interviewKit: null`; the kit is generated during the first round start with the
fast model and no hedge. It is also not regenerated when the target role changes. The comment in
`resume-round.ts` saying it was written when the resume was read is out of date.
*Done:* the kit is written in the background after onboarding and after a resume update, records
the role and level it was written for, and is rewritten when either changes. The generic fallback
kit is no longer stored, so a failed generation is retried by the next round.

**M8. `/interviews` card states are misleading.** *Fixed September 28.*
- Hiring Manager never shows "in progress" or "Completed"; its card is built as a placeholder.
- When the daily limit is used, every card says "Coming soon" instead of "Daily limit reached,
  next round available at 14:20".
- Two starts a day means the full loop takes three days. That is a cost decision; show it clearly.

*Done:* Hiring Manager shows progress and completion; with the limit used, cards say "Daily limit
reached" and the page says when the next round opens, in the learner's own time. The entry pages
still say "unlocks tomorrow" (rolling window); tidy in cleanup.

### Low

- **L1.** A new resume does not refresh the interview plan until the next practice or interview
  activity (`matchesInputsExceptResume`). Progress is matched by round kind, so regenerating is safe.
- **L2.** Dead or orphaned paths: the `final-mock` blueprint; `/api/interview/start` and the AI
  planner (only the retired setup screen calls them, but the route is live); `/interview/fundamentals`
  (unlinked, still uses quota); about 300 commented-out LiveKit lines in `voice-interview-client.tsx`.
- **L3.** Heavy reads: launching a round and rebuilding `/interviews` load up to 50 full session
  states (about 25 KB each, 1.3 MB). Use the report snapshot or select only what is needed. Ending a
  round runs all five practice finalizers regardless of round type.
- **L4.** Microphone capture uses the deprecated `ScriptProcessorNode` on the main thread; move to an
  `AudioWorklet` to avoid glitches on slower devices.
- **L5.** Transcription languages are fixed to `en-IN` and `hi-IN`. Fine for India; revisit for other
  markets.
- **L6.** The Resume card says 30 minutes but the round is capped at 24.
- **L7.** The daily-limit check is count-then-create, so two different round types started at the
  same instant could exceed it by one.

### Phase 5 results

- **L1:** kept on purpose. A resume update alone keeps the current plan so a resume edit does not
  reshuffle rounds in progress; the next practice or interview result regenerates it. Now
  documented in the code.
- **L2:** deleted the retired setup screen, its template catalogue, `/api/interview/start`, and the
  Fundamentals entry route and screen (the old page redirects to `/interviews`); removed about 300
  commented-out LiveKit lines from the voice room. The unused `final-mock` blueprint stays: dropping
  it would need a schema change and it costs nothing.
- **L3:** opening a round now finds an unfinished room with one filtered query instead of loading
  the last 50 full sessions (checked against all 21 dev sessions).
- **L4:** deferred. Moving microphone capture to an `AudioWorklet` needs a live audio test.
- **L5:** unchanged (`en-IN` and `hi-IN`), fine for the current market.
- **L6:** the Resume card now says 24 minutes, and every interviewer instruction states its round's
  real cap. Entry pages no longer say the next round "unlocks tomorrow".
- **L7:** left as is; the race can exceed the daily limit by at most one round.
- `INTERVIEW_ENGINE.md` rewritten to match the code.

## What is already solid

- One-turn-ID idempotency with replay, creation leases, and resuming open rooms without using quota.
- Server-owned state machine with time caps; the model cannot advance the interview on its own.
- Deterministic MCQ grading; unavailable evaluations are excluded rather than guessed.
- Durable evaluation queue with retries and dead-lettering.
- Private design guides hidden from the session GET (only the token route leaks them, see M3).
- No model call on the turn path in Gemini-led rounds, so server time per turn is only database work.

## Latency and cost per turn

What a candidate waits for after they stop talking: about 0.9 s of silence detection, Gemini's tool
call, the `/api/interview/decide` round trip (database writes only), then Gemini speaking the
approved line. Probably 2–4 s, but nothing measures it end to end. `interview.decision` logs the
server part (`turnDurationMs`); add a client-side "speech end → first audio" timing before tuning.

Cost is dominated by Gemini Live minutes (about $0.68 per session from the earlier estimate).
Grading adds one Groq call per turn, more when a question has follow-ups (see M2).

## Suggested order

| Phase | Items | Size |
| --- | --- | --- |
| 1. Make rounds reliable | H1, H4, M1 | 2 days |
| 2. Make scores fair and honest | H3, M3, M8, H2 quick fix | 1 day |
| 3. Better content per role | M4, M5, M6, M7 | 3–4 days, plus content writing for H2 |
| 4. Scoring like a human | M2 | 1–2 days |
| 5. Cleanup | L1–L7, update `INTERVIEW_ENGINE.md` | 1 day |
