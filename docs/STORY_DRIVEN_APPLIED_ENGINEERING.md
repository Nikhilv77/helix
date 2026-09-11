# Story-Driven Applied Engineering: Requirements and Build Plan

**Status:** Implementation in progress; Steps 1–8 complete. Step 9 automated gate is complete;
authenticated browser and voice-room verification remain blocked by human verification.
**Position:** Practice session 3, after DSA and Core Technical.
**Rule:** Reuse the shipped Core Technical product shape. Do not redesign Practice or change DSA.
**Current parity handoff:** Follow `docs/APPLIED_ENGINEERING_CORE_PARITY_REUSE_PLAN.md` for the
shared polished UI, technology welcome, DSA/Core live assessment room, and reuse migration.

## 1. Product requirement

Add an **Applied Engineering** session to `/practice` that looks and behaves exactly like Core
Technical, but tests whether a candidate can diagnose and safely repair realistic production
problems around the code.

- Core Technical asks why the language/runtime behaves a certain way.
- Applied Engineering asks what is failing in production, how to repair it, how to verify the
  repair, and how to ship it safely.
- Architecture asks how the larger system should be designed. Applied Engineering stays focused on
  delivering and operating a concrete change.

The first release uses the same narrow path as Core Technical:

- backend and full-stack candidates;
- JavaScript/TypeScript on Node.js 22 LTS;
- one eight-question incident story followed by a five-problem assessment;
- at least two reviewed and published incident stories before the session is available.

More roles and stacks can be added later through new published story packs without changing the
session lifecycle.

## 2. Existing app integration

The app already has useful Applied Engineering input:

- onboarding records an `applied-engineering` evidence signal;
- personalized interview planning creates an `applied-engineering` blueprint;
- `src/lib/roadmap/frontend-plan.ts` already places Applied Engineering at order 3 and describes
  planted defects, query plans, waterfalls, metrics, N+1 queries, races, retries, and caching.

What is missing is the story-driven Practice session. `projectPracticeSessions()` currently
projects only DSA. Core Technical is added to `/practice` as a separate server-derived entry.
Applied Engineering should use that same integration pattern for version 1.

Do not reuse the historical `PrepPracticeBlock*` delivery path. It does not model the complete
focus revision, published story version, public/private snapshots, preparation attempts, and
transcript behavior now implemented by Core Technical.

## 3. Complete user flow

```text
Onboarding evidence
  resume + target + level + applied-engineering baseline signal
        |
        v
/practice eligibility and order-3 card
        |
        v
first-entry language modal
        |
        v
confirm server-derived immutable focus revision
        |
        v
rank one compatible published incident
        |
        v
load and validate its approved 8-question artifact
        |
        v
atomically publish block + questions + locked assessment
        |
        v
practice -> assessment -> report -> next adaptive incident
```

1. Onboarding remains the source of resume, role, level, target job/company, skills, projects, and
   the baseline Applied Engineering answer.
2. `/practice` loads Applied Engineering eligibility, current progress, and analytics alongside DSA
   and Core Technical. A failure here must not break the other sessions.
3. A first-time eligible candidate sees the same centered language modal as Core Technical.
4. The browser posts only `{ language }`. The server derives and saves the full focus revision.
5. The browser posts `{ requestId, focusRevisionId }` to prepare the first story.
6. The server ranks compatible reviewed incidents using onboarding/resume evidence, previous
   Applied Engineering results, exclusions, and story history.
7. The selected published version and its approved artifact are loaded and audited.
8. The whole block is committed in one transaction. A failed preparation saves no partial block.
9. The candidate completes or explicitly learns all eight questions, takes the frozen assessment,
   receives a report, and chooses to continue to the next adapted incident.

## 4. Applied story contract

Each block is one coherent production incident, not eight unrelated questions.

| Order | Stage          | Candidate work                                                    | Existing UI mode   |
| ----- | -------------- | ----------------------------------------------------------------- | ------------------ |
| 1     | Symptom triage | Choose the first useful signal and reject a distraction           | `choice`           |
| 2     | Evidence       | Read logs, metrics, traces, a waterfall, or a query plan          | `choice` or `text` |
| 3     | Root cause     | Explain the failing path and blast radius                         | `text`             |
| 4     | Defect         | Locate the unsafe code or assumption                              | `choice` or `text` |
| 5     | Repair         | Implement the smallest correct Node.js change                     | `code`             |
| 6     | Verification   | Add or repair tests for the failure mode                          | `code`             |
| 7     | Hardening      | Add bounds, idempotency, resilience, security, or instrumentation | `text` or `code`   |
| 8     | Delivery       | Define rollout, monitoring, success, and rollback                 | `text`             |

The exact order may vary when an incident requires it, but diagnosis, repair, verification, and
safe delivery are mandatory.

### Initial two-story launch pack

1. **Duplicate work after a retry** — timeouts, repeated side effects, transaction boundaries,
   idempotency, queue delivery, races, tests, monitoring, and rollout.
2. **Latency cascade under load** — N+1 queries, pool pressure, cache stampede, unbounded
   concurrency or retry amplification, supported by frozen metrics/traces/query-plan evidence.

Both stories must be human-reviewed and published before the Practice card is available.

### Runtime scope

- Reuse the pinned Node.js 22 runner for code and tests.
- Logs, traces, metrics, waterfalls, query plans, and configs are immutable reviewed prompt
  artifacts.
- Candidate code gets no external network, secrets, cloud account, or production database access.
- Version 1 does not need a live PostgreSQL, Redis, or queue simulator. Their evidence is frozen;
  the Node.js repair remains executable.
- Deterministic tests are authoritative. An LLM may grade bounded written reasoning but cannot
  override executable evidence or invent infrastructure facts.

## 5. Frontend requirements and steps

Applied Engineering must use the exact Core Technical UI and its existing DSA parity baseline:

- same Practice card, ordering, pills, progress, and actions;
- same first-entry modal, animation, focus trap, loading, retry, and responsive behavior;
- same overview, teacher card, sticky coach, question rows, progress, and history;
- same question workspace, Monaco editor, draft/hint/run/submit/learn states;
- same assessment preview, assessment session, report, and loading/not-found screens;
- same breakpoints, colors, borders, radii, spacing, typography, and focus rings.

Only the title, copy, icon, incident artifacts, questions, measures, and route/API targets change.

Implementation steps:

1. Add `AppliedEngineeringPracticeEntry` and merge it into `PracticeSessionsView` at order 3, the
   same way Core Technical is merged today.
2. Update `/practice` to load eligibility, current block, and analytics in its existing parallel
   server read.
3. Add `/practice/applied-engineering` with current/history selection and owner-safe not-found
   behavior.
4. Add `/practice/applied-engineering/questions/[questionId]` with server-owned question lookup.
5. Extract presentation-only shells from hard-coded Core Technical components and keep thin
   `CoreTechnical*` and `AppliedEngineering*` wrappers.
6. Reuse the preparation shell with the same `confirm` then `prepare` calls and session-storage
   request-ID retry behavior.
7. Reuse the overview, workspace, assessment, report, and history shells. Add only a typed renderer
   for log/trace/metric/waterfall/query-plan/config artifacts.
8. Add matching loading, error, accessibility, keyboard, desktop, and mobile behavior.
9. Verify that the shared extraction did not visually or functionally change Core Technical or DSA.

Do not copy all Tailwind classes into a second visual implementation and do not spread
`sessionKind` conditionals throughout JSX. Share presentation; keep domain contracts separate.

## 6. Backend requirements and steps

The server owns eligibility, focus construction, incident selection, publication checks, grading,
state transitions, assessment readiness, continuation, and history.

### Focus and eligibility

Mirror `CoreTechnicalEligibilityService` and fail closed unless:

- role is backend or full-stack;
- level exists;
- the Node.js 22 runner is available;
- at least two compatible incident versions are published.

The focus service derives target role/level, confirmed language/runtime, resume skills and projects,
target job/company, onboarding Applied Engineering evidence, weak/unassessed production signals,
prior results, and exclusions. The browser never sends resume-derived focus data.

### Preparation

Reuse the Core Technical two-request architecture:

1. `confirm` derives and persists an immutable focus revision.
2. `prepare` validates its UUID request ID, holds a per-owner shared lease, supports replay,
   deterministically selects a published incident, validates all eight questions, and publishes the
   complete block atomically.
3. Failure persists bounded server-only diagnostics and returns a retry-safe public error.

The click path should prefer approved artifacts, like Core Technical. LLMs belong mainly in the
authoring/review pipeline. The onboarding LLM must not become the direct source of live questions.

### Practice and assessment lifecycle

```text
Block:    PRACTISING -> ASSESSMENT_READY -> ASSESSMENT_IN_PROGRESS -> ASSESSED
Question: ACTIVE -> COMPLETED
                 -> LEARNED
```

- Drafts and hints do not complete a question.
- Choice/text attempts use the frozen private evaluation contract.
- Code completion requires a current passing run for the exact content and code fingerprints.
- `LEARNED` is explicit zero-mastery evidence, not a solved question.
- Eight terminal questions unlock the assessment.
- Assessment start, finalization, and continuation are idempotent.
- Historical blocks are immutable and read-only.
- Continue freezes the old block and prepares exactly one new current block.

The five frozen assessment problems measure diagnosis/evidence, implementation, testing,
production judgment/reliability, and ownership/observability/safe delivery.

## 7. Persistence

Mirror the working Core Technical schema under a separate Applied Engineering namespace. Reuse the
lifecycle design, not Core Technical rows:

- `AppliedEngineeringFocusRevision`
- `AppliedEngineeringIncidentDefinition` and `AppliedEngineeringIncidentVersion`
- `AppliedEngineeringIncidentProgress`
- `AppliedEngineeringBlock` and `AppliedEngineeringBlockQuestion`
- `AppliedEngineeringQuestionState`, `AppliedEngineeringQuestionAttempt`, and
  `AppliedEngineeringCodeRun`
- `AppliedEngineeringAssessment` and `AppliedEngineeringAssessmentReport`
- `AppliedEngineeringPreparationAttempt`

The migration must enforce owner scope, one current block per owner, stable ordinals, idempotency
keys, one assessment per block, immutable version/fingerprint snapshots, separate public/private
question snapshots, and history that survives catalogue retirement. Add matching
`CandidateProfile` relations. Do not migrate DSA or rewrite Core Technical history.

## 8. API surface

Mirror the current Core Technical routes:

| Method | Route                                                   | Responsibility                   |
| ------ | ------------------------------------------------------- | -------------------------------- |
| GET    | `/api/practice/applied-engineering`                     | Read current public block        |
| POST   | `/api/practice/applied-engineering/confirm`             | Save focus revision              |
| POST   | `/api/practice/applied-engineering/prepare`             | Publish first block idempotently |
| POST   | `/api/practice/applied-engineering/draft`               | Save draft                       |
| POST   | `/api/practice/applied-engineering/hint`                | Reveal next public hint          |
| POST   | `/api/practice/applied-engineering/run`                 | Run Node.js work                 |
| POST   | `/api/practice/applied-engineering/attempt`             | Evaluate/persist attempt         |
| POST   | `/api/practice/applied-engineering/learn`               | Confirm learned state            |
| POST   | `/api/practice/applied-engineering/assessment/start`    | Start/resume assessment          |
| POST   | `/api/practice/applied-engineering/assessment/finalize` | Persist report                   |
| POST   | `/api/practice/applied-engineering/continue`            | Prepare next incident            |

Every mutation uses the onboarded owner, eligibility check, existing rate-limit policy, strict
schema parsing, owner-scoped IDs, and shared API error envelope. `prepare` keeps the Core Technical
300-second allowance and distributed lease pattern.

## 9. Code reuse map

| Existing source                                           | Required use                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/app/practice/core-technical/**`                      | Add parallel server routes using shared UI shells                       |
| `src/app/api/practice/core-technical/**`                  | Copy route shape; rename schemas, services, errors, and lease namespace |
| `src/features/practice/core-technical/ui/**`              | Extract stable presentation; retain separate typed wrappers             |
| `src/features/practice/core-technical/domain/ui-state.ts` | Copy projection first; generalize only if behavior stays identical      |
| Core Technical focus/ranking/content contracts            | Reuse structure with incident and production-evidence vocabulary        |
| Core Technical preparation/practice/history/analytics     | Copy orchestration against Applied Engineering persistence              |
| Core Technical Node runner/sandbox                        | Reuse directly                                                          |
| Core Technical assessment/continuation                    | Copy lifecycle; replace blueprint, evaluator, and measures              |
| Core Technical Prisma models                              | Mirror into separate Applied Engineering tables                         |
| `docs/CORE_TECHNICAL_UI_BASELINE.md`                      | Use as the visual acceptance baseline                                   |

New domain code belongs under:

```text
src/features/practice/applied-engineering/domain/
src/features/practice/applied-engineering/server/
src/features/practice/applied-engineering/ui/
src/app/practice/applied-engineering/
src/app/api/practice/applied-engineering/
```

Register its services beside Core Technical in `src/server/app-container.ts`. Keep logs, errors,
metrics, content catalogue, and the shared-lease namespace explicitly named
`applied-engineering`.

## 10. Build order

| Step | Deliverable                                                                   | Status                                                                                                        |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1    | Incident, question, artifact, focus, and assessment contracts                 | Complete                                                                                                      |
| 2    | Two reviewed incident artifacts plus content/privacy/executable audits        | Complete — owner approval recorded 2026-09-08                                                                 |
| 3    | Onboarding baseline, focus derivation, deterministic ranking, and eligibility | Complete — first-story recent-history exclusion added                                                         |
| 4    | Prisma migration and owner/idempotency/atomicity tests                        | Complete — schema, migration, persistence service, and focused tests                                          |
| 5    | Runner integration, written evaluation, practice lifecycle, and history       | Complete — runner adapter, evaluator, lifecycle, history, and focused tests                                   |
| 6    | Frozen assessment, report, adaptive continuation, and analytics               | Complete — semantic evaluation, deterministic evidence caps, retry-safe continuation, and workspace analytics |
| 7    | API routes and app-container registration                                     | Complete — eleven authenticated routes, strict guards, distributed leases, and full service wiring            |
| 8    | Shared UI extraction, Applied Engineering wrappers, card, and server pages    | Complete — shared presentation shell, typed artifacts, order-3 card, owner-safe pages, and boundaries         |
| 9    | Unit/integration/browser verification and release gate                        | In progress — automated gates pass; authenticated screenshots and voice-room exercise require the human verification gate |

### Remaining-step sizing

| Step                    | Size               |    Estimated new LOC | Main work                                                           |
| ----------------------- | ------------------ | -------------------: | ------------------------------------------------------------------- |
| 8. Frontend integration | Large              |            900–1,400 | Shared UI extraction, wrappers, pages, Practice card, and artifacts |
| 9. Verification         | Medium; test-heavy | 1,500–2,500 test LOC | Integration, regression, browser, mobile, and failure testing       |

Step 8 was the largest production step. Step 9 adds substantial test code but little production
code.

Step 4 completion evidence: `prisma/schema.prisma`,
`prisma/migrations/20260908100000_story_driven_applied_engineering_persistence/migration.sql`,
`src/features/practice/applied-engineering/server/persistence.service.ts`, and
`src/features/practice/applied-engineering/server/persistence.service.spec.ts`. The Applied Engineering focused
suite passes with 30 tests; `pnpm exec tsc --noEmit` and `pnpm lint` also pass.

Step 2 approval evidence: project owner `nikhilverma` approved both launch incidents on 2026-09-08.
The approval identity, date, and review note are frozen in
`src/features/practice/applied-engineering/domain/reviewed-incidents.ts`; both catalogue entries are now
release-eligible and published candidates for the database publication path. The idempotent
`pnpm applied-engineering:publish` command re-runs the release audit and publishes the matching
immutable versions before launch eligibility is enabled.

Step 5 completion evidence: `src/features/practice/applied-engineering/server/runner.service.ts`,
`src/features/practice/applied-engineering/server/attempt-evaluator.ts`,
`src/features/practice/applied-engineering/server/practice.service.ts`,
`src/features/practice/applied-engineering/server/history.service.ts`, and their focused specs. The Applied
Engineering focused suite passes with 36 tests; the shared Core Technical runner remains unchanged.

Step 6 completion evidence: `src/features/practice/applied-engineering/domain/assessment-contracts.ts`,
`src/features/practice/applied-engineering/domain/workspace-analytics.ts`,
`src/features/practice/applied-engineering/server/assessment-blueprint.ts`,
`src/features/practice/applied-engineering/server/assessment-evaluator.ts`,
`src/features/practice/applied-engineering/server/assessment.service.ts`,
`src/features/practice/applied-engineering/server/continuation.service.ts`, and
`src/features/practice/applied-engineering/server/workspace-analytics.service.ts`. The assessment freezes five safe
public prompts at readiness, checkpoints submissions before semantic evaluation, caps unsupported
implementation claims using owned accepted runs, preserves Learn as zero mastery, ranks one novel
published incident from verified evidence, keeps the completed report current through retryable
continuation, and projects Practice plus assessment/report analytics. The focused Applied
Engineering suite passes with 45 tests; affected Core Technical regressions pass with 20 tests;
the full repository suite passes with 182 files / 1,167 tests (2 files / 8 tests skipped);
TypeScript, lint, Prisma validation, and `git diff --check` pass.

Step 7 completion evidence: `src/app/api/practice/applied-engineering/` exposes the public read,
confirm, prepare, draft, hint, run, attempt, Learn, assessment start/finalize, and Continue routes.
All mutations use the authenticated onboarded owner, shared rate-limit policies, strict Zod input,
the shared API envelope, and explicitly named Applied Engineering leases for expensive or
double-submit-sensitive operations. Confirm now calls the preparation service so the returned focus
revision is durably persisted before prepare; assessment preview remains development-only; and the
application container registers the complete Applied Engineering service graph while sharing the
same environment-appropriate Core Technical Node.js runner instance. Representative request-gate
and route tests cover authentication, onboarding, strict over-post rejection, eligibility, rate
limits, persisted confirmation, preparation lease/release, and assessment start. The combined
Applied Engineering service/API suite passes with 11 files / 54 tests; affected Core Technical
regressions pass with 2 files / 14 tests; the full repository suite passes with 184 files / 1,176
tests (2 files / 8 tests skipped); TypeScript, lint, Prisma validation, and `git diff --check` pass.

Step 8 completion evidence: the shipped Core Technical preparation, intro, overview, question
workspace, assessment, report, and history presentations now accept a bounded experience
configuration while keeping their Core Technical defaults. Thin adapters in
`src/features/practice/applied-engineering/ui/` translate only public Applied Engineering domain
data and endpoint targets into those shared presentations. A shared typed artifact renderer covers
scenario, code, logs, trace, metrics, waterfall, query-plan, and config evidence. `/practice`
appends the server-derived Applied Engineering card at order 3 and independently merges its
analytics; `/practice/applied-engineering` and its question route provide current/history reads,
owner-safe not-found behavior, loading and retry boundaries, keyboard/focus behavior inherited from
the shared shell, and the same responsive layout. Public block reads expose only validated incident,
public focus, safe assessment prompts, report, and safe transcript snapshots. Focused AE/Core/UI
regressions pass with 13 files / 48 tests; the full repository suite passes with 188 files / 1,184
tests (2 files / 8 tests skipped). TypeScript, lint, Prisma validation, production Next.js build,
and `git diff --check` pass.

The remaining Step 9 task is the authenticated desktop/mobile and real voice-room exercise after
the required human-verification challenge is completed.

## 11. LOC budget and test strategy

Core Technical currently contains about 12,858 production lines in its server, contracts,
components, pages, and API routes. It also has about 5,830 test lines and 2,120 generated story
artifact lines. Applied Engineering should not repeat that full footprint because the visual system,
Node runner, sandbox, request guards, and working architecture already exist.

### Expected new lines

| Area                                                   | Expected new lines |
| ------------------------------------------------------ | -----------------: |
| Backend lifecycle, persistence, and assessment         |        3,500–4,500 |
| Incident contracts, evidence, ranking, and eligibility |        1,500–2,000 |
| Frontend wrappers and artifact renderer                |          700–1,100 |
| API routes, Prisma migration, and app wiring           |            600–900 |
| **Production code target**                             |    **6,500–8,500** |
| Consolidated tests                                     |        2,000–3,000 |
| Two reviewed story artifacts                           |        2,000–3,000 |

The expected total repository addition is roughly 10,500–14,500 lines, including tests and story
data. The target for hand-written production code is approximately 7,500 lines.

- More than about 9,000 production lines is a warning that Core Technical UI or runner code is
  being copied unnecessarily.
- Less than about 5,500 production lines requires a check that persistence, lifecycle, ownership,
  assessment, history, and failure behavior were not omitted.
- Generated JSON/story data should be reported separately from implementation LOC.

### Do not create one spec file per implementation file

Tests follow observable behavior boundaries, not the source-file layout. Type-only files, constants,
thin API routes, and thin UI wrappers do not each need their own `.spec.ts` file when their behavior
is already exercised by a contract or integration test.

Use this lean test suite:

| Suggested test                 | What it covers                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `contracts.spec.ts`            | Schemas, fingerprints, artifact parsing, and public/private serialization          |
| `content-release.spec.ts`      | Two-story coverage, approval, privacy, and executable release gates                |
| `focus-ranking.spec.ts`        | Onboarding evidence, eligibility, deterministic ranking, and no-repeat behavior    |
| `preparation.spec.ts`          | Confirm/prepare, request conflicts, replay, lease, failure, and atomic publication |
| `persistence.spec.ts`          | Owner isolation, uniqueness, transactions, and immutable history                   |
| `practice-lifecycle.spec.ts`   | Draft, hint, run, attempt, learn, question completion, and assessment unlock       |
| `assessment-lifecycle.spec.ts` | Frozen problems, start/resume, finalization, report, and continuation              |
| `ui-integration.spec.tsx`      | Shared Core/Applied shells, state rendering, errors, and route targets             |
| One browser flow               | First entry through report and next incident on desktop and mobile                 |

Representative API-route tests are needed for authentication, input parsing, rate limiting, and
error mapping, but identical thin routes can be covered through their shared helper plus a small
number of integration cases.

Tests must not be removed for the behaviors where failures corrupt or expose user state:

- owner isolation and foreign-ID handling;
- public/private snapshot separation;
- idempotency and duplicate-request replay;
- atomic eight-question publication;
- stale code/content fingerprint rejection;
- runner sandbox restrictions;
- assessment finalization and continuation;
- DSA and Core Technical regressions after shared UI extraction.

This structure keeps the test budget near 2,000–3,000 lines without trading away the critical
guarantees.

## 12. Definition of done

- Eligible users see DSA, Core Technical, and Applied Engineering in that order.
- Every Applied Engineering surface matches Core Technical except its content and icon.
- Onboarding evidence changes incident selection without being sent by the browser.
- **Build my first story** publishes one complete reviewed eight-question incident or nothing.
- Refresh/retry cannot duplicate focus revisions, blocks, attempts, assessments, or next stories.
- The story covers diagnosis, repair, verification, hardening, and safe delivery.
- No answer key, hidden test, private rubric, reference repair, or internal diagnostic reaches the
  browser.
- Owner isolation, immutable history, code fingerprint checks, assessment replay, and continuation
  are tested.
- One browser test covers first entry through report and next incident on desktop and mobile.
- Existing DSA and Core Technical tests and visual behavior remain unchanged.

## 13. Context handoff for another AI

An AI implementing this feature should not begin by scanning or redesigning the whole repository.
Give it this document, the requested build step, and the following source files as its context
packet.

### Reading order

1. Read this document completely.
2. Read `docs/STORY_DRIVEN_CORE_TECHNICAL.md` for the existing content and lifecycle decisions.
3. Read `docs/CORE_TECHNICAL_UI_BASELINE.md` for the visual contract.
4. Trace the current Practice entry through:
   - `src/app/practice/page.tsx`
   - `src/lib/practice/practice-roadmap.ts`
   - `src/features/practice/shared/ui/practice-sessions-view.tsx`
5. Trace the Core Technical frontend through:
   - `src/app/practice/core-technical/page.tsx`
   - `src/app/practice/core-technical/questions/[questionId]/page.tsx`
   - `src/features/practice/core-technical/ui/`
6. Trace the Core Technical backend through:
   - `src/app/api/practice/core-technical/`
   - `src/features/practice/core-technical/domain/`
   - `src/features/practice/core-technical/server/`
   - the `CoreTechnical*` models in `prisma/schema.prisma`
   - Core Technical registration in `src/server/app-container.ts`
7. Read the existing Applied Engineering inputs:
   - `src/lib/roadmap/frontend-plan.ts`
   - `src/features/interviews/server/personalized-plan-generator.ts`
   - `src/features/preparation-onboarding/server/preparation-onboarding-state.ts`
8. Read the nearest Core Technical tests for the build step being implemented before changing code.

After reading, the AI should summarize the current request path, the exact Core Technical files it
will reuse, the new Applied Engineering files it will add, and the tests it will run. It should then
implement one build-order step at a time rather than inventing a second architecture.

### Facts the handoff must preserve

- DSA is the only session projected by `projectPracticeSessions()` today.
- Core Technical is appended separately as a transient server-derived Practice entry.
- Applied Engineering should initially use the same separate-entry pattern at order 3.
- Onboarding already supplies an `applied-engineering` signal; the browser must not reconstruct it.
- The UI must match Core Technical. Applied Engineering needs separate domain data and persistence.
- The first release is backend/full-stack JavaScript/TypeScript on Node.js 22 with two published
  incident stories.
- The first-entry call sequence is `confirm` followed by idempotent `prepare`.
- Preparation publishes all eight questions atomically or publishes nothing.
- The existing Node runner can be shared; Core Technical records and history cannot.
- Existing user changes and unrelated dirty-worktree files must be preserved.

### Ready-to-use AI prompt

```text
Implement the next unfinished step from docs/STORY_DRIVEN_APPLIED_ENGINEERING.md.

First read that document and follow its "Context handoff for another AI" reading order. Treat the
current Core Technical flow as the implementation reference and
docs/CORE_TECHNICAL_UI_BASELINE.md as the visual reference.

Keep DSA and existing Core Technical behavior unchanged. Reuse stable UI and Node-runner code, but
keep Applied Engineering contracts, persistence, API namespaces, content, grading, errors, and
analytics separate. Do not use the historical PrepPracticeBlock path. Do not send resume-derived
focus data from the browser, and do not publish partial or unreviewed stories.

Before editing, report which build step you are implementing and the source files/tests that prove
the existing pattern. After editing, run the narrow tests for that step plus affected Core
Technical/Practice regressions, then update the document only if implementation status changed.
Do not implement later steps unless they are required for the current step to compile or test.
```

When handing work from one AI to another, include the current `git status`, changed-file list, tests
already run with results, the next unfinished build step, and any known blocker. This prevents the
next AI from repeating analysis or overwriting unrelated work.

## 14. Version 1 non-goals

- No new UI system or broad Core Technical refactor.
- No change to DSA or the general interview-to-Practice projection.
- No live database, queue, cache, cloud, or external-network sandbox.
- No automatic publication of unreviewed LLM output.
- No frontend-owned incident selection, scoring, or lifecycle decisions.
- No multi-role or multi-language promise at launch.

This keeps the feature native to the current app: copy the proven Core Technical domain
architecture, share its stable UI and Node runner, and replace only the content/evaluation layer
with Applied Engineering incidents.
