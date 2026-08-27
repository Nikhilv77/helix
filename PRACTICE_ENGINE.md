# Practice Engine

## Purpose

Trailgrad's practice engine is the learning layer for the same personalized path already produced by
the interview engine. It mirrors the candidate's six interview sessions, gives every session a
substantial set of practice questions, records durable attempts, identifies weak areas, and
recommends what the candidate should practise next.

The interview engine is already the source of truth for the candidate profile, active personalized
plan, stable interview kinds, titles, topic coverage, and difficulty. Practice reads that plan; it
does not regenerate or mutate the interview plan.

Practice and interviews share topics, rubrics, performance vocabulary, and canonical questions when
the interview uses the question bank, but use different delivery rules:

- **Practice:** many questions, hints, explanations, retries, notes, and guided learning.
- **Interview:** a small selection, no learning aids, time limits, Maya's follow-ups, and a report.

```text
Active interview plan + candidate profile
                  │
                  ▼
       Six-session practice roadmap
                  │
                  ▼
      Question banks → attempts → mastery
                  │
                  └──→ next practice recommendation
```

## Same six-session path

Practice must generate the same six candidate-facing session slots and ordering shown by the
interview roadmap:

| Order | Stable practice session key  | Interview source                                              |
| ----- | ---------------------------- | ------------------------------------------------------------- |
| 1     | `frontend-dsa`               | `problem-solving` blueprint, presented as dedicated DSA       |
| 2     | `core-technical`             | Personalized `core-technical` blueprint                       |
| 3     | `applied-engineering`        | Personalized `applied-engineering` blueprint                  |
| 4     | `architecture-system-design` | Personalized `architecture-system-design` blueprint           |
| 5     | `resume-behavioral-defense`  | Dedicated candidate-facing session inserted before Final Mock |
| 6     | `final-mock`                 | Personalized `final-mock` blueprint                           |

The three technical session titles, descriptions, topics, and difficulty come from the active
personalized interview plan. DSA and Resume and Behavioral Defense keep their dedicated product
identities. Final Mock uses the plan's weak-signal coverage.

Interview blueprint IDs may change after adaptation, so practice progress must reconcile by the
stable practice session key and canonical question identity, not by blueprint ID. A regenerated
practice roadmap may update titles, topics, ordering, difficulty, and recommendations, but it must
not reset completed work or attempts.

Structural generation is atomic: all six candidate session records are created or reconciled
together. A session is enabled only after its question placements exist. During an incremental
rollout, an unavailable session is explicitly marked as unavailable rather than displaying `0`
questions or opening an empty workspace. The practice launch is complete only when all six sessions
are enabled with usable questions.

## Preserve the current DSA bank

The existing DSA bank must not be removed, replaced, truncated, or destructively reseeded.

- Keep every `DsaQuestion`, slug, phase, pattern, explanation, hint, approach, edge case, test case,
  note, progress record, and attempt.
- Treat DSA slugs as stable identifiers used by routes and database relations.
- Personalization may select, order, recommend, or hide questions for one candidate. It must never
  delete questions from the global bank.
- Questions unsuitable for one profile remain available for other profiles or later stages.
- Existing progress must survive profile changes, resume re-upload, roadmap regeneration, and
  practice-engine migrations.
- Unsupported class-based questions may be excluded from an interview or language runner without
  being removed from the bank.
- Seeds and migrations must be additive and idempotent.

The current DSA implementation is the reference for the wider practice engine. Extend it; do not
rebuild it.

## Content banks

The engine needs question coverage for all six practice sessions: DSA; role-specific core technical;
applied engineering; architecture and system design; resume and behavioral preparation; and mixed
final-mock preparation. Frontend is the first complete role, with JavaScript and React, computer
fundamentals, production UI engineering, and frontend system design forming its technical banks.

Each non-DSA session contains ordered chapters and canonical questions appropriate to the topics in
the corresponding interview blueprint. Final Mock draws a mixed review set from the other banks
instead of creating a duplicate bank or duplicating question history.

Frontend remains the first complete path. Other roles can reuse the contracts later.

## Shared question model

The current foundation is `DsaQuestion` for DSA, `PrepQuestionTemplate` for non-DSA content,
`RoadmapQuestionTemplate` for placement, `UserQuestionProgress` for current progress, and
`UserQuestionAttempt` for durable history.

A server adapter should normalize DSA and prep content into one shared contract containing:

- stable identity, source, bank, session, chapter, topic, and skill keys;
- roles, levels, prerequisites, difficulty, format, expected time, and content version;
- prompt, objective, rubric, strong and weak signals, hints, explanation, and related questions;
- starter code, language contract, and tests when applicable.

Correct answers, hidden tests, and private rubric material stay server-side until submission or the
configured reveal step.

`RoadmapTemplate` and `RoadmapSessionTemplate` define the six stable role-level slots.
Candidate-specific topic coverage and source plan/profile version IDs live on `UserRoadmap`
personalization. Selected questions are materialized into the candidate's persisted question
progress/placement records and reference either a `DsaQuestion` slug or `PrepQuestionTemplate` ID.
This avoids creating a new global roadmap template for every candidate.

For every generated session:

- each question has exactly one canonical source identity and content version;
- each placement records why it was selected and which plan/profile revision selected it;
- chapter and question order are persisted rather than recomputed on every page load;
- prompts, hints, rubrics, and tests required by the workspace exist before placement;
- no placeholder or title-only question can count toward the session total.

## Profile-aware selection

Selection should consider the target role, level, resume, active roadmap position, prerequisites,
question status, scores, hint usage, retries, code results, interview performance, and recency.

Personalization produces a candidate-specific view over the global bank. It may choose a subset,
change order or difficulty, revisit weak concepts, schedule review, or accelerate through proven
strengths.

It must not delete global content, erase attempt history, or treat a resume claim as demonstrated
ability.

Every recommendation should have a stable reason such as `next-roadmap-question`, `prerequisite`,
`weak-topic`, `interview-recommendation`, `review-due`, or `increase-difficulty`. Equal inputs should
produce the same recommendation instead of changing on refresh.

Session generation follows two levels:

1. Copy the six stable session slots and personalized topic coverage from the active interview plan.
2. Deterministically select and persist the best matching canonical practice questions for each
   session.

The generator should fill all sessions in one transaction. If a personalized topic has insufficient
bank coverage, generation reports the missing topic and uses an explicitly versioned, reviewed
fallback set; it must not silently publish an empty session.

## Practice experience

A candidate should be able to browse and filter the bank, open recommended or manually selected
questions, save drafts and notes, request progressive hints, run code, submit, complete, skip,
retry, reveal explanations after the configured gate, and receive feedback plus a next action.

For non-DSA questions, completion is derived only from an evaluated passing submission. There is no
manual “mark complete” action. Skip remains available but never awards correctness or mastery.

Practice should teach, not only score. Feedback should name the most important gap and the next
corrective action. Retrying must create a new attempt without removing earlier attempts.

### Evaluation

- MCQs are graded on the server using the authored answer key.
- Code uses the existing runner, tests, execution limits, and error classifications.
- Typed, spoken, and future diagram answers use their authored rubrics.
- Technical correctness takes precedence over confident wording.
- Evaluator outages create an unverified result that is excluded from adaptation; the answer is not
  discarded.
- Every PREP attempt snapshots the question content version, evaluator contract version, and one of
  `VERIFIED`, `UNVERIFIED`, or `NOT_APPLICABLE`. Only `VERIFIED` scores can award completion or feed
  future mastery.

Practice uses the same correctness vocabulary as interviews. Materially incorrect technical
answers score below 45, failed tests cap correctness, and code execution without relevant tests does
not establish correctness. Practice may provide more feedback and permit retries, but it must not
apply a weaker correctness standard.

## Progress and mastery

Persist question status, attempt count, answers, verification status, question/evaluator versions,
verified scores, duration, hints, execution evidence, skill/topic performance, and
chapter/session/roadmap progress.

Mastery is not equivalent to "completed once." It should consider correctness, difficulty, recency,
retries, hint usage, and sample size. The UI may display a simpler status while the server retains
the richer evidence.

Attempt writes must be idempotent. Concurrent or repeated submissions must not double-count
attempts, completions, or progress.

## Relationship with interviews

Practice and interviews share canonical question identity, topic and skill keys, difficulty and
format vocabulary, tests, rubrics, evaluation signals, and candidate performance evidence.

They keep separate state machines, time policies, hint visibility, retries, and history.

Practice mirrors the interview plan's six-session shape and topic coverage, but it does not modify
interview blueprints or live interview state. Practice contains many guided questions; an interview
contains only a few guarded questions and follow-ups.

When interview selection uses a canonical bank question, its prompt and rubric are copied into the
immutable interview session so later bank edits cannot change historical interviews. Generated
interview questions may still be used by the existing interview engine; they do not automatically
become global practice-bank content.

Interview reports and verified interview gaps influence practice recommendations. A later adapter
may expose verified practice results to future interview-plan revisions, but that integration is not
required to launch the six-session practice engine and must not change the existing interview
runtime. Neither system rewrites the other's historical records.

## Roadmap rules

Sessions contain chapters that reference canonical questions. Templates are versioned separately
from candidate progress, and regeneration reconciles by stable question ID or DSA slug. Existing
attempts remain intact, new questions may be inserted without resetting progress, and questions
removed from the active view remain in history. Progress, unlocking, and next-question decisions
must come from persisted state and deterministic rules. The UI supports both a guided path and bank
exploration.

When the active interview plan changes, reconcile in this order:

1. Match the six session slots by stable practice session key.
2. Preserve question progress and attempts by canonical question ID or DSA slug.
3. Keep removed placements in history while removing them from the active view.
4. Insert newly selected questions without changing prior attempts.
5. Persist the new interview plan ID and profile/performance revision used for generation.

## Implementation phases

### 1. Polish and protect DSA

- Inventory the existing DSA bank and record baseline counts for questions, slugs, tests, notes,
  progress, and attempts.
- Add the normalized question adapter without changing slugs or deleting current content.
- Polish question statements, constraints, examples, starter code, test coverage, hints,
  explanations, edge cases, and unsupported-language behavior.
- Make draft, run, submit, retry, skip, notes, resume, and progress behavior consistent and
  idempotent.
- Verify mobile/editor usability and accessible loading, error, success, and empty states.

### 2. Generate the six-session practice roadmap

- Map the active interview plan into the six stable practice session keys.
- Persist the source plan/profile revision and candidate-specific topics.
- Reconcile regeneration without losing existing DSA or non-DSA progress.
- Replace zero-question session cards with unavailable states until their banks are ready.

### 3. Build questions for every non-DSA session

- Build substantial frontend banks for core technical, applied engineering, architecture/system
  design, and resume/behavioral preparation.
- Give every session ordered chapters, rubrics, hints, explanations, and supported answer formats.
- Compose Final Mock practice from the earlier banks without duplicating canonical questions.
- Do not mark the six-session practice roadmap complete until every session has usable questions.

### 4. Complete the practice experience

- Implement browse, submit, retry, skip, notes, progressive hints, explanation gates, and
  next-question flows for non-DSA questions.
- Add explainable recommendations, difficulty adaptation, weak-topic review, and spaced review.
- Feed verified interview gaps into practice recommendations.

### 5. Connect practice evidence back to future interviews

- Expose verified practice mastery, weak topics, code evidence, and recent-question history through a
  versioned server contract.
- Allow future interview-plan revisions to consume that evidence without changing the existing live
  interview engine or rewriting interview history.

This phase is deferred until the standalone six-session practice experience is complete.

## Acceptance criteria

- All current DSA content and candidate history remain intact.
- DSA and non-DSA questions use one normalized server contract.
- Candidates receive a persisted six-session practice roadmap derived from their active interview
  plan.
- The six practice slots match the interview roadmap's order and personalized topic coverage.
- Every session has usable canonical questions before it is enabled; no enabled card has a zero
  question count.
- Every non-DSA session has a meaningful multi-chapter bank.
- Hints, submit, complete, skip, retry, notes, and recommendation flows work.
- Progress survives refresh, profile updates, and roadmap regeneration.
- Selection is deterministic and explainable.
- Interview evidence affects practice recommendations; verified practice evidence is available for
  future interview-plan revisions.
- Interview snapshots remain unchanged after bank edits.
- Concurrent or repeated submissions do not double-count progress.
- Selection, reconciliation, evaluation, and progress logic have automated tests.

## Current gaps

- `/practice` now reads a persisted six-session Practice roadmap. Its personalized snapshots are
  reconciled transactionally from the active immutable interview plan and its progress remains in
  the existing roadmap records.
- All five non-DSA banks, placements, session routes, question routes, state APIs, answer formats,
  submission-derived completion, and versioned verified evaluation are implemented behind
  `PRACTICE_NON_DSA_ENABLED`.
- Part 4 engineering, the 75-question PREP editorial review, and preservation-safe deployment of
  the 30 version-2 revisions are complete. Launch still needs external production alert/dashboard
  wiring and hands-on desktop/mobile browser QA.
- Personalized technical interviews may continue generating questions at launch; sharing canonical
  bank selection with interviews is a later integration and is not required to launch practice.
- Part 5 engineering is complete: verified Practice attempts are aggregated into immutable,
  versioned evidence and can influence newly generated interview-plan revisions. Historical plans,
  sessions, reports, and unverified attempts remain unchanged.

## Verification

Run `pnpm exec prisma validate`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
`pnpm build`.

Any DSA migration must verify that question, progress, attempt, note, and test coverage counts do not
decrease.

## Delivery plan: five parts

The work is divided into **five parts**. Parts 1–4 deliver the complete standalone Practice Engine.
Part 5 is a later integration that lets future interview plans learn from practice results. Each part
must meet its completion gate before the next dependent part is considered complete.

### Part 1 — Stabilize and polish DSA

**Goal:** make the existing DSA experience the reliable reference implementation without replacing
its bank or resetting anyone's work.

**How:**

1. Record baseline counts for DSA questions, test cases, notes, progress rows, and attempts.
2. Normalize every DSA question through the shared server question contract.
3. Audit statements, examples, constraints, hints, explanations, starter code, language support,
   authored tests, and error handling.
4. Make save, run, submit, complete, skip, retry, resume, and note writes idempotent.
5. Polish the workspace on desktop and mobile, including loading, empty, error, and success states.

**Complete when:** the current bank and history counts have not decreased; supported questions run
and submit correctly; refreshes and duplicate requests do not lose or double-count progress; and the
DSA regression suite passes.

### Part 2 — Generate the six-session practice roadmap

**Goal:** give each candidate a persisted practice path matching the six sessions and personalized
coverage of their active interview plan.

**How:**

1. Read the active interview plan through a read-only adapter.
2. Map its five stable blueprint kinds plus Resume and Behavioral Defense into the six stable
   practice session keys.
3. Copy candidate-facing titles, topic coverage, difficulty, and source plan/profile revision into
   practice personalization data.
4. Create or reconcile all six `UserSessionProgress` records in one transaction.
5. Preserve old progress by stable session key even when a new interview plan has different
   blueprint IDs.

**Complete when:** every onboarded candidate gets the same six ordered session slots as their
interview roadmap; generation is deterministic; regeneration preserves history; and an incomplete
content bank produces an explicit unavailable state rather than an empty session.

### Part 3 — Build and place questions for every session

**Goal:** ensure all six sessions contain meaningful practice instead of placeholder cards.

**How:**

1. Keep DSA questions in `DsaQuestion`; author versioned non-DSA questions in
   `PrepQuestionTemplate`.
2. Build ordered chapters for core technical, applied engineering, architecture/system design, and
   resume/behavioral preparation.
3. Give each question the prompt, objective, difficulty, expected time, rubric, strong and weak
   signals, hints, explanation, and tests or answer key when applicable.
4. Deterministically select questions that match the candidate's plan topics, level,
   prerequisites, prior attempts, and recent interview gaps.
5. Persist placements and selection reasons. Compose Final Mock from existing banks rather than
   creating duplicate questions.
6. Run a coverage validator before enabling a session; missing prompts, rubrics, answers, or tests
   fail publication.

**Complete when:** every enabled session has ordered chapters and usable questions, all question
placements have canonical identities and reasons, and no enabled session has a zero-question count.

### Part 4 — Complete and launch the practice experience

**Goal:** let candidates learn, make progress, and receive a useful next action in every session.

**How:**

1. Extend `/practice` from its current DSA-only page into the six-session entry point.
2. Resolve DSA and prep questions through one server adapter while rendering the correct workspace
   for code, MCQ, typed, spoken, and later diagram answers.
3. Implement drafts, notes, progressive hints, code runs, submit, submission-derived completion,
   skip, retry, explanation gates, and next-question navigation.
4. Persist attempts and update question, chapter, session, and overall roadmap progress in one
   idempotent flow.
5. Generate deterministic recommendations from prerequisites, verified scores, retries, hint use,
   recency, and interview evidence.
6. Add authorization, validation, rate limits, concurrent-write protection, accessibility,
   observability, and automated tests for selection, reconciliation, evaluation, and progress.
7. Release behind a feature flag, verify production metrics and data counts, and then enable the
   complete path.

**Complete when:** a candidate can enter any of the six sessions, finish and retry its questions,
refresh without losing progress, receive an explainable next recommendation, and pass the full
verification suite.

### Part 5 — Feed verified practice evidence into future interviews

**Goal:** improve later interview-plan revisions using demonstrated practice ability without
changing the working interview runtime.

**How:**

1. Aggregate only verified practice attempts into versioned skill/topic evidence.
2. Expose mastery, weak topics, code correctness, hint dependence, and recent-question history
   through a read-only server contract.
3. Let a future interview planning revision consume that contract for coverage and difficulty.
4. Keep historical interview plans, blueprints, sessions, and reports immutable.

**Complete when:** practice evidence can influence a newly generated interview plan, unverified
attempts are excluded, and existing or in-progress interviews remain unchanged.

## Part 1 implementation status

Part 1's **engineering acceptance gate is complete** as of 2026-08-27. Manual content and visual
product review remain before calling the overall polish pass finished.

Baseline captured before applying the additive migration, then checked again after deployment:

| Measure                            | Baseline | After migration |
| ---------------------------------- | -------: | --------------: |
| Authored DSA phases                |       11 |              11 |
| Authored/database DSA questions    |      200 |             200 |
| Authored examples/test contracts   |      466 |             466 |
| Advertised question-language pairs |      772 |             772 |
| Database DSA progress rows         |    2,214 |           2,214 |
| Database DSA attempts              |      138 |             138 |
| Database DSA notes                 |        0 |               0 |

Completed:

- Added an automated source-bank audit that rejects decreases below 11 phases or 200 questions and
  validates unique slugs, prerequisites, related questions, authored examples, starter/harness
  composition, and structural teaching completeness for all 200 questions.
- Added the versioned normalized DSA practice-question adapter used as the contract reference for
  later non-DSA banks.
- Made DSA seeding additive so questions or phases absent from a later seed source are preserved
  instead of deleted, and added content versions without rewriting existing question rows.
- Added client request identities and database uniqueness for manual progress writes and code-run
  evidence so retried requests do not double-count attempts.
- Centralized language support and starter signature generation. Starters now infer argument and
  return shapes from all examples and handle numeric slugs, nested arrays, decimal values, linked
  lists, trees, mutation questions, and supported class-operation questions.
- Limited the 14 questions whose Java/C++ adapters are not yet safe to JavaScript and Python instead
  of advertising a language that would fail after submission.
- Compiled every advertised Java and C++ starter/harness contract locally. All 772 advertised
  question-language contracts also pass the source-bank composition audit.
- Ran real Judge0 smoke submissions for JavaScript, Python, Java, and C++, including ordinary
  functions, linked lists, trees, mutation questions, and class-operation questions. Updated the
  runner to Node.js 20.17 and GCC 14.1 so the generated harness syntax matches the runtime.
- Added per-question and per-language local code drafts, reset-to-starter behavior, and accessible
  live status for code execution and note saving.
- Rebuilt `/practice` as the same six-card roadmap pattern used by `/interviews`. Both entry points
  now render one shared session-card component and Practice reads the same active personalized
  interview projection for its visible session titles and coverage.
- Moved the implemented DSA library to `/practice/dsa`, kept unavailable session cards explicitly
  disabled, and brought DSA chapters and question pages under the signed-in workspace shell.
- Matched Practice chapter, coaching, question, result, and editor surfaces to the live interview
  room's accent borders, graphite gradients, inner cards, shadows, focus treatment, and reduced-
  motion behavior.
- Extended the bank audit with objective editorial checks for underspecified teaching copy,
  duplicate hints or approaches, and placeholder text; polished the copy exposed by that audit.
- Applied the additive migration to the configured deployment database and verified that question,
  progress, attempt, and note counts did not decrease.
- Passed Prisma validation, TypeScript, lint, 510 normal automated tests, the opt-in compiler audit,
  the opt-in Judge0 smoke suite, and the production build.

Remaining manual polish:

- Complete the subjective, question-by-question editorial read for teaching tone and hint
  progression. Objective copy quality is now enforced automatically, but judgement still needs a
  human review.
- Complete hands-on desktop and mobile visual QA across editor, results, notes, progress, error, and
  empty states. The implementation now shares Interview's visual primitives, but the automated
  browser connection was unavailable during this pass, so visual verification is intentionally not
  marked complete.

## Part 2 implementation status

Part 2's **automated engineering gate is complete** as of 2026-08-27. The generator is live in the
`/practice` read path and its unit, route, database-regeneration, concurrency, preservation, and
production-build gates pass. Hands-on browser QA remains a manual verification item. Part 3's data,
publication, and placement work is also complete, and Part 4 now supplies the gated non-DSA
workspaces.

Built:

- Added six stable Practice session keys independent of immutable interview blueprint UUIDs.
- Projected the active five-blueprint interview plan into the same six candidate-facing slots used
  by `/interviews`, including the inserted Resume and Behavioral Defense slot.
- Added persisted plan/profile source revisions, generator version, personalized display snapshots,
  blueprint provenance, and explicit session availability.
- Added a per-owner advisory lock and transactional six-row reconciliation. Existing attempt,
  completion, status, and progress counters are omitted from update writes.
- Made reconciliation refresh-idempotent: when the active plan and template inputs are unchanged,
  it performs zero session writes and zero roadmap writes. Bank availability/count or personalized
  snapshot changes still reconcile normally.
- Added the same per-owner lock to initial roadmap provisioning so simultaneous first visits cannot
  race one another or a progress recalculation.
- Changed roadmap provisioning to support every onboarded target role while continuing to reuse the
  current DSA/template progress model.
- Kept zero-question sessions unavailable and prevented roadmap recalculation from promoting them
  to an active state.
- Switched `/practice` from the temporary read-only UI projection to the persisted Practice service
  response.
- Deployed `20260827010000_persisted_practice_roadmap` and verified that roadmap, session, chapter,
  question-progress, and attempt totals did not decrease.
- Added and passed an opt-in live-database regeneration test. It changes plan and blueprint IDs
  inside a forced rollback and proves session row IDs, statuses, timestamps, attempts, completions,
  and percentages remain unchanged while personalized snapshots update.
- Added and passed a five-way concurrent first-load test using one disposable candidate. Every load
  returned the same roadmap ID and the database contained exactly one roadmap with six stable slots;
  the candidate was deleted in `finally` and database totals returned to baseline.
- Added route tests proving an authorization/onboarding rejection never reaches the generator and a
  generator outage produces a clear recoverable alert that states saved progress is safe.
- Added distinct preparing and generator-failure UI states to `/practice`.
- Added a structured `practice.roadmap_generation_failed` server log with owner and reason while
  keeping internal failure details out of the candidate-facing alert.

Manual verification still left:

- Run desktop/mobile browser QA for loading, unavailable, and failure states.
- The in-app browser skill was used on 2026-08-27, but its prescribed discovery and retry checks
  returned no available browser sessions. No substitute browser automation was used, so visual QA
  is intentionally not marked complete.
- Keep the five non-DSA cards disabled unless their publication gate passes and
  `PRACTICE_NON_DSA_ENABLED` is deliberately enabled. Their Part 4 workspaces now exist, but the
  launch-resilience and browser-QA gate remains open.

## Part 3 implementation status

Part 3's **question-bank and placement engineering gate is complete** as of 2026-08-27. All five
non-DSA slots have substantial published data and deterministic candidate placements. Part 4 now
provides their format-specific workspaces behind the non-DSA launch flag.

Published content:

| Practice session             | Published canonical questions | Chapters | Candidate placement cap |
| ---------------------------- | ----------------------------: | -------: | ----------------------: |
| Core Technical               |                            12 |        3 |                      12 |
| Applied Engineering          |                            42 |        4 |                      24 |
| Architecture & System Design |                            12 |        5 |                      12 |
| Resume & Behavioral Defense  |                             9 |        2 |                       9 |
| Final Mock                   |                  Reuses banks |    Mixed |                      12 |
| **Non-DSA total**            |                        **75** |   **14** |       **69 placements** |

Built:

- Expanded `PrepQuestionTemplate` into a versioned publication contract with stable session and
  chapter keys, format, objective, prerequisites, hints, explanation, private answer key, and
  `DRAFT`/`PUBLISHED`/`ARCHIVED` state.
- Added 13 polished frontend questions, converted the existing 42-question computer-fundamentals
  bank into the canonical prep contract, and retained the existing 20 frontend/behavioral
  questions. All 75 are published.
- Added a normalized prep adapter matching the DSA contract. It deliberately excludes private MCQ
  answer keys from learner-facing data.
- Added a publication audit that rejects incomplete question fields, placeholders, invalid MCQ
  keys, unpublished prerequisites, duplicate IDs, accidental active-session drafts, and session or
  chapter coverage below the table above. The seed fails instead of silently enabling bad content.
- Added 14 ordered non-DSA bank chapter templates plus Final Mock's mixed-review chapter, and 75
  PREP roadmap mappings alongside the existing 123 DSA mappings. The shared roadmap template is
  now version 2.
- Added `PracticeQuestionPlacement`, which references one canonical `UserQuestionProgress` record.
  Final Mock therefore reuses earlier progress IDs and never duplicates mastery or attempts.
- Added deterministic chapter-balanced selection. Ranking uses the active immutable plan topics,
  target-role family, candidate level, prerequisite readiness, and saved attempt/score/status gaps;
  every persisted placement records its selection reason and source plan/profile revision.
- Candidate placement counts are 12 Core, 24 Applied, 12 Architecture, 9 Resume/Behavioral, and a
  12-question Final Mock (three reused questions from each earlier non-DSA session).
- Changed placement reconciliation to perform no writes when the desired set is unchanged. A changed
  derived placement index is replaced in two bulk queries; canonical progress and attempts are never
  deleted or rewritten.
- Made roadmap recalculation derive non-DSA and Final Mock session counters from shared placements,
  so a later attempt cannot reset Final Mock to zero.
- Unified provisioning and Practice reconciliation under one per-candidate advisory lock after a
  live five-way first-load test exposed a lock-order deadlock.
- Added lazy version-based backfill. A pre-Part-3 candidate receives the 75 canonical PREP progress
  rows and 69 placements on the next Practice load without re-onboarding or losing old history.
- `/practice` distinguishes a genuinely missing bank from a published bank. Published non-DSA
  cards receive routes only while the Part 4 launch flag is enabled.

Migration and preservation:

- Deployed additive migration `20260827020000_practice_question_banks`. It must not be edited;
  future changes require a new migration.
- Before deployment: 45 profiles, 18 roadmaps, 105 session rows, 216 chapter rows, 2,214 question
  progress rows, 138 attempts, 20 prep templates, and 123 roadmap-question mappings.
- After deployment and seed: all candidate/history counts are unchanged; shared content contains 75
  published prep templates and 198 roadmap-question mappings (123 DSA + 75 PREP).
- The permanent database currently has zero placement rows because existing candidates are upgraded
  lazily. The disposable integration candidate proved 198 canonical progress rows and 69 placements,
  then cascade cleanup returned database counts to baseline.

Verification completed:

- Prisma format, schema validation, client generation, application TypeScript, seed TypeScript, and
  targeted ESLint passed.
- The normal suite passes 87 Vitest and 426 Jest tests: 513 normal tests total, with 10 opt-in Jest
  tests skipped.
- The opt-in live database suite passes rollback-based regeneration/history preservation, five
  concurrent first loads, exact published counts, Final Mock canonical reuse, and stale-roadmap lazy
  backfill.
- Production Next.js build passes.

Part 3 should not be reopened for Part 4 workspace or evaluation changes.

## Part 4 implementation status

Part 4's engineering flow, PREP editorial review, and reviewed-content deployment are complete as
of 2026-08-27, but its launch gate remains open for the external and hands-on items listed below.

Implemented:

- Added non-DSA session and placed-question routes for MCQ, typed, spoken-dictation, and diagram
  outline practice.
- Added cross-device drafts, monotonic progressive-hint state, separate PREP notes, explanation
  gating, previous/next navigation, skip, retry, and submission-derived completion.
- Hardened draft/note autosave with coalesced serial writes, retained retry state, keepalive delivery,
  unmount/page-exit flushing, and save-before-navigation/submission behavior. State writes now share
  the attempt lock, so concurrent tabs cannot regress revealed-hint progress.
- Completed browser dictation lifecycle handling: Stop controls the active recognition instance,
  only new final result indexes are appended, submit/navigation waits for graceful finalization with
  a bounded abort fallback, and unmount aborts safely.
- Made non-DSA Practice opt-in at every default boundary: `.env.example`, environment validation,
  and application-config fallback now resolve to disabled unless an operator explicitly supplies
  `PRACTICE_NON_DSA_ENABLED=true`.
- Added content-safe structured telemetry for state-save success/failure/retry/latency and
  evaluation verified/unverified/latency outcomes. Stable five-minute save/evaluator outage signals
  include suggested thresholds for production log-based alerts, and persisted attempt events expose
  an `unverifiedAttemptDelta` counter.
- Removed manual completion. Only a verified passing submission can mark a PREP question complete.
- Added authenticated, validated, rate-limited state and attempt APIs plus per-candidate locked,
  idempotent attempt writes and shared Final Mock progress recalculation.
- Added strict AI evaluation for typed, spoken, and diagram answers using the authored
  `scoringRubric`, answer structure, strong/weak signals, and a versioned structured-output contract.
  MCQs remain deterministically graded from the private server-side key.
- Added `VERIFIED`, `UNVERIFIED`, and `NOT_APPLICABLE` attempt evidence states. Evaluator failures
  preserve the answer with no score or completion; skips are explicitly non-evidence.
- Added a deterministic recommendation policy over immutable verified attempt history, current
  recency, score-based spaced-review intervals, hint/retry dependence, verified prerequisite
  mastery, latest demonstrated interview-skill gaps, and session-level adaptive difficulty. Stable
  placement order and canonical question ID break equal-score ties, and every returned next action
  carries a concise evidence explanation.
- Completed the question-by-question factual, teaching-tone, rubric, and hint-progression review of
  all 75 PREP questions. Replaced generated coaching in 20 frontend/behavioral questions with
  authored progressive hints and explanations, corrected overbroad technical wording in 10
  fundamentals questions, and incremented every changed content version.
- Deployed additive migrations `20260827030000_practice_experience` and
  `20260827040000_practice_verified_evaluation`. Neither migration rewrites legacy attempts.
- Deployed the reviewed PREP sources with the audited upsert seed. The database now contains 30
  version-2 reviewed questions and 45 unchanged version-1 questions; all tracked candidate-history
  and canonical-bank counts were preserved.

Still required before marking Part 4 launched:

Release requirements:

1. Connect a Vercel production Log Drain to the chosen log/alert provider and create the two
   content-specific count alerts documented in `docs/DEPLOYMENT.md`. No Vercel project binding,
   token, CLI, or provider choice was available in this workspace on 2026-08-27, so this external
   configuration could not be performed or test-fired.
2. Complete signed-in desktop/mobile browser QA for every answer format, autosave/navigation,
   keyboard and screen-reader-oriented behavior, completion/skip/retry, and save/evaluator outage
   states. Browser runtime discovery returned no connected browser on 2026-08-27, so the browser
   skill could not execute this visual gate.

Part 5 is implemented independently of the remaining Part 4 rollout work. Do not describe the
non-DSA Practice experience as fully launched merely because the feature flag can expose its routes
or because later plan revisions can consume verified evidence.

## Part 5 implementation status

Part 5's engineering acceptance gate is complete as of 2026-08-27.

Implemented:

- Added a versioned, validated read-only Practice evidence contract containing demonstrated skills,
  mastery and weak topics, code correctness, hint and retry dependence, and the 25 most recent
  verified question/code observations.
- Added deterministic aggregation and immutable fingerprinted persistence. The store queries only
  owner-scoped `VERIFIED` PREP/DSA attempts with a score, authored content-version snapshot, and
  evaluator-version snapshot; `UNVERIFIED`, `NOT_APPLICABLE`, legacy unsnapshotted, and skipped work
  cannot become demonstrated ability. Mastery discounts sparse, stale, hint-dependent, and
  retry-dependent evidence, gives bounded credit for harder questions, and uses a monthly recency
  bucket so decay can produce a new revision without plan churn on every read.
- Marked future DSA code-run attempts as verified only when they are backed by the existing test
  harness, recording `dsa-code-run-v1` and the question's real content version. Legacy code runs
  were intentionally not backfilled.
- Added an optional Practice-evidence snapshot to the existing plan contract so historical version-1
  plans still parse unchanged. Plan persistence verifies that the referenced evidence revision is
  owned by the candidate.
- Merged Practice and completed-interview skill observations by sample-weighted score/confidence for
  future generation. Existing relevance rules then raise weak-skill coverage, lower foundational
  starting difficulty when warranted, and increase difficulty for strong evidence. DSA pattern
  signals can also shape the future Final Mock.
- A changed verified-attempt fingerprint publishes a new immutable plan revision; an unchanged
  fingerprint reuses the existing evidence and plan. Stored interview sessions continue using their
  copied blueprint and live interview runtime was not modified.
- Deployed additive migration `20260827050000_practice_evidence_feedback`; it adds only
  `CandidatePracticeEvidenceVersion` and does not rewrite attempts, plans, blueprints, sessions, or
  reports.

Preservation counts captured before and after the Part 5 migration:

| Measure                       | Baseline | After migration |
| ----------------------------- | -------: | --------------: |
| Database DSA questions        |      200 |             200 |
| Database PREP questions       |       75 |              75 |
| Database question progress    |    2,289 |           2,289 |
| Database question attempts    |      138 |             138 |
| Database DSA notes            |        0 |               0 |
| Database PREP notes           |        0 |               0 |
| Interview plan versions       |        2 |               2 |
| Interview performance versions |      0 |               0 |
| Practice evidence versions    |        0 |               0 |

## Agent continuation ledger

Last updated: **2026-08-27**

This section is the operational handoff for future agents. Update it after every material Practice
Engine change. The earlier sections describe the intended system; this section describes what is
actually true in the repository now.

### Delivery state

| Part | State                   | What that means now                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Engineering gate passed | DSA data protection, normalized contract, runners, drafts, idempotency, automated audits, and UI implementation are in place. Human editorial and browser QA remain.                                                                                                                                                               |
| 2    | Engineering gate passed | Six stable slots are persisted and reconciled from the active interview plan. Regeneration, concurrency, route, preservation, and build gates pass. Manual browser QA remains.                                                                                                                                                     |
| 3    | Engineering gate passed | 75 non-DSA questions, 14 chapters, publication validation, candidate selection, 69 placements, Final Mock reuse, preservation, and live DB gates pass.                                                                                                                                                                             |
| 4    | Launch gate in progress | Engineering, editorial review, and deployment of all 30 version-2 PREP revisions are complete. Routes, default-off rollout, resilient state, idempotent verified evaluation, recommendations, observability, reviewed coaching, and automated gates exist. External alert wiring and browser QA remain. |
| 5    | Engineering gate passed | Owner-scoped verified attempts now produce immutable skill/topic evidence; changed evidence can influence only newly generated plan revisions. Unverified work and existing interview runtime/history are excluded.                                                                                                               |

Parts 2 through 4 are real persisted flows, not page-only projections. Non-DSA hrefs are supplied
only when the publication gate passes and `PRACTICE_NON_DSA_ENABLED` is enabled. Do not describe the
feature as fully launched until the remaining Part 4 release gate is complete.

### Routes currently shipped

| Route                            | Current behavior                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/practice`                      | Reconciles the persisted six-session roadmap and deterministic placements. Published non-DSA cards receive links only when `PRACTICE_NON_DSA_ENABLED` is enabled.         |
| `/practice/dsa`                  | Opens the implemented DSA session, its progress summary, chapters, and question list.                                                                                     |
| `/practice/[chapter]`            | Opens either the DSA chapter briefing or a stable-key non-DSA session with its ordered placed chapters and shared progress.                                               |
| `/practice/[chapter]/[question]` | Opens a placed non-DSA MCQ, typed, spoken, or diagram workspace with drafts, notes, hints, navigation, gated review, submit, retry, and skip.                             |
| `/api/practice/state`            | Reads or writes owned PREP drafts, monotonic revealed-hint counts, and notes after validation and rate limiting.                                                          |
| `/api/practice/attempt`          | Records an owned, idempotent submit or skip; private MCQ answers and authored evaluation material remain server-side.                                                     |
| `/dsa-questions/[slug]`          | Opens the DSA learning workspace with problem copy, examples, hints, editor, tests, notes, help, progress actions, and review material. It stays inside workspace chrome. |
| `/interviews`                    | Remains the interview source UI. Practice and Interviews share the roadmap session-card component.                                                                        |

Unavailable Practice cards must remain non-interactive. Do not point them at empty pages or report
zero questions as if that were a valid enabled session.

### Source-of-truth file map

Practice entry and visual alignment:

- `src/app/practice/page.tsx` loads the candidate's persisted Practice roadmap through the dedicated
  Practice application service.
- `src/components/workspace/practice/practice-sessions-view.tsx` renders the persisted six-card
  response and enables only records whose published bank is explicitly available.
- `src/lib/practice/practice-roadmap.ts` owns the six stable Practice keys, the response contract,
  legacy-template mapping, and the deterministic interview-plan projection.
- `src/server/practice/practice-roadmap.service.ts` provisions the underlying progress rows and
  transactionally reconciles personalized snapshots without resetting attempts or completion.
- `src/server/practice/practice-roadmap.integration.spec.ts` contains the opt-in rollback-based
  regeneration test and the disposable-candidate five-way concurrent first-load test.
- `src/app/practice/page.test.tsx` protects the authorization boundary and recoverable generator
  failure state.
- `src/server/app-container.ts` wires the Practice service to the existing roadmap provisioner and
  immutable personalized interview-planning service.
- `src/components/workspace/shared/roadmap-session-card.tsx` is the shared card used by Practice and
  Interviews. Change this component when both entry pages should change together.
- `src/components/workspace/interviews/interviews-view.tsx` uses the same shared card without
  changing interview behavior.
- `src/app/practice/dsa/page.tsx`, `src/components/workspace/dsa/dsa-topics.tsx`, and
  `src/components/workspace/practice/chapter-session.tsx` implement the DSA session and chapter
  journey.
- `src/app/dsa-questions/[slug]/page.tsx` and `src/components/workspace/dsa/*` implement the DSA
  question experience.
- `src/app/globals.css` contains the shared Interview/Practice surface treatments.
- `src/lib/workspace/workspace-routes.ts` keeps the full DSA journey inside signed-in workspace
  chrome.

Part 4 learner flow and verified evaluation:

- `src/app/practice/[chapter]/page.tsx` and
  `src/app/practice/[chapter]/[question]/page.tsx` enforce stable session placement and render the
  non-DSA session/question journey.
- `src/components/workspace/practice/prep-session-view.tsx` and
  `src/components/workspace/practice/prep-question-workspace.tsx` own chapter navigation and the
  MCQ, typed, spoken, and diagram learner controls.
- `src/lib/practice/prep-state-save-queue.ts` coalesces draft/note/hint changes and guarantees
  serial, retryable client delivery so an older request cannot overtake a newer edit. It also sends
  the current retry count to the protected state boundary without exposing learner content.
- `src/app/api/practice/state/route.ts`, `src/app/api/practice/attempt/route.ts`, and
  `src/server/practice/prep-practice.service.ts` enforce ownership, validation, rate limits, state
  transitions, and the protected attempt boundary.
- `src/server/practice/prep-practice-evaluator.ts` owns deterministic private-key MCQ grading and
  versioned authored-rubric AI evaluation for typed, spoken, and diagram answers.
- `src/server/practice/practice-telemetry.ts` owns content-safe metric event contracts and stable
  outage-signal names/windows/thresholds for state saves and answer evaluation.
- `src/server/roadmap/frontend-roadmap/service.ts` writes idempotent attempt evidence and derives
  canonical and Final Mock progress. Only a `VERIFIED` score at or above the passing threshold can
  complete a PREP question.
- `prisma/migrations/20260827030000_practice_experience/migration.sql` adds the durable PREP learner
  state and attempt foundation.
- `prisma/migrations/20260827040000_practice_verified_evaluation/migration.sql` adds content-version,
  evaluator-version, and verification-status snapshots without rewriting earlier attempts.

Part 5 verified feedback loop:

- `src/lib/practice/practice-evidence.ts` is the versioned read-only evidence contract.
- `src/server/practice/practice-evidence-aggregator.ts` deterministically derives skill/topic,
  mastery/weakness, code, hint/retry, and recency evidence from verified attempts only.
- `src/server/practice/practice-evidence-store.ts` owns immutable fingerprinted revisions and the
  owner-scoped `refresh`/`latest` read boundary.
- `src/server/interview/personalized-interview-planning.service.ts` snapshots the newest evidence
  only when selecting or generating a future active plan.
- `src/server/interview/personalized-plan-generator.ts` merges independent performance sources and
  applies the existing relevance/difficulty policy without changing live interview state.
- `prisma/migrations/20260827050000_practice_evidence_feedback/migration.sql` adds the immutable
  Practice evidence table and must not be rewritten after deployment.

DSA contracts and safety:

- `src/server/practice/questions/contracts.ts` is the normalized Practice question contract.
- `src/server/practice/questions/dsa-question-adapter.ts` adapts `DsaQuestion` into that contract.
- `src/lib/dsa/dsa-code-templates.ts` owns supported language capability, function names, and starter
  signatures.
- `src/server/dsa/code-test-harness.ts` builds runnable JavaScript, Python, Java, and C++ harnesses.
- `src/server/dsa/dsa-bank-audit.ts` protects counts, relationships, teaching structure, editorial
  minimums, authored examples, and advertised starter/harness composition.
- `src/lib/dsa/code-draft.ts` owns per-question and per-language local draft persistence.
- `src/app/api/roadmap/question-attempt/route.ts`, `src/app/api/code/run/route.ts`, and
  `src/server/roadmap/frontend-roadmap/service.ts` enforce idempotent DSA progress and run evidence.
- `prisma/migrations/20260827000000_dsa_practice_foundation/migration.sql` is the deployed additive
  Part 1 migration. It must not be rewritten after deployment.
- `prisma/migrations/20260827010000_persisted_practice_roadmap/migration.sql` is the deployed
  additive Part 2 persistence migration. It adds stable keys, source revisions, personalized
  session snapshots, and explicit availability; it must not be rewritten after deployment.

Part 3 banks and placement:

- `src/data/prep/frontend-expanded.json` contains 13 newly authored frontend core/architecture
  questions. The other published prep content comes from the existing prep JSON and the canonical
  conversion of `src/data/fundamentals/*.json` in `prisma/seed.ts`.
- `src/server/practice/questions/prep-question-adapter.ts` normalizes published prep questions and
  strips private answers.
- `src/server/practice/questions/prep-bank-audit.ts` owns question-quality and minimum-coverage
  publication rules. Update its tests when the publishing contract changes.
- `src/server/practice/practice-question-placement.ts` owns deterministic role/level/topic/evidence
  ranking, chapter balancing, selection reasons, bulk reconciliation, and Final Mock reuse.
- `src/server/roadmap/frontend-roadmap/service.ts` lazily backfills template version 2 and calculates
  session counters from placements when they exist.
- `prisma/seed.ts` publishes all canonical banks and their ordered PREP roadmap chapters/mappings;
  it fails before roadmap publication if the audit fails.
- `prisma/migrations/20260827020000_practice_question_banks/migration.sql` is the deployed additive
  Part 3 migration. It adds versioned prep fields, canonical uniqueness, and
  `PracticeQuestionPlacement`; it must not be rewritten after deployment.

Part 2 persistence currently stores:

- source interview plan ID and revision on `UserRoadmap`;
- source candidate-profile version ID and revision on `UserRoadmap`;
- a generator version so future reconciliation changes are detectable;
- one stable `practiceSessionKey` per `UserSessionProgress`, independent of regenerated blueprint
  UUIDs;
- candidate-facing title, purpose, coverage, difficulty, and duration snapshots;
- the source blueprint ID/kind when a slot comes from the personalized plan;
- `AVAILABLE` or `UNAVAILABLE` separately from learning progress status.

The stable order is `frontend-dsa`, `core-technical`, `applied-engineering`,
`architecture-system-design`, `resume-behavioral-defense`, and `final-mock`. The resume slot is
inserted before the final mock to match `/interviews`.

### Verification inventory

The last complete normal verification passed on 2026-08-27 after the Part 5 verified-feedback
checkpoint:

- Prisma schema validation;
- application TypeScript and repository-wide ESLint;
- 108 Vitest tests and 457 Jest tests, 565 normal tests total, with 10 opt-in Jest tests skipped;
- production Next.js build.

Part 5 verified-feedback checkpoint completed on 2026-08-27:

- local `pnpm dev` now regenerates Prisma Client before starting Next.js, preventing a long-lived
  pre-migration client from rejecting the verified-evidence fields after schema changes;
- focused tests prove unverified and unsnapshotted attempts are excluded, fingerprints are stable,
  mastery/weakness and hint/retry signals are deterministic, and DSA code correctness is retained;
- planning tests prove a changed Practice evidence revision is owner-scoped, snapshotted, and can
  alter future coverage/difficulty while old plans without the optional snapshot still parse;
- the additive migration deployed successfully with all nine tracked database counts preserved;
- Prisma validation, application and seed TypeScript, repository-wide ESLint, all 565 normal tests,
  and the production build pass.

Part 4 deterministic-recommendation checkpoint completed on 2026-08-27:

- session recommendations read only `VERIFIED` PREP attempt scores from immutable attempt history;
  the best verified pass establishes prerequisite mastery, while the latest verified score and
  timestamp drive weak-topic retries and spaced-review timing;
- passing reviews are scheduled at deterministic score bands and shortened when the answer needed
  hints or repeated attempts. Skips receive a one-day cooldown instead of disappearing forever;
- verified prerequisite demand promotes a placed foundation before the questions it unlocks, while
  unmet prerequisites receive an explicit penalty and explanation;
- the latest immutable interview performance profile contributes only demonstrated weak-skill
  matches, using question competency, tags, objectives, and authored test signals;
- session-level verified results choose foundational, intermediate, or advanced difficulty, and
  stable placement order plus canonical question ID resolve every equal-score tie;
- focused tests cover stable ordering, latest-versus-best verified evidence, review intervals,
  hint/retry dependence, skip cooldown, interview gaps, prerequisite unlocking, adaptive
  difficulty, and candidate-facing evidence explanations;
- no schema migration, database write, or change to DSA recommendation behavior was required.

Part 4 PREP editorial checkpoint completed on 2026-08-27:

- reviewed all 75 published source questions across the frontend, resume/behavioral, browser/OS,
  database, networking, and systems banks for factual clarity, teaching tone, rubric alignment, and
  progressive coaching;
- replaced seed-generated coaching for 20 frontend and behavioral questions with three authored
  progressive hints and a question-specific post-submission explanation, then incremented each
  question to content version 2;
- corrected overbroad or implementation-dependent wording in 10 fundamentals questions covering
  browser process isolation, index selection, rollback semantics, isolation levels, HTTP/2
  multiplexing, TCP versus UDP, TLS service identity, redirect caching, latency comparisons, and
  HTTP idempotency; the fundamentals adapter now preserves per-question content versions;
- added source-level tests that require versioned, unique, substantial hints and explanations for
  every authored PREP question and structurally teachable concepts, answer keys, and open-answer
  signals for every fundamentals question;
- the browser-control skill found no connected browser while the local `/practice` route responded,
  so signed-in visual QA remains open. No schema migration, database write, or DSA content change was
  required for this editorial checkpoint; the later deployment checkpoint records the completed
  preservation-safe seed.

Part 4 reviewed-content deployment checkpoint completed on 2026-08-27:

- ran the normal audited `pnpm prisma:seed` path against the configured database;
- deployed all 30 reviewed questions at content version 2, leaving the other 45 questions at
  version 1;
- preserved 200 DSA questions, 75 PREP questions, 2,289 question-progress rows, 138 attempts, zero
  DSA notes, zero PREP notes, two interview-plan versions, and zero Practice-evidence versions;
- the seed's publication audit passed, followed by Prisma schema validation and seed TypeScript.

Part 4 observability checkpoint completed on 2026-08-27:

- `/api/practice/state` emits `practice.state_save_succeeded` or
  `practice.state_save_failed` with duration, retry count, changed field names, and sanitized error
  code; it never logs draft or note content;
- the serialized client save queue sends retry count `0` initially and increments it only after a
  failed delivery, allowing success-after-retry rates to be derived without parallel requests;
- MCQ and authored-rubric evaluators emit `practice.answer_evaluation_completed` with verified
  outcome and latency. Provider/schema failures emit `practice.answer_evaluation_unverified` with
  an unverified counter delta and sanitized error code;
- persisted attempt events include `attemptMetricDelta` and `unverifiedAttemptDelta`, so actual
  stored unverified evidence can be counted separately from evaluator calls;
- infrastructure save failures carry alert signal `practice-state-save-outage` with a suggested
  threshold of 10 events in 300 seconds. Evaluator failures carry `practice-evaluator-outage` with a
  suggested threshold of 5 events in 300 seconds. Candidate-caused 4xx failures are counted but do
  not carry an outage signal;
- focused tests protect metric fields, retry propagation, content redaction, latency, unverified
  counters, bounded retry reporting, alert policies, and 4xx alert suppression;
- external log-dashboard/alert provisioning remains a deployment task. No schema migration or
  permanent-data mutation was required for this checkpoint.

Part 4 launch-flag checkpoint completed on 2026-08-27:

- `.env.example` documents `PRACTICE_NON_DSA_ENABLED=false`, environment parsing defaults an absent
  value to false, and `AppConfigService` also falls back to false when constructed without the
  parsed field;
- an explicit `PRACTICE_NON_DSA_ENABLED=true` still activates the published non-DSA routes, so
  existing deliberate local/production configuration is preserved;
- tests protect both explicit activation and the launch-safe absent/config-fallback paths;
- no schema migration, database write, or change to the current local `.env` was required.

Part 4 dictation-control checkpoint completed on 2026-08-27:

- the workspace retains the active `SpeechRecognition` instance and calls its real `stop()` method;
  the button exposes listening, stopping, and idle states instead of changing UI state alone;
- transcript handling starts at the browser-provided `resultIndex`, accepts only final results, and
  records consumed indexes per recognition session, preventing repeated events from duplicating
  earlier speech;
- submission and ordinary Practice navigation wait for recognition to deliver its final result,
  then flush that answer through the hardened save queue. A 1.5-second fallback abort prevents a
  broken browser implementation from blocking the learner indefinitely;
- recognition errors preserve the existing draft, expected stop events do not show false errors,
  and workspace unmount detaches callbacks and aborts any remaining session;
- simulated browser tests prove repeated result events append once, interim results remain eligible
  for later finalization, Stop invokes the active recognition object, and a final transcript emitted
  during Stop is included in the submitted answer;
- no schema migration or permanent-data mutation was required for this checkpoint.

Part 4 autosave-resilience checkpoint completed on 2026-08-27:

- rapid editor and note changes are coalesced, and only one state request is sent at a time; newer
  values supersede older or failed values without dropping unrelated dirty fields;
- every state request uses fetch keepalive, ordinary in-workspace navigation waits for a successful
  flush, and page exit or component unmount immediately starts a pending flush;
- reveal-hint and answer-submission actions flush pending draft/note state first; a failed flush is
  visible and retains its fields for retry rather than silently navigating away;
- the state service now reads and writes under the same per-owner advisory lock as attempts, making
  revealed-hint count monotonic even across concurrent tabs;
- the live five-way first-load gate exposed that its intentional owner-lock queue could exceed an
  existing 30-second interactive-transaction ceiling. Only the provisioning/reconciliation
  ceilings were raised to the established 120-second bounded-write value; the final live suite
  passed in 57.8 seconds;
- focused tests cover serial/coalesced ordering, failed-field retry, debouncing, keepalive delivery,
  navigation flushing, and unmount flushing. The live suite additionally proves concurrent lower
  hint writes cannot overwrite a higher revealed count and leaves zero disposable profiles;
- no schema migration or permanent-content mutation was required for this checkpoint.

Part 4 verified-evaluation checkpoint completed on 2026-08-27:

- deployed additive migration `20260827040000_practice_verified_evaluation`; migration status
  reports all 38 migrations applied;
- every new PREP attempt snapshots the question content version, evaluator version, and
  `VERIFIED`, `UNVERIFIED`, or `NOT_APPLICABLE` evidence state;
- MCQs are graded deterministically from the private server-side key; typed, spoken, and diagram
  answers use the authored rubric and structured evaluator contract;
- evaluator failure stores an unscored `UNVERIFIED` attempt and cannot complete the question;
  skip stores `NOT_APPLICABLE`, while only a `VERIFIED` score of at least `0.72` completes it;
- unit and UI tests cover rubric input, score-band enforcement, outage behavior, skipped evidence,
  pending-verification rendering, and verified-only progress transitions;
- the opt-in live database suite passed preservation, lazy backfill, Final Mock shared progress,
  idempotent retry, and five concurrent first loads; cleanup returned
  `practice-integration-*` profiles to zero;
- the migration itself preserved 138 attempts and all 45 candidate profiles. A normal Practice load
  before migration deployment had already lazily added 75 PREP progress rows and 15 chapter rows to
  one permanent roadmap, so the post-checkpoint totals are 18 roadmaps, 105 sessions, 231 chapters,
  2,289 question-progress rows, and 138 attempts; none of that lazy backfill was caused by the
  verified-evaluation migration;
- no legacy attempt was rewritten: the database currently contains zero PREP attempts and therefore
  zero populated verification snapshots until the gated learner flow receives its first attempt.

Part 3 checkpoint verification completed on 2026-08-27:

- migration `20260827020000_practice_question_banks` deployed and `prisma migrate status` reports
  the schema up to date;
- the publication audit passes 75/75 questions with session counts 12, 42, 12, and 9;
- the active template contains 198 mappings: 123 DSA and 75 PREP;
- the permanent before/after candidate totals remain 45 profiles, 18 roadmaps, 105 session rows, 216
  chapter rows, 2,214 question progress rows, and 138 attempts;
- a disposable candidate produced exactly 198 canonical progress records and 69 placements with
  session totals `123, 12, 24, 12, 9, 12`;
- Final Mock's 12 placement IDs all reference progress already selected by earlier sessions;
- the same disposable candidate was downgraded to template version 1, its PREP progress removed,
  and a normal load restored all 75 PREP records and 69 placements;
- five concurrent first loads converge on one six-slot roadmap without deadlock; the disposable
  candidate is removed in `finally`, returning all permanent counts to baseline;
- the selector, prep adapter/private-answer boundary, publication gate, service idempotency,
  live-database suite, normal suite, and production build all pass.

Part 2 checkpoint verification completed on 2026-08-27:

- Prisma format, validation, and client generation passed;
- TypeScript passed after the persisted-service and UI switch;
- ESLint passed for every Part 2 file and the touched roadmap/container files;
- projection tests prove six stable keys/order and stability across regenerated blueprint IDs;
- the service test proves all six records reconcile and existing progress counters are absent from
  update writes;
- a second service test proves identical plan/template inputs cause no session or roadmap writes;
- the Practice view test proves only the available persisted DSA slot is linked;
- the Practice page tests prove authorization stops before generation and generator failure renders
  a recoverable alert without implying data loss;
- the opt-in Practice database integration command passed both rollback regeneration/no-data-loss
  and five concurrent first-load tests:

  ```bash
  RUN_PRACTICE_DB_INTEGRATION=1 pnpm exec jest src/server/practice/practice-roadmap.integration.spec.ts --runInBand
  ```

- migration `20260827010000_persisted_practice_roadmap` deployed successfully;
- before and after database totals remained exactly 18 roadmaps, 105 session progress rows, 216
  chapter progress rows, 2,214 question progress rows, and 138 attempts;
- the concurrency test's wider baseline also returned exactly to 45 candidate profiles, with zero
  `practice-integration-*` test profiles left behind;
- all 105 pre-existing session rows received a non-empty stable key; DSA rows are `AVAILABLE` and
  empty banks are `UNAVAILABLE`;
- three older roadmaps currently lack the later Applied Engineering template row. The existing
  idempotent template reconciliation adds it on the next Practice load without deleting history.

Run the normal gate after material changes:

```bash
pnpm exec prisma validate
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

The expensive runner checks are intentionally opt-in and were also passing at the Part 1 handoff:

```bash
RUN_DSA_LOCAL_COMPILER_AUDIT=1 pnpm exec jest src/server/dsa/dsa-local-compiler-audit.spec.ts --runInBand
RUN_DSA_JUDGE0_SMOKE=1 pnpm exec jest src/server/dsa/dsa-judge0-smoke.spec.ts --runInBand
```

The Judge0 smoke suite requires the configured external credentials and makes real submissions.
The local compiler audit compiles every advertised Java and C++ starter/harness contract and takes
longer than the normal suite.

### Known remaining work

Part 1 manual closure:

1. Review all 200 questions for teaching tone, factual clarity, and genuinely progressive hints.
   Automated checks only enforce objective minimums.
2. Test `/practice`, `/practice/dsa`, representative chapter pages, and representative question
   pages at desktop and mobile widths with keyboard and screen-reader-oriented checks.
3. Exercise loading, unavailable-bank, empty-progress, runner error, failed tests, note error,
   complete, skipped, and all-complete states in a real browser.

Part 2 manual verification:

1. Complete browser QA for desktop/mobile loading, unavailable, and generator-failure states when a
   browser session is available. Automated semantic/accessibility assertions already cover these
   branches, but visual inspection has not happened.
2. Keep non-DSA links controlled by the launch flag until the remaining Part 4 resilience and
   browser-QA items pass; publication alone is not a launch decision.

Part 3 manual/content follow-up:

- Visually inspect the published-bank/pending-workspace card state when a browser session is
  available.

Part 4 release follow-up:

- Keep the now-default-off non-DSA launch flag disabled until rollout is deliberate, connect the
  Vercel Log Drain and test-fire the two documented production alerts, and complete signed-in
  desktop/mobile browser QA for all answer formats and outage paths.
- Part 5 is complete; keep its evidence contract additive and do not use it to rewrite historical or
  in-progress interview state.

### Non-negotiable handoff rules

- Never delete, truncate, or destructively reseed the DSA bank or candidate history.
- Never change a deployed migration; add a new migration instead.
- Capture database counts before and after every Practice migration.
- Reconcile by stable Practice session key and canonical question identity, not a mutable blueprint
  ID.
- Keep hidden answers, tests, and private rubric material server-side until the configured reveal
  point.
- Do not enable a session until its chapters, placements, prompts, rubrics, answers, and tests pass
  publication validation.
- Preserve unrelated working-tree changes. This repository may already contain in-progress work
  outside the Practice Engine.

### Required update protocol for future agents

After every material Practice Engine change, update this ledger with:

1. the date and delivery-state table;
2. exactly what route, schema, contract, behavior, or bank was added or changed;
3. what remains incomplete, including manual verification;
4. migration names and before/after counts when data changed;
5. verification commands run and their actual results;
6. the next safe task another agent should begin with.

Do not replace an incomplete item with vague wording such as “mostly done.” Distinguish implemented,
tested, deployed, manually verified, unavailable, and deferred states explicitly.
