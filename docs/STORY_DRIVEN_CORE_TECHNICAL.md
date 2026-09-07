# Story-Driven Core Technical: Build Plan

## Goal

Ship one complete Core Technical loop:

```text
Initial assessment + resume + target
        → choose practice language
        → derive role/level/stack context from the saved profile and resume
        → personalized 8-question story
        → block assessment
        → report
        → next adaptive story
```

Shared rules live in
[STORY_DRIVEN_ADAPTIVE_PRACTICE.md](./STORY_DRIVEN_ADAPTIVE_PRACTICE.md). Do not implement the
older [CORE_TECHNICAL_ADAPTIVE_PRACTICE.md](./CORE_TECHNICAL_ADAPTIVE_PRACTICE.md); it describes
the removed fixed-bank flow.

## Build progress — update this after every completed step

This table is the handoff record for future agents. Before starting work, read it and verify the
linked implementation. When a step is completed, change its status to **DONE**, add the completion
date and exact files/tests, and update the totals. Never mark a step done for scaffolding alone.

Allowed statuses are **NOT STARTED**, **IN PROGRESS**, **AWAITING HUMAN REVIEW**, and **DONE**.
Content requiring human approval cannot move from **AWAITING HUMAN REVIEW** to **DONE** based only
on model output or automated tests.

**Current total: 13 DONE, 0 AWAITING HUMAN REVIEW, 1 IN PROGRESS.**

|   # | Step                                                   | Status          | Completed  | Completion evidence                                                                                               |
| --: | ------------------------------------------------------ | --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
|   1 | Versioned domain coverage map                          | **DONE**        | 2026-09-06 | `src/lib/practice/core-technical/domain-map.ts`; coverage audit tests                                             |
|   2 | Source-backed interview-pattern catalogue              | **DONE**        | 2026-09-06 | `interview-patterns.ts`; independent-source and orphan checks                                                     |
|   3 | Story generator foundation                             | **DONE**        | 2026-09-06 | `story-generator.ts`; multi-candidate validation and local scoring tests                                          |
|   4 | Question generator foundation                          | **DONE**        | 2026-09-06 | `question-generator.ts`; candidate generation, private bundle, and serializer tests                               |
|   5 | Independent generator critics                          | **DONE**        | 2026-09-06 | `generation-critic.ts`, `generation-pipeline.ts`; 9 critic/pipeline tests; full suite green                       |
|   6 | Human-reviewed gold fixtures and generator evaluation  | **DONE**        | 2026-09-07 | Project-owner approval recorded; release-ready structural audit and evaluator tests                               |
|   7 | Generate, test, and approve the first two stories      | **DONE**        | 2026-09-07 | Two approved artifacts; 100/100 evaluations; executable audit; immutable versions published                       |
|   8 | Initial-assessment evidence service                    | **DONE**        | 2026-09-06 | `baseline-evidence.service.ts`, registry/contracts, 12 focused tests; full suite green                            |
|   9 | Personalized focus revision and story ranking          | **DONE**        | 2026-09-07 | Focus/ranking contracts and services, reviewed story catalogue, 10 focused tests; full suite green                |
|  10 | Database models, migration, immutable publishing       | **DONE**        | 2026-09-07 | 12 active models, guarded migration, atomic persistence service, 11 focused tests; full suite green               |
|  11 | Pinned secure Node.js 22 runner                        | **DONE**        | 2026-09-07 | Node 22.23.2 registry/sandboxes, executable audits, security/limit checks, 7 focused runner tests                 |
|  12 | Practice lifecycle services and APIs                   | **DONE**        | 2026-09-07 | Owner-safe lifecycle/preparation services, 8 authenticated endpoints, 5 lifecycle tests; 1,062 total tests passed |
|  13 | Assessment, report, and adaptive next story            | **DONE**        | 2026-09-07 | Frozen assessment/report/adaptation/history services, 3 APIs, 7 consolidated tests; 1,070 total passed            |
|  14 | DSA-exact UI, integration, and end-to-end verification | **IN PROGRESS** | —          | 14.1–14.6 done; approval/publication complete; release-environment authenticated E2E remains                      |

Steps 1–7 prove content quality before persistence or UI work. Steps 8–13 build the adaptive
candidate lifecycle. Step 14 is last so the UI consumes reviewed, frozen contracts instead of
driving their design. Step 14 has seven independently tracked implementation parts; its top-level
status becomes **IN PROGRESS** when any part starts and **DONE** only when every part is done.

### Step 6 human-review completion

Project owner `nikhilverma` approved both cases on 2026-09-07 after reviewing each case's
eight-pattern order, primary mechanisms, difficulty, coverage rationale, and 40–50 minute scope.
The approval identity, date, and notes are recorded in
`src/lib/practice/core-technical/gold-cases.ts`; the structural audit is release-ready and the
evaluator reports `releaseEligible: true`.

### Step 7 human-review completion

The two complete private review artifacts are frozen in
`src/lib/practice/core-technical/generated/`. Both contain eight questions, passed every automated
critic, scored 100/100 in the gold evaluator, and pass the executable-contract audit. Project owner
`nikhilverma` approved every prompt, artifact, hint, answer, rubric, test, interviewer follow-up,
and production claim on 2026-09-07. The two immutable version-1 stories were published through
`CoreTechnicalPersistenceService.publishReviewedStoryVersion`; replay returned the same records.

### Step 8 implementation note

`CoreTechnicalBaselineEvidenceService` reads the three owner-scoped private baseline snapshots,
resolves their Node.js domain concepts through a versioned section/ID/canonical-fingerprint
registry, grades the saved answers, and returns a deeply frozen safe evidence contract. The public
fingerprint deliberately excludes option IDs and the answer key so it cannot be used to enumerate
the correct option. Missing snapshots, changed question content, invalid selections, and incomplete
answers resolve to `UNKNOWN`. Step 9/10 must persist this returned evidence object and source
fingerprint unchanged in the confirmed focus revision; the service does not create that later model.

### Step 9 implementation note

`CoreTechnicalFocusService` builds the immutable confirmed-focus payload from the candidate's
saved target, level, date, headline, minimized resume signals, resume-derived framework, the
selected language's reviewed Node.js 22 execution vertical, and the exact frozen Step 8 evidence.
The browser supplies only the language; it cannot author role, seniority, runtime, framework,
target job, or exclusions. `CoreTechnicalStoryRankingService` then applies the versioned
35/25/15/15/10 first-story policy after publication, role, stack, framework, difficulty,
prerequisite, catalogue-integrity, and exclusion gates. It returns the full score breakdown,
selected story/version, difficulty, emphasized concepts, and candidate-facing reason. The two
catalogue entries are now `published`; runtime selection additionally requires their exact
immutable versions to exist as `PUBLISHED` database records. Step 10 owns the database revision and
transactional persistence of these frozen outputs.

### Step 10 implementation note

The active story-driven path has separate models for confirmed focus revisions, story
definitions/versions, owner-scoped story progress, blocks, frozen questions, question state,
attempts, code runs, assessments, reports, and preparation attempts. It does not reuse or modify
the retired `CoreTechnicalTrackVersion`/`PrepPractice*` flow. The migration enforces owner-bound
composite relations, one current block per owner, unique eight-slot order, one assessment/report,
owner-scoped idempotency keys, bounded lifecycle values, and `RESTRICT` links from candidate
history to source story/focus versions.

`CoreTechnicalPersistenceService` saves content-addressed focus revisions, refuses to publish a
story without release-eligible human approval, and publishes all eight public/private question
snapshots, initial question states, the locked assessment, story progress, and preparation result
atomically. Replays return the same block, concurrent requests converge on the existing current
block, and bounded failure diagnostics never create partial content. Both approved artifacts are
published as immutable version-1 story records. The replay-safe `pnpm core-technical:publish`
command validates the gold audit, artifact approval, release eligibility, catalogue state, and
database/catalogue version agreement before publishing.

### Step 11 implementation note

`CoreTechnicalRunnerService` is pinned to Node.js 22.23.2 and resolves executable contracts through
a data-driven registry. Candidate, starter, reference, generated assertion, and wrong-solution code
cross a narrow executor interface and run in a fresh read-only temporary submission sandbox; none
is evaluated in the application process. Production uses a fresh network-denied Vercel Firecracker
microVM; local macOS uses Seatbelt and local Linux uses Bubblewrap. Unsupported platforms,
unavailable isolation, or a mismatched runtime identity fail closed.

Each run enforces the frozen question's timeout and memory ceiling, a 64 KiB combined-output limit,
one candidate process, no network, no host-file writes, and no reads from user/private host data.
The runner returns bounded public results, hidden-test aggregates only, the exact runner/runtime
identity, code fingerprint, and test-suite fingerprint for Step 12's owned durable run binding.

Executable generation now requires sandboxed assertion bodies and realistic wrong-solution mutants.
The generation pipeline parses the starter, proves it fails through the authored assertions, parses
and runs the reference against public and hidden tests, and proves every mutant is rejected before
returning the block. The four executable questions in the two approved Step 7 artifacts pass this
audit and their private test contracts are included in the recorded project-owner approval.

### Step 12 implementation note

`CoreTechnicalPreparationService` now owns confirmation and recoverable, all-or-nothing block
preparation. It ranks only release-eligible catalogue entries, regenerates against the frozen
reviewed story contract, and records bounded private diagnostics without publishing partial
questions. A failed generation can be retried under the same preparation request ID; a successful
request replays its current block. Preparation remains fail-closed unless both release-approved
catalogue entries and their exact published database versions are available.

`CoreTechnicalPracticeService` provides owner-scoped current/question reads and durable draft,
explicit-level hint, code-run, attempt, and confirmed Learn transitions. Draft and hint retries are
naturally idempotent, while runs and attempts bind owner-scoped request IDs to exact question,
content, and work/code fingerprints. MCQ and code results remain deterministic; written/spoken
answers use a bounded evaluator. Code questions become `COMPLETED` only from the matching owned
accepted run, while a failed run remains retryable evidence. Learn authorizes only the concise
answer projection and contributes zero mastery.

When the eighth question becomes `COMPLETED` or `LEARNED`, a block-level serialized transaction
makes the block, assessment, and story progress READY together. Public serializers reconstruct
only candidate-safe fields from frozen snapshots: revealed hints, the candidate's own work, public
test details, hidden-test aggregates, concise coaching, and authorized answers. Raw rubrics,
correct-choice indices, hidden tests, mistakes, sources, and private snapshots never enter API
output. The base read plus confirm, prepare, draft, hint, run, attempt, and learn routes enforce
authentication, completed onboarding/baseline, strict schemas, shared rate limits, and distributed
double-submit leases. One consolidated lifecycle spec covers serializer privacy, hint replay/order,
attempt replay conflicts, deterministic grading, Learn, and atomic assessment readiness.

### Step 13 implementation note

Assessment readiness now freezes a five-prompt private/public snapshot from the exact eight saved
question versions: weak-response review, code-evidence defence, unseen diagnosis transfer,
repair/implementation transfer, and production verification. `CoreTechnicalAssessmentService`
starts or resumes the single owner-scoped assessment idempotently. Finalization first checkpoints
the five validated answers and request fingerprint in `FINALIZING`; evaluator or infrastructure
failure therefore remains retryable without losing the submission. Report creation and the
assessment, block, and story-progress `ASSESSED` transitions commit atomically.

`CoreTechnicalAssessmentEvaluator` persists the five required scores, prompt feedback, teacher
summary, strengths, improvements, exact evaluator/scoring versions, and the solved-versus-learned
distinction. Learned questions contribute zero Practice mastery. Saved runner evidence remains
authoritative: missing accepted code evidence caps the debugging/implementation score before that
score can affect adaptation. The transcript is rebuilt through a separate allowlisted schema and
contains only public prompts and the candidate's submitted answers; private expected answers,
rubrics, hidden tests, and model inputs are excluded.

`CoreTechnicalStoryRankingService.rankNextStory` applies the frozen 30/25/20/15/10 post-assessment
policy across assessment weakness, verified Practice weakness, target fit, planned coverage, and
novelty. It requires a compatible published story not already used in the current path and saves
the full evidence, score breakdown, difficulty, emphasis, and candidate-facing reason in the
report. `CoreTechnicalContinuationService` keeps that completed report current until an explicit
Continue request successfully publishes all eight questions for the recommended story. The old
block is demoted only inside the same publication transaction; generation failure leaves it and
its report selected for Retry.

Owner-scoped snapshot-only history reads never join mutable catalogue content. Assessment start,
finalize, and Continue are exposed through authenticated, onboarding-gated, rate-limited APIs with
distributed double-submit leases. Seven tests in one consolidated assessment lifecycle spec cover
prompt privacy, adaptive ranking, deterministic score caps, zero-credit Learn evidence,
start/resume, durable/atomic finalization, continuation, and history; the atomic block-publication
test also proves current-block handoff. The full repository gate passes with 1,070 tests. Both story
versions are now available to the supported Node.js runtime path after completing the Step 6/7
approval and publication gate.

### Step 14 execution plan — DSA-exact UI, integration, and release

Step 14 changes presentation and integration only. The frozen contracts and lifecycle rules from
Steps 8–13 remain authoritative. UI components must consume candidate-safe service/API projections;
they must not query private snapshots, duplicate scoring logic, infer lifecycle transitions, or
make unpublished stories available.

Track each part independently in this table. A part is **DONE** only when its implementation and
listed checks pass; creating routes or component shells is not sufficient.

| Part | Scope                                          | Status          | Completion evidence                                                                                           |
| ---: | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| 14.1 | Contract map and DSA visual baseline           | **DONE**        | 2026-09-07 · `CORE_TECHNICAL_UI_BASELINE.md`, exhaustive `ui-state.ts`, UI integration tests                  |
| 14.2 | Practice entry, eligibility, and preparation   | **DONE**        | 2026-09-07 · Eligible/resumable card, fail-closed APIs, replay tests, desktop/mobile evidence                 |
| 14.3 | Story overview, progress, and history shell    | **DONE**        | 2026-09-07 · Public story shell/history plus DSA-style downward story library without nested questions        |
| 14.4 | Eight-format question workspace                | **DONE**        | 2026-09-07 · DSA-exact split workspace/tabs/meta/test tray; format-specific inputs; Step 12 mutation coverage |
| 14.5 | Assessment, report, and Continue experience    | **DONE**        | 2026-09-07 · Five-prompt lifecycle, checkpoint restore, full report, replay-safe Continue, 6 component tests  |
| 14.6 | Resilience, privacy, accessibility, and parity | **DONE**        | 2026-09-07 · Failure matrix, payload audit, 44px targets, keyboard/axe/browser checks, DSA parity evidence    |
| 14.7 | End-to-end verification and release gate       | **IN PROGRESS** | 2026-09-07 · approval/publication and automated gates green; release-environment authenticated flow remains   |

#### 14.1 Contract map and DSA visual baseline

Purpose: establish the exact UI states and reuse boundary before building feature components.

- Inspect the DSA practice page, topic shell, question workspace/editor, assessment preview, and
  Practice card. Record the existing page width, responsive breakpoints, spacing, typography,
  borders, radii, shadows, buttons, pills, icons, focus rings, sticky regions, and locked states.
- Map every candidate-safe Core Technical contract to an explicit view state: eligibility,
  confirmation, preparing, preparation failure, active block, each question state, assessment
  locked/ready/in progress/finalizing/completed, report, continuation failure, and history.
- Define the page and component boundary under `src/app/practice/core-technical/` and
  `src/components/workspace/core-technical/`. Server pages call services directly; client
  components call mutation APIs only.
- Reuse or carefully extract DSA primitives when both experiences can share them. Do not introduce
  a Core-Technical-only visual token or silently change DSA.

Completion checks:

- The state map is exhaustive against the Step 12/13 public unions and TypeScript rejects an
  unhandled lifecycle state.
- A source-anchored desktop/mobile DSA reference inventory exists for later screenshot comparison.
- Any extracted shared primitive leaves the existing DSA render and behavior unchanged.

#### 14.2 Practice entry, eligibility, and preparation

Purpose: connect Practice to the first Core Technical block without weakening availability gates.

- Extend the practice roadmap and Practice page with a Core Technical card only when the confirmed
  stack has validated content and an available compatible runner. Keep the DSA card unchanged.
- Add `/practice/core-technical` with a centered, first-entry language modal, unsupported/unavailable,
  preparing, retry, and resumable-current-block states.
- Show the confirmed role, language, runtime, framework, exclusions, difficulty, selected story,
  and saved plain-language recommendation reason using only public projections.
- Connect confirm and prepare mutations with stable request IDs, double-submit prevention,
  recoverable errors, and refresh-safe routing to the current block.

Completion checks:

- Unsupported stacks cannot see an actionable launch control and cannot trigger preparation.
- Refresh, back/forward navigation, replayed clicks, and preparation failure preserve the correct
  server-owned state and never create a second block.
- Practice routing and the existing DSA entry continue to work at desktop and mobile widths.

#### 14.3 Story overview, progress, and history shell

Purpose: build the shared story-level shell around questions, assessment, report, and history.

- Render the story hero, recommendation reason, difficulty, ordered eight-question path, completion
  progress, current item, terminal `COMPLETED`/`LEARNED` distinction, and assessment lock/readiness.
- Keep the full incident description in the hero while the teacher speech bubble uses a concise
  coaching prompt. Show each question's story difficulty and a deterministic format-weighted time
  estimate using the same metadata treatment as DSA.
- Keep the selected block encoded in the URL where history is viewed. Read history through the
  owner-scoped snapshot-only history service and never reconstruct old pages from mutable catalogue
  records.
- Restore the current question or current report after refresh. A completed report remains the
  selected current experience until Continue successfully publishes the next block.
- Follow the selected block with a downward `Explore all Core Technical` library sourced only from
  database-verified published story identities. Each card exposes story metadata, status, and
  aggregate progress; question rows remain exclusive to the selected practice block for now.
- Match DSA navigation, progress, assessment-card, locked, selected, hover, and sticky treatments.

Completion checks:

- Direct links to an owned current or historical block render from frozen public snapshots.
- Foreign/missing block IDs fail safely without leaking whether another owner's block exists.
- Question, assessment, report, and history navigation preserve selection and browser history.

#### 14.4 Eight-format question workspace

Purpose: deliver the complete durable question loop inside the DSA-exact workspace.

- Build one shared question shell with renderers for MCQ, predict/explain, written, spoken-or-typed,
  artifact diagnosis, editable repair, micro-implementation, and final production reasoning.
- Show only public prompt/artifact data. Save drafts, reveal progressive hints, submit attempts,
  confirm Learn, show concise feedback and the post-attempt Interview connection, and restore all
  durable state after refresh.
- Reuse the DSA editor treatment for executable questions. Run candidate code through the existing
  pinned runner API, display public-test detail plus hidden-test aggregates, and allow completion
  only from the accepted owned run bound to the exact code fingerprint.
- Disable or label actions from server lifecycle state, not optimistic local guesses. Make pending,
  replayed, failed, terminal, and learned states visibly distinct using existing DSA treatments.

Completion checks:

- All eight formats render and complete through their real Step 12 mutation path.
- Draft, hint, attempt, Learn, run, feedback, and navigation behavior survives refresh and retry.
- Keyboard-only use, editor focus, validation announcements, hint order, and terminal-state controls
  work without exposing answers, rubrics, hidden tests, correct-choice indices, or model inputs.

Implementation evidence: the question route now uses the same viewport-sized `112rem` shell,
compact metadata toolbar, `0.82fr / 1.18fr` responsive split, tab treatment, editor surface, runner
toolbar, collapsible test-results tray, and mobile stacking behavior as DSA. MCQ uses a polished
choice surface; predict/explain, written, spoken-or-typed, artifact diagnosis, and production
decision use a dedicated response surface; debug/repair and micro-implementation alone mount the
shared editable Monaco editor. Code-bearing evidence artifacts and authorized reference solutions
use that same syntax-highlighted theme in read-only mode; logs, traces, and metrics retain a
line-numbered evidence viewer. Per-question difficulty and scaled time estimates remain consistent
between the story list and question header.

#### 14.5 Assessment, report, and Continue experience

Purpose: expose the Step 13 assessment and adaptive handoff without moving decisions into the UI.

- Render locked and READY assessment states, then start or resume the frozen five-prompt assessment.
  Support the weak-response, code-defence, unseen diagnosis, repair/implementation, and production
  verification prompt formats from the public snapshot.
- Match DSA's portrait-led ready card and five-chip Measures row. Development may explicitly start
  a locked assessment early for UI/lifecycle testing; that transition records unfinished questions
  as `LEARNED` with zero mastery before freezing prompts. Production remains terminal-gated.
- Submit all five responses with replay-safe finalization. Show recoverable finalizing/evaluator
  failures without discarding the server-checkpointed submission.
- Render the five scores, teacher summary, strengths, improvements, prompt feedback,
  solved-versus-learned evidence, safe transcript, next-story choice, and candidate-facing reason.
- Keep the report visible until explicit Continue. Connect Continue/Retry so generation failure
  leaves the old report current and success navigates to the newly published block.

Completion checks:

- Start/resume/finalize replays do not create a second assessment or report.
- Report refresh and historical report reads use frozen safe data and preserve the score cap and
  zero-credit Learn semantics already decided by the server.
- Continue failure is retryable from the same report; Continue success performs one visible current-
  block handoff with no empty intermediate page.

#### 14.6 Resilience, privacy, accessibility, and DSA parity

Purpose: harden every Step 14 surface before treating the browser flow as releasable.

- Cover loading, empty, unsupported, unavailable-runner, preparation failure, evaluator failure,
  lease conflict, validation failure, stale page, offline/network failure, and safe not-found states.
- Compare desktop and mobile pages with DSA references. Review every new class, CSS token, and
  arbitrary Tailwind value; remove any visual treatment that is not already part of the DSA system.
- Verify responsive sticky behavior, overflow, touch targets, semantic headings, labels, error and
  status announcements, logical focus movement, visible focus, contrast, and screen-reader order.
- Inspect server-rendered HTML, RSC payloads, mutation responses, browser state, and logs for private
  fields. Candidate-visible failures must remain bounded and must not include private diagnostics.

Completion checks:

- Desktop/mobile screenshot comparison has no unexplained DSA-style drift and DSA itself is
  unchanged.
- Keyboard and screen-reader smoke checks cover entry, a non-code question, a code question,
  assessment, report, history, and Continue.
- Private-payload inspection finds no rubrics, expected answers, hidden tests, correct indices,
  source-review material, evaluator prompts, or private diagnostics.

#### 14.7 End-to-end verification and release gate

Purpose: prove the integrated candidate journey and record auditable completion evidence.

- Add focused component tests only for meaningful branching behavior and consolidated browser
  flows for the lifecycle. Do not create one `.spec.ts` per component or source file.
- Prove authentication/onboarding gates, eligibility, confirmation/preparation replay, all eight
  question formats, refresh durability, assessment start/resume/finalize, report persistence,
  history, Continue failure/retry, and successful second-story handoff.
- Run focused Core Technical tests, the full test suite, TypeScript, lint, Prisma validation,
  production build, desktop/mobile browser flows, accessibility checks, screenshot comparison, and
  private-payload inspection. Record exact commands, counts, and relevant artifact paths here.
- Enable Core Technical only for validated published stacks after the Step 6/7 approval records are
  genuine and the two reviewed story versions are published through the existing fail-closed path.

Completion checks:

- The authenticated first-story → eight questions → assessment → report → second-story flow passes
  against release-equivalent infrastructure, including the pinned runner sandbox.
- Failure/retry tests prove no duplicate block, assessment, report, attempt, run, or continuation.
- The top-level Step 14 row may be marked **DONE** only after Parts 14.1–14.7 are **DONE**, DSA remains
  unchanged, all repository gates pass, and completion evidence is recorded.

Parts 14.1–14.6 were implemented and tested with explicitly published test fixtures before the
Step 6/7 approval. Approval identities, dates, notes, and both immutable published story versions
are now present. Part 14.7's real authenticated release flow and top-level Step 14 completion still
require release-equivalent infrastructure, including the production Firecracker executor.

##### 14.7 automated gate evidence — 2026-09-07

The automatable portion of the release gate is complete:

- `pnpm exec vitest run src/server/core-technical src/components/workspace/core-technical
src/app/practice/core-technical src/app/practice/page.test.tsx
src/components/workspace/practice/practice-sessions-view.test.tsx` passed **23 files / 121
  tests**. This includes the real local pinned Node.js `22.23.2` OS-sandbox audit.
- `pnpm test` passed **172 files / 1,111 tests**, with the existing **2 files / 8 tests skipped**.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec prisma validate`, `pnpm build`, and
  `git diff --check` passed. The production route manifest contains the Core Technical page,
  question page, and all eleven read/mutation APIs; no development fixture route is present.
- `pnpm exec vitest run src/server/core-technical/runner.service.spec.ts
src/server/core-technical/gold-evaluator.spec.ts
src/server/core-technical/gold-evaluation-runner.spec.ts` passed **3 files / 13 tests**. The gold
  evaluator remains correctly fail-closed without human attestation.
- `src/server/core-technical/release-gates.spec.ts` directly proves unauthenticated,
  profile-onboarding, preparation-baseline, and successful authenticated request contexts. The
  consolidated lifecycle specs now also explicitly prove replay safety for attempt, code run,
  assessment start, completed report, block publication, and successful continuation; generation
  failure remains retryable under the same preparation request.
- A live provider-quota failure was recovered under the same preparation request through the exact
  approved-artifact path. It changed the durable attempt from `FAILED` to `SUCCEEDED`, cleared its
  private diagnostic, and published one `Follow the operation` guided block with exactly eight
  questions. The second approved standard story also resolved with eight questions and passed both
  executable sandbox audits without calling Gemini or Groq. Unmatched story/difficulty contracts
  still fail closed into the reviewed generation pipeline.
- All eleven live local Core Technical APIs returned `401 AUTH_REQUIRED` without any private-field
  term when called anonymously. Browser navigation to the real route redirected to `/` at
  1440×1200 and 390×844, with meaningful content, no error overlay, no horizontal overflow, no page
  errors, and zero axe WCAG A/AA violations. Evidence:
  `docs/step-14-evidence/14.7-auth-gate-desktop.png` and
  `docs/step-14-evidence/14.7-auth-gate-mobile.png`.
- `pnpm exec prisma migrate status` reports all **70 migrations** applied. After project-owner
  approval, `pnpm core-technical:publish` created immutable version-1 records for
  `follow-the-operation` (`297eab08-f283-410b-b993-4e1aa385ae61`) and
  `the-operation-fails-halfway` (`998c7003-5d1c-49c4-9c58-99a50ecbe3d4`). Replaying the command
  returned the same records. A direct eligibility audit returns `available: true`, reason
  `AVAILABLE`, `requiredStoryCount: 2`, and `publishedStoryCount: 2` for a supported backend Node.js
  profile.

Part 14.7 is therefore **IN PROGRESS**, not **DONE**. Both gold cases and generated story artifacts
now have project-owner approval, are release-eligible, and are published. The local process still
lacks a Vercel runtime/OIDC context and an authenticated release browser session, so it cannot
exercise the release Firecracker executor or honestly certify the final release-equivalent flow.
After deployment, rerun the authenticated first-story → eight questions → assessment → report →
second-story journey at desktop and mobile sizes. Only that successful run may move 14.7 and the
top-level Step 14 row to **DONE**.

## Product decisions

- Build Core Technical only. Do not build Applied Engineering or Architecture.
- Do not change DSA.
- Prove the first vertical slice with JavaScript/Node.js 22 for backend/full-stack candidates.
- Publish two stories so the first assessment can lead to a real second block.
- Every block has exactly eight frozen questions and one assessment.
- Candidate-selected language is a hard gate. Derive the remaining focus from saved server-side
  profile/resume evidence and never substitute another language.
- Initial-assessment results must change the first story, difficulty, question emphasis, and
  displayed recommendation reason.
- Three onboarding answers are directional evidence, not mastery.
- COMPLETED and LEARNED both unlock assessment; LEARNED gives zero mastery credit.
- Keep the report visible until the candidate explicitly starts the next story.
- Do not reactivate archived PrepPractice models, fixed tracks, old routes, or bank counts.
- Show the Core Technical card only when the candidate's stack has validated content and a runner.
- Build and prove the domain map, interview-pattern catalogue, story generator, and question
  generator before starting the UI. The UI only consumes their frozen output.
- Copy DSA's existing visual system exactly. Do not invent a new component treatment, including a
  different border width, colour, opacity, radius, shadow, spacing rule, button, or status style.

## End-to-end behavior

1. Practice shows unchanged DSA and, when supported, a Core Technical card.
2. On first entry, a centered modal asks only for practice language. The server derives role,
   seniority, target job, runtime, framework, exclusions, and ranking evidence from the saved
   profile/resume and the reviewed language vertical.
3. The server reads the saved Core Technical onboarding answers and freezes derived evidence.
4. It selects a compatible story/difficulty and saves a plain-language reason.
5. It generates and validates eight questions, then publishes all eight in one transaction.
6. Drafts, hints, attempts, Learn state, and code runs survive refresh.
7. Eight terminal questions make the assessment READY.
8. The assessment produces five scores, feedback, and the next-story reason.
9. Continue prepares the second block. Failure leaves the completed report visible with Retry.

## Initial-assessment personalization

### Source data

Read:

- CandidateProfile.preparationOnboarding for answers;
- PreparationBaselineQuestion for immutable question snapshots;
- sections technical-1, technical-2, and technical-3;
- target role, level, resume analysis, target company, and target date.

Create CoreTechnicalBaselineEvidenceService. It must:

1. Grade the three answers from the private saved question snapshots.
2. Resolve conceptKeys and mechanismKeys using a versioned registry keyed by section, question ID,
   and canonical question fingerprint. IDs alone are insufficient because role banks reuse them.
3. Freeze the result and its source fingerprint in the confirmed focus revision.
4. Return UNKNOWN for missing/unresolvable data.
5. Never expose correct options or raw private snapshots.

Store the schema version, source fingerprint, per-question
section/ID/fingerprint/concepts/mechanisms/correctness, weak/strong/unassessed concept keys, and the
resulting GUIDED/STANDARD/STRETCH/UNKNOWN state.

Calibration:

|           Result | First block                                            |
| ---------------: | ------------------------------------------------------ |
| No valid answers | UNKNOWN; broad foundation story                        |
|      0–1 correct | GUIDED; prioritize gaps and strengthen early hints     |
|        2 correct | STANDARD; missed concept plus one unassessed concept   |
|        3 correct | STRETCH; unassessed transfer, but never start advanced |

First-story ranking:

- 35% initial-assessment gap/unassessed transfer;
- 25% target role/job;
- 15% resume/project relevance;
- 15% planned coverage;
- 10% story diversity.

Persist the scores, policy version, story, difficulty, emphasized concepts, and user-facing reason:

> We chose Follow the operation because your initial assessment showed an async cleanup gap, and
> reliable Node.js request handling matters for your target role.

After the first assessment, verified evidence takes priority: 30% assessment weakness, 25% Practice
weakness, 20% target role/job, 15% coverage, and 10% novelty. The onboarding result becomes a weak
prior.

## Build the content engines first

Do not begin with pages or cards. First prove these four server-side assets through fixtures, CLI
output, and automated evaluation.

### 1. Domain coverage map

Create a reviewed, versioned map of the most important Core Technical topics for each supported
domain, role, seniority, language, runtime, and framework. For Node.js, it must cover at least:

- JavaScript values, identity, mutation, scope, closures, and modules;
- promises, async/await, event-loop scheduling, and error propagation;
- Node.js I/O, streams, buffers, backpressure, and request lifecycle;
- cancellation, timeouts, cleanup, memory, handles, and resource leaks;
- bounded concurrency, worker threads/processes, and shared-state risks;
- debugging, deterministic testing, runtime evidence, and production consequences.

Mark topics ESSENTIAL, HIGH, or SUPPORTING and define prerequisites. Every ESSENTIAL topic must
appear in at least one published story; the candidate path must not repeatedly test one attractive
topic while missing the rest of the domain.

### 2. Interview-pattern catalogue

Build a smaller catalogue of the most important questions and follow-ups that repeatedly appear in
real interviews. Each record needs:

- normalized question/pattern and mechanism being tested;
- applicable roles, seniority, language/runtime/framework, and question formats;
- importance and frequency evidence;
- links to independent public interview reports or an official public interview guide;
- authoritative technical sources for the answer;
- expected answer, common mistakes, follow-ups, and evaluation signals;
- review date, version, and publication status.

Use recurring public evidence; never copy leaked, proprietary, or copyrighted question wording.
The generator may adapt a verified interview pattern into a practical story, but must preserve the
same technical reasoning and difficulty. A generic practical task with no interview provenance is
not eligible.

### 3. Story generator

The story generator takes the domain map, eligible interview patterns, confirmed stack, seniority,
target job, evidence gaps, and recent coverage. It must produce:

- one realistic problem that could happen in the candidate's domain;
- primary and secondary domain topics;
- a clear technical mechanism and evidence trail;
- eight ordered story stages mapped to eligible interview patterns;
- difficulty, prerequisites, expected time, and forbidden out-of-scope topics;
- a coverage explanation showing why this is an important story.

Generate several story candidates, score them for domain importance, realism, interview density,
coherence, stack fit, and coverage, then send only the best valid candidates to human review. Reject
decorative stories where the narrative can be removed without changing the questions.

### 4. Question generator

For every story stage, the question generator must retrieve an eligible interview pattern and
generate at least two candidate questions. Each candidate is one complete frozen bundle:

- practical story prompt/artifact;
- exact concept and source interview-pattern IDs;
- three progressive hints;
- concise complete answer and explanation;
- private rubric, common mistakes, and interviewer follow-ups;
- public tests, hidden tests, reference solution, and runner contract when executable;
- an Interview connection shown after the attempt, explaining the standard interview skill the
  practical task just tested.

The candidate should feel that they are solving a real problem and then recognize that they have
practised an important interview question. Do not weaken a hard interview question into trivia or
make the story so elaborate that it hides what is being tested.

Use independent critics for technical correctness, interview relevance, story continuity, answer
quality, and difficulty. Test the generators against a human-reviewed gold set before connecting
them to candidate data or UI. Whole-block validation must also enforce exact stack compatibility,
non-duplicated concepts, 40–50 minute scope, passing Node.js starter/reference/test contracts, and
the absence of private fields in public output.

## First content to publish

1. **Follow the operation** — foundation: input, execution, async boundaries, state, errors, and
   cleanup.
2. **The operation fails halfway** — intermediate: partial work, propagation, cancellation,
   resource lifetime, and safe cleanup.

Each story is a reviewed generation contract. Generate this fixed block:

|   # | Format               | Evidence                                       |
| --: | -------------------- | ---------------------------------------------- |
|   1 | MCQ                  | Recognize the runtime mechanism                |
|   2 | Predict/explain      | Trace output, state, or scheduling             |
|   3 | Written              | Explain the governing rule                     |
|   4 | Spoken or typed      | Defend reasoning                               |
|   5 | Artifact diagnosis   | Read logs, output, stack, trace, or metrics    |
|   6 | Editable repair      | Fix one bounded defect                         |
|   7 | Micro-implementation | Build one small mechanism                      |
|   8 | Written or spoken    | Tests, monitoring, and production consequences |

## Data and code changes

Add active records for focus revisions, story definitions/versions, story progress, blocks, block
questions, question state, attempts, code runs, assessments, reports, and preparation attempts.

Required database rules:

- ownerId on every candidate record/query;
- one current Core Technical block per owner;
- question order unique within a block;
- one assessment/report per block;
- owner-scoped idempotency keys;
- immutable focus/evidence/story/question/evaluator/runner snapshots;
- snapshot-only history;
- source deletion cannot cascade into candidate history.

Add:

- src/lib/practice/core-technical/ — contracts, domain map, interview patterns, baseline registry,
  ranking, and public serializers;
- src/server/core-technical/ — story generator, question generator, critics, validation, focus,
  baseline evidence, catalogue, preparation, practice, runner, assessment, and history services;
- src/app/practice/core-technical/page.tsx;
- src/app/practice/core-technical/questions/[questionId]/page.tsx;
- src/app/api/practice/core-technical/ — confirm, prepare, draft, hint, run, attempt, learn,
  assessment start/finalize, and continue handlers;
- src/components/workspace/core-technical/.

Update:

- prisma/schema.prisma plus one migration;
- src/lib/practice/practice-roadmap.ts;
- src/server/practice/practice-roadmap.service.ts;
- src/app/practice/page.tsx;
- src/components/workspace/practice/practice-sessions-view.tsx;
- the application container.

Server pages call services directly. Every mutation authenticates, checks owner and lifecycle,
handles replay idempotently, writes atomically, and returns an allowlisted public object.

Code completion requires an owned run matching the submitted code fingerprint. Run generated and
candidate code only in a pinned sandbox with time, memory, output, filesystem, process, and network
limits.

## UI and assessment

DSA is the design source of truth. Inspect and reuse:

- src/app/practice/dsa/page.tsx;
- src/components/workspace/dsa/dsa-topics.tsx;
- src/components/workspace/practice/practice-intro.tsx;
- src/components/workspace/dsa/block-assessment-preview.tsx;
- the existing DSA question workspace and editor.

Match its page width, grid, spacing, typography, colours, borders, border opacity, radii, shadows,
buttons, pills, icons, focus rings, hover states, locked states, responsive breakpoints, and sticky
behavior exactly. Even a slightly different border is a design regression. Compose or extract
shared DSA primitives when necessary; do not create Core-Technical-only visual primitives.

Only the content changes: story hero/reason, eight questions, assessment card, story path, coach
copy, and URL-selected history. Add desktop/mobile screenshot comparison tests against DSA and
review every new CSS token or arbitrary Tailwind value.

The assessment freezes five prompts:

1. revisit one weak response;
2. defend one saved code/runtime decision;
3. diagnose an unseen transfer;
4. complete an unseen repair/implementation;
5. explain verification and handle a follow-up.

Persist scores for technical accuracy, reasoning, diagnosis, implementation, and communication,
plus strengths, improvements, solved-versus-learned evidence, safe transcript, and next-story
reason.

## Build order

Do not start UI work until PR 3 passes its quality gates.

### PR 1 — Domain and interview intelligence

- Build the versioned domain coverage map and prerequisites.
- Research, source, review, and publish the high-value interview-pattern catalogue.
- Add coverage tests proving all ESSENTIAL Node.js topics have eligible patterns.

### PR 2 — Story generator

- Implement multi-candidate story generation, scoring, critics, schemas, and human-review output.
- Generate and approve Follow the operation and The operation fails halfway.
- Prove both cover important domain topics and map every stage to interview patterns.

### PR 3 — Question generator

- Implement retrieval-grounded, multi-candidate question generation for all eight formats.
- Generate the answer, hints, rubric, sources, follow-ups, and tests as one bundle.
- Add critics, the Node.js 22 sandbox, whole-block validation, and a human-reviewed gold-set
  evaluation.

### PR 4 — Personalization and persistence

- Add the baseline adapter, concept registry, confirmed focus, ranking, database models, migration,
  public serializers, and atomic preparation.
- Prove assessment variants change the selected story/difficulty/emphasis.
- Prove retries and concurrent requests publish one frozen block.

### PR 5 — Step 14.1–14.4: plug the engines into the existing DSA design

- Establish the contract/state map and DSA desktop/mobile visual baseline.
- Add the eligible Practice card, confirmation/preparation states, story shell, history navigation,
  and all eight question workspaces.
- Connect drafts, hints, attempts, Learn, feedback, and code runs without changing DSA.

### PR 6 — Step 14.5–14.6: assessment, adaptation, and UI hardening

- Connect the already-implemented frozen assessment start/resume/finalize lifecycle and report.
- Keep the report selected until Continue and expose retry-safe second-story handoff.
- Complete responsive DSA comparison, failure states, accessibility checks, and private-payload
  inspection.

### PR 7 — Step 14.7: end-to-end verification and release

- Run consolidated tests, type check, lint, Prisma validation, production build, authenticated
  desktop/mobile browser flow, accessibility checks, screenshot comparison, and payload inspection.
- Enable only for validated published stacks after the Step 6/7 human-review gate is complete.

## Acceptance gate

- The domain map covers every ESSENTIAL Node.js topic with reviewed interview patterns.
- Every published question traces to real, public interview evidence and authoritative technical
  sources without copying proprietary wording.
- Story and question generators pass the human-reviewed gold-set evaluation before UI integration.
- Initial-assessment variants produce different saved first-block decisions.
- Exactly eight compatible questions publish atomically.
- Post-attempt Interview connection makes the underlying interview pattern clear.
- Core Technical uses the same DSA visual treatments, including exact borders and states.
- No cross-language fallback or private evaluation payload exists.
- Drafts, hints, attempts, Learn, and run binding are durable/idempotent.
- Code executes only in the pinned sandbox.
- Eight terminal questions unlock one assessment.
- The report remains visible until Continue.
- Verified evidence selects and prepares the second story.
- The authenticated first-story → assessment → report → second-story flow passes.
- DSA remains unchanged.
