# Changelog

What changed, newest first. Each release lists what a deploy needs (migrations, files to commit,
checks to run) under **Deploy notes**. Add an entry with every release.

## Unreleased: Frontend and Data System Design and Architecture Practice

- **Frontend and Data learners get Architecture & Design practice and the System Design
  interview.** Each role has six reviewed scenarios, four on the Practice path and two kept for
  the interview, so it has cases the learner has not practised.
  - Frontend: infinite social feed, typeahead search, offline field inspection app, design system
    rollout; interview-only: real-time chat client, product page performance.
  - Data: clickstream events into a warehouse, change data capture into a lakehouse, daily revenue
    with late data, data quality and lineage platform; interview-only: real-time fraud feature
    pipeline, A/B test metrics pipeline.
- **Each interview is run for its role.** The five acts, "listen for" lists, Live interviewer
  rules, and agenda treat the browser client (Frontend) or the pipeline and its tables (Data) as
  the system. Frontend rounds do not push the learner into databases or queues; Data rounds focus
  on contracts, table layout, late and duplicate data, idempotency, skew, quality, privacy, cost,
  and backfills.
- **Reports use role labels** (Frontend: Client architecture, Data & state, Performance & scale,
  Resilience & trade-offs; Data: Pipeline architecture, Data modelling & correctness, Scale &
  performance, Quality, reliability & trade-offs). The parameter keys are unchanged, so trends and
  averages still line up.
- **Practice checkpoints ask role-specific defence questions**, and knowledge checks use each
  question's own common mistakes as wrong answers.
- The Practice card reads "Architecture & Design · Frontend" or "· Data" with role copy; the
  AI/ML card keeps its own copy.
- **Code in artifacts renders in the read-only editor.** Artifact text can hold fenced blocks
  (```json, ```sql, ```ts, ```log); Practice questions and checkpoints show them in the Monaco
  viewer with syntax highlighting and line numbers, and unfenced evidence looks as before. The
  Frontend and Data contracts, schemas, and SQL are now real code, logs are one event per line,
  and briefs are one fact per line. The viewer no longer shows error squiggles on excerpts.
- **Practice checkpoints no longer reopen in the live voice room.** The Interviews resume banner,
  Reports, and search sent any in-progress session to `/interview/voice`, where an Architecture,
  Applied Engineering, Core Technical, or DSA checkpoint ran as a live round with one-click
  answers. They now open the checkpoint's own room (`sessionRoomHref`), and the voice room
  forwards any such session it is given.
- **Voice rooms no longer burn their connection allowance in a loop.** A Live connection that
  drops within 20 seconds of opening three times in a row now stops with a clear message (with
  the close code) instead of reconnecting until the 12-per-5-minutes credential limit blocks
  the room; rotation stops retrying on a rate limit; "Reconnect now" uses one credential instead
  of two; close codes and reasons are logged to the browser console as `[Live]`. The separate
  transcription channel (server-led rooms) now backs off (15 s, 30 s, 60 s) and stops after four
  failures, falling back to the main connection's transcript, instead of refreshing every 15 s
  forever. This covers every voice round and voice checkpoint in every domain; they share one
  Live component.
- **Microphone setup and signal.** The setup screen has a "Check your microphone" step with a
  device picker and a live level meter, and remembers the choice. In the room, a centred check
  opens when nothing has been heard on the current microphone for 10 seconds, with the picker
  and meter. "No microphone signal" was a false alarm in workspace rounds (System Design, DSA,
  Resume, Technical, Fundamentals): the only signal detector lived in the conversation layout,
  so those rooms never registered the candidate's voice. One detector now runs in every layout,
  and silence after the candidate has been heard is no longer reported as a dead microphone.
  Switching microphones swaps the input inside the live connection instead of reconnecting.
  "Hearing you" now needs a voice-level signal (about two bars for 300 ms); before, an idle
  microphone's boosted room noise counted as speech.
- **Claire answers promptly on distant or noisy microphones.** Room noise from a far-away mic
  (for example a webcam) kept Gemini's voice detection from ever seeing the end of an answer:
  one turn waited 111 seconds for a reply. An adaptive noise gate now sends true silence when
  the level is near the microphone's own noise floor, with a 450 ms hold for soft word endings.
- **Visual PDF resumes survive a busy Gemini.** A resume with no text layer is transcribed by
  Gemini before analysis. That read had one attempt on the fast model and no fallback, so a 503
  failed the upload. The fast model now gets part of a 24 s budget and the second Gemini model
  (separate capacity, as analysis already uses) gets the rest. Uploads that fail on the server's
  side (5xx, provider outages, timeouts) no longer count toward the 3-per-10-minutes upload limit,
  so retrying after an outage is not blocked with a 429 (`SharedGuard.refund`).
  When the fast model is saturated the upload no longer waits it out: the fallback starts reading
  after 6 s and the first transcription wins, and a fast-model failure sends visual reads and
  analysis straight to the fallback for the next 2 minutes.
  An optional third model, `GEMINI_BACKUP_MODEL` (for example `gemini-3.8-flash`), is tried
  last for visual reads and analysis when both regular models fail; each model has its own
  2-minute cooldown.
- **The System Design card no longer opens a Practice checkpoint.** Architecture Practice
  checkpoints share the `system-design` template (so they are graded like the round), and the
  card resumed the latest in-progress session with that template, sending learners into their
  checkpoint instead of the interview. The card, and the "reuse the open room" lookup every round
  start route uses (`findActiveByTemplate`), now ignore Practice checkpoints. Interviews page
  snapshot version 7.
- **Multiple-choice feedback says the answer once.** A sentence-long answer was repeated with a
  double full stop ("...database.. Scope..."); the design round's bridge no longer says "Good."
  after a wrong answer.
- Server, frontend, and data wording now come from one lookup
  (`architectureDesignTrackForRole` / `architectureDesignTrackForScenario`) instead of role
  checks spread across files.

**Deploy notes**

- No migrations and no new route files. New optional env var `GEMINI_BACKUP_MODEL`: set it in
  Vercel (for example `gemini-3.8-flash`) to give resume reading a third model; unset means two.
- Snapshot versions bumped (Interviews page 7, Practice home 5); cached pages rebuild on the next
  visit.
- Publish the eight Practice scenarios to the production database before Frontend and Data
  learners can start Architecture practice; until then the card shows as not published. The
  interview does not need publishing. The dev database is already published with
  `pnpm architecture-design:publish` and these `--scenario=` keys:
  infinite-social-feed-client, typeahead-search-client, offline-field-inspection-app,
  design-system-rollout, clickstream-analytics-pipeline, cdc-lakehouse-replication,
  daily-revenue-reporting, data-quality-lineage-platform.
- New files to commit: `src/features/practice/architecture-design/domain/frontend-scenarios.ts`,
  `src/features/practice/architecture-design/domain/data-scenarios.ts`,
  `src/features/practice/architecture-design/server/role-architecture.spec.ts`.

## Unreleased: Interview reliability, honest scores, better content (all five phases of the interview audit)

- **Voice no longer drops mid-round.** The Live connection is replaced silently every 8 minutes,
  on `goAway`, or when it closes unexpectedly, using a new `rotation` purpose on
  `/api/interview/gemini-live/token` (fresh credential, saved history, silent start).
- **Turns survive glitches.** The server replays a turn when only a background grade or code run
  changed the session; the browser retries dropped, timed-out, 5xx, and busy turns with the same
  turn ID.
- **Reports settle quickly.** A finished round grades all its answers in parallel; the "report
  ready" notification waits for the final score and is updated as grades land; visiting Reports
  retries failed grades.

**Phase 2: honest scores and rooms**

- **The interviewer now receives its instructions.** The Live token locked every setting, so the
  system instruction, context compression, and transcription settings sent by the browser were
  ignored. They are now set in the token, and the instruction (with rubrics and the System Design
  reference answer) is no longer sent to the browser. Expect the interviewer to behave noticeably
  more like the written persona.
- **Scores count unanswered questions.** Declined questions, and questions skipped by ending early,
  count as zero; pacing skips and time cut-offs do not. Reports show "X of Y questions answered".
- **System Design is hidden for Frontend and Data** (and learners with no declared role) instead
  of failing to start; `/interview/design` redirects them to `/interviews`.
- **`/interviews`:** Hiring Manager shows progress; a used-up daily limit says so and shows when the
  next round opens.
- Snapshot versions bumped: interviews 3, reports 3.

**Phase 3: less repetition, content that fits the learner**

- Hiring Manager has its own agenda (direction, energy and fit, learning fast, uncertainty,
  conflict, mistakes, feedback, close) instead of repeating the Resume round.
- Freshers get questions about college, internships, and their first role.
- The Technical round picks a different project from the Resume round when it can; the Resume
  round leaves multiple choice checks to the Technical round.
- Technical fallback questions are weighted by role and shuffled; AI/ML questions already
  practised go last.
- System Design skips scenarios practised in Architecture & Design.
- DSA asks one solved problem and one new problem from a practised pattern.
- The resume interview kit is prepared in the background after onboarding and resume updates, and
  rewritten when the role or level changes.

**Phase 4: scores computed in code**

- The evaluator rates each parameter 1–5 against written anchors; code converts levels to scores and
  applies the verdict and test caps. Same answer, same score.
- Background grading uses Gemini's reasoning model with Groq as fallback.
- Each question is graded once, when it closes, instead of after every follow-up.
- Scores from before this change stay as they were; new answers use the new scale.

**Phase 5: cleanup**

- Removed the retired setup screen, `/api/interview/start`, and the Fundamentals entry route; the
  old Fundamentals page redirects to `/interviews`.
- Removed the commented-out LiveKit transport from the voice room.
- Opening a round looks up an unfinished room with one query.
- Time limits: the Resume card says 24 minutes and the interviewer states each round's real cap;
  the daily-limit copy describes the rolling 24-hour window.
- `INTERVIEW_ENGINE.md` rewritten.

**Rounds ended without an answer**

- The room says "No report for this round" and links back to Interviews, instead of promising a
  report that Reports (correctly) does not show. No "report ready" notification is sent.

**Names**

- First names from resumes written in capitals or lower case ("PRIYA", "ishan") are shown as
  "Priya" and "Ishan" everywhere, through one shared `displayFirstName`. Analytics snapshot
  version bumped to 5 so saved pages pick it up.

**Interview entry screens**

- The pre-recorded intro now plays straight away while the session is created in the background,
  instead of waiting for the session first. The room opens when both are done, or at once with
  "Continue to interview".

**Deploy notes**

- No migration and no new environment variables.
- Test before deploying: one voice round longer than 10 minutes (the connection should rotate
  with no visible error), and a round that ends with answers still grading (the notification
  should change from "still being scored" to the score).

## 2026-09-28: Page-by-page hardening

Shipped in two parts. Resume Roast, Progress, Reports (list), Trailmate, Profile and Manage went out
in commit `0127a164` ("Optimize pages"). Onboarding, the loader, DSA latency, the single-report
copy, the deploy script and the docs follow in the next commit. Both migrations are applied to
production.

| Area | Main changes |
| --- | --- |
| Resume Roast | Rubric scoring out of 10 (five recruiter-style areas, computed in code, cached per resume and target, fixed seed); sharper v7 roast prompt with grounded rewrites; one running roast per user (a second tab joins); generation survives refresh; fresh page reads; pre-recorded James lines; in-page resume update; one `resume_roast.generation` log line per roast. |
| Progress | Waits up to 2 s for fresh data after practice; one roadmap read instead of two; cross-track streaks no longer capped at 7 days; plainer copy. |
| Reports | Real rounds no longer crowded out by practice checkpoints; waits up to 2 s for fresh data; expired rounds stop showing as in progress; strength never shows the weakest skill; honest PDF labels and copy. Single report: "Strongest area" label; evaluator gaps rewritten as learner steps ("Next time, provide a career story."), including in saved reports. |
| Trailmate | Indexed 15-second status check; online presence with online-first invites; "N online now" for learners; expiry notice with a hint fallback; `help.request.*` lifecycle logs; polished empty states; top 5 plus a "View all" top-100 leaderboard. |
| Profile | `PUT /api/profile` saves only the cover and avatar; no copy asking for edits that are not possible. |
| Manage | Account deletion also removes Trailmate blocks and reports, ends a live session the person was helping in, and anonymises them as helper in learners' history. Turning Trailmate requests off withdraws pending invitations. |
| Onboarding | Resume analysis hedged after 12 s, falling back to Gemini's reasoning model inside the 52 s budget (Groq could not produce this extraction). A refresh during review keeps the step, choices and preview. One round trip fewer per baseline answer. Shorter copy on the skills screen. |
| Loader | The way from onboarding to `/?welcome=…` shows the themed welcome loader instead of the dashboard skeleton. |
| DSA latency | Judge0 measured at 0.7–1.0 s (kept as one blocking call); the lock release overlaps the accepted-run save; solved state updates from a client event instead of `router.refresh()`; block-assessment start uses `enforceAndAcquire`. Items 1.1, 1.2, 1.4, 1.6, 1.7, 5.1 and 5.2 closed. |
| Deploy script | `deploy:production` ends with `prisma generate`, so local development gets its macOS engine back. |
| Docs | New numbered documentation series; old docs merged or removed. |

**Deploy notes**

- Migrations `20260928100000_resume_roast_single_generation` and
  `20260928120000_trailmate_presence_and_status_indexes`: applied to production September 28.
- The 4 new `public/voice/james-*.mp3` files shipped in `0127a164`.
- No new environment variables.
- Watch after deploy: `resume_roast.generation`, `help.request.*`,
  `*_fresh_wait_exceeded` (see [Operations](07_OPERATIONS.md#logs-to-watch)).

## 2026-09-27: Story-track assessments, new paths, Overview tour, Practice latency

- Frontend and Data each gain two paths per track (four paths, 20 questions per track). Existing
  learners get the new questions on their next visit.
- Every authored story path has an assessment: four frozen prompts (the learner's weakest
  question, two interviewer follow-ups, and a common trap), unlocked when the path is finished.
  It runs in the typed interview room (kind `story-track`) and is graded through the
  Gemini-then-Groq fallback in about 2–5 s.
- The first Overview after onboarding plays a short spoken tour, once per learner. The claim is
  one conditional update, so refreshes and other devices never replay it.
- Applied Engineering assessments moved from the Gemini Live voice room to the typed room shared
  with Core Technical and Architecture: no Live minutes.
- Core Technical first and next paths start from the reviewed version instead of live
  generation: 66 s with an overloaded Gemini down to 0.3 s. This fixed "We could not prepare the
  complete practice path" (Gemini 503 plus a Groq schema failure and 429).
- Draft, hint, answer and Learn in Core Technical, Applied Engineering and Architecture reply from
  the in-transaction read: one or two round trips fewer per click.
- Written-answer grading capped at 12 s × 2 attempts and hedged after 5 s on every track (worst
  case about 25 s before fallback, down from 90 s). Graders state the 0–100 scale.
- Assessment rooms speak short pre-recorded lines per moment (80 new recordings); follow-ups stay
  live.
- Code submits skip the interviewer decider, as DSA does.
- The plan-save transaction got a 10 s wait and 20 s timeout, fixing "Transaction already closed"
  for new Frontend and Data learners.
- Previous/Next and row links show a spinner while loading; answer panels open smoothly.

**Deploy notes**

- Migration `20260927100000_story_track_assessments` (adds `StoryTrackAssessment`). Track pages
  read it; a failure only hides the assessment card.
- Migration `20260927110000_overview_introduction` (adds `CandidateProfile.overviewIntroducedAt`
  and marks everyone already onboarded, so only new learners hear the tour).
- Spot check: finish a Frontend path, start its assessment, submit, and confirm the report and
  the score on the track overview.

## 2026-09-26: DSA end to end, code runners, production Prisma fix

**DSA question page**

- Back goes to `/practice/dsa` instead of the old `/dsa-questions` library.
- Back buttons on every track show a spinner after 120 ms while the destination loads.
- Review tab sections open and close with a smooth height and fade.
- Skip moves to the next question at once; the roadmap write (about 17 sequential database calls)
  finishes in the background with `keepalive` and two retries using the same request id.

**Teacher feedback after an accepted run**

- Given only for code the runner accepted: `/api/code/run` records accepted code in Redis for
  6 hours, and `/api/dsa/practice-feedback` returns 422 without it. This closed free AI calls for
  unverified code.
- The model names the lines it praises and the server checks they are real code.
- The spoken script says complexity in words ("O of n").
- Hedged request: a second call races after 4 s, each capped at 12 s, two attempts. About 1 in 5
  calls to `gemini-flash-lite-latest` used to stall for 30–60 s; after, 9 of 10 took 1.6–2.3 s.
  `hedgeAfterMs` is now an opt-in option on the Gemini provider.

**Ask a mate**

- The 10-minute request limit is spent only when at least one mate can be invited; availability
  checks have their own limit (6 per minute).
- Up to 150 best-ranked mates are invited.
- Create and claim run their independent reads in parallel.

**Block assessment scoring**

- Metric names now map to the evaluator's DSA parameters. Before, three of four metrics always
  scored 0.
- Coding submissions are graded before the response (up to 12 s), and queued evaluations finish
  before the report is written.
- Scores are on 0–100; stored out-of-10 scores are rescaled when read.
- A coding submission ends that problem: no follow-ups and no decider call.
- 19 pre-recorded lines per teacher for each moment (152 files). The opening went from about 30 s
  of live speech to about 5 s.
- `pnpm assessments:rescore:dev` / `:production` rescore stored reports (dry run unless
  `-- --apply`, which backs up first). Development had two affected reports (25 → 55, 20 → 51);
  production had none.

**Code runners (Core Technical and Applied Engineering)**

- Syntax check and tests share one Vercel Sandbox, and shutdown is not awaited: 11.8–13.1 s per
  run down to 1.8–2.8 s.
- Question audits share one sandbox per question, run in parallel, and passing audits are cached
  per instance.
- Runner re-pinned from Node 22.23.2 to 22.22.2, the version Vercel's `node22` sandbox runs. The
  old pin made every production code run fail closed.

**Practice-wide**

- `timeAction` logs `api.action_timing` and sets `Server-Timing` on every Practice and DSA action.
- Assessment finalize saves the claim and grades after the response; the page polls every 5 s. Only
  the call that made the claim (or a claim older than 3 minutes) grades, so nothing is graded twice.
- Profile read and rate limit run in parallel; `enforceAndAcquire` runs rate limit and lock in one
  Upstash round trip; draft autosave waits 1 s; Practice page rebuilds coalesce per user.

**Production Prisma fix**

Production `/onboarding` and `/api/profile` returned 500 with `PrismaClientInitializationError`,
and a local build produced 67 functions (Hobby allows 12). Fixed by pruning Prisma engines before
`next build` and restoring the ARM64 engine into each bundle afterwards. Details in
[Operations](07_OPERATIONS.md#the-prisma-engine-and-function-limit). Successful deployment:
`dpl_4C276iaVkKpSWdCB88Jr7dwa36B6`, 10 functions.

**Deploy notes**

- No database migration.
- Commit `public/voice/*.mp3` together with `src/lib/avatars/static-voice.generated.ts`.
- Spot check: skip a DSA question (instant), solve one (feedback within a few seconds, highlighted
  lines match the praise), open the Review tab, run Core Technical code (about 2 s).
