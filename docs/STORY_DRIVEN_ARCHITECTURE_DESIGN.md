# Story-Driven Architecture & Design: Implementation and AI Handoff

**Status:** Steps 1–9 are complete; Step 10's authenticated browser release pass remains.
**Position:** Practice session 4, after DSA, Core Technical, and Applied Engineering.
**Canonical key and route:** `architecture-design` and `/practice/architecture-design`.
**Product label:** **Architecture & Design**.
**Primary rule:** Reuse the story-practice product once. Do not create a third copy of Core Technical.

## 1. What is being built

Add an Architecture & Design session to `/practice` for system-design preparation. From the
candidate's point of view, it must have the same product shape as Core Technical and Applied
Engineering:

1. an order-4 Practice card;
2. a first-entry setup modal;
3. one coherent four-question scenario;
4. progressive hints, draft persistence, evaluated attempts, and explicit **Learn**;
5. an assessment unlocked after all four questions are terminal;
6. an immutable report and an explicit continuation into the next adaptive scenario;
7. current-block and completed-block history.

The content boundary is different:

- Core Technical asks why a runtime or language behaves as it does.
- Applied Engineering asks how to diagnose, repair, verify, and ship a production change.
- Architecture & Design asks how to frame requirements, choose boundaries and data flow, plan for
  scale and failure, and defend design trade-offs.

“Same to same” means lifecycle, layout, interaction, ownership, safety, and history parity. It does
not mean sending a meaningless language choice, showing a code runner, or casting Architecture
records into Core Technical domain types.

### Version 1 scope

The smallest safe launch scope is:

- backend and full-stack profiles;
- role-aligned, language-independent system design;
- two human-reviewed and published scenarios;
- four compound questions per scenario and five assessment prompts;
- existing text, choice, scenario, metrics, trace, and config presentation only;
- no executable code questions and no Node.js runner dependency;
- no diagram canvas in version 1. Candidates express diagrams in a structured text template:
  **components, request/data flow, storage, failure path, and trade-offs**.

The engine and contracts must remain capable of adding frontend, data, AI/ML, and product-oriented
packs later. Do not expose a role until it has at least two reviewed scenarios compatible with that
role. Onboarding already captures Architecture evidence for every current role.

## 2. Naming: do not merge these existing identities

The repository currently has three related names:

| Identity                     | Existing use                                             | Required action                                          |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `architecture-design`        | Preparation-area and skill-signal ID                     | Use as the new Practice key and URL slug                 |
| `architecture-system-design` | Personalized interview session kind and older roadmap ID | Keep unchanged; map it into Practice context when useful |
| Architecture & Design        | User-facing preparation label                            | Use as the new Practice label                            |

Do not rename the existing interview session kind as part of this feature. That would expand the
change into persisted personalized plans and interview history. The Practice feature may read the
`architecture-system-design` blueprint, but its own stable identity is `architecture-design`.

## 3. Current repository context

At the time this document was written:

- DSA is live and has its own adaptive block and assessment implementation.
- Core Technical has the complete story-practice architecture and UI.
- Applied Engineering is an in-progress, uncommitted vertical that already reuses Core Technical's
  presentation through small experience objects and domain adapters.
- `projectPracticeSessions()` still projects only DSA. Core Technical and Applied Engineering are
  appended to `/practice` as separately derived entries.
- The working tree contains active Applied Engineering changes. Preserve them. Never reset,
  overwrite, or silently reformat those files while implementing Architecture & Design.

The current amount of duplication is a warning, not a template:

- Core Technical server/domain code is large.
- Applied Engineering has separate domain and persistence code, but its frontend is only a small
  wrapper layer around Core Technical.
- A third copied server directory would make every lifecycle fix occur three times.

The Architecture implementation should therefore finish the reusable story-practice boundary that
Applied Engineering has started.

## 4. Complete onboarding flow and the context Architecture receives

There are two onboarding layers. Both must be complete before any Practice route is accessible.

### 4.1 Profile and resume onboarding at `/onboarding`

The flow is implemented by:

- `src/app/onboarding/page.tsx`
- `src/components/onboarding/flow/onboarding-flow.tsx`
- `src/app/api/onboarding/resume/route.ts`
- `src/app/api/onboarding/complete/route.ts`
- `src/server/profile/profile.service.ts`

The candidate selects a teacher and experience level, uploads a PDF or DOCX resume, verifies the
parsed identity/evidence/readiness views, and completes onboarding. `ProfileService.completeOnboarding()`
persists the durable candidate record, including:

- target role and experience level;
- teacher;
- headline and candidate context;
- resume skills, experience, projects, achievements, education, and extracted evidence;
- the resume/version fingerprint and timestamps;
- `onboardingCompletedAt`;
- a fresh preparation-onboarding state.

The browser uploads the source document, but later Practice pages must not resend extracted resume
facts. Practice focus is always rebuilt on the server from the owner-scoped profile.

### 4.2 Blocking target and baseline onboarding on `/`

After profile onboarding, the signed-in home page blocks access until Maya's preparation onboarding
is complete. The entry decision is in `src/app/(marketing)/page.tsx`; the UI is in
`src/components/workspace/dashboard/maya-welcome.tsx`; persistence is handled by:

- `src/app/api/preparation-onboarding/route.ts`
- `src/server/preparation/preparation-onboarding.service.ts`
- `src/server/preparation/preparation-onboarding-state.ts`
- `src/lib/preparation/preparation-onboarding.ts`

The target stages are:

```text
target role -> target level -> target timeline -> preparation areas
            -> optional target company -> baseline introduction
```

The baseline then assigns and freezes questions once. Backend/full-stack candidates receive the DSA
pulse, three Core Technical questions, one Applied Engineering question, and one Architecture
question. AI/ML and product profiles skip DSA but still receive the technical, engineering, and
Architecture sections.

The final section is `architecture`, selected from:

- `src/lib/preparation/architecture-question-bank.ts`; or
- `src/lib/preparation/ai-ml-architecture-question-bank.ts` for AI/ML.

Assignment IDs and immutable private question snapshots are persisted in
`PreparationBaselineQuestion`. A resume refresh does not change a resumed assignment. Options are
shuffled and the correct option exists only in server-side state. `publicPreparationOnboardingState()`
removes grading data before the state crosses to a client.

After the last answer, `buildInitialSkillProfile()` creates four directional signals. The relevant
one is:

```ts
{
  areaId: "architecture-design",
  score: null,
  confidence: 0.2, // when answered
  evidence: "baseline" | "not-enough-evidence",
  topics: [{
    label: "System design judgment",
    familiarity: "familiar" | "needs-refresh" | "unknown"
  }]
}
```

This is a low-confidence starting signal, never a readiness score.

### 4.3 Access guard

Server pages use `requireOnboardedProfile()` from `src/server/auth/onboarding-guard.ts`. It requires:

- authentication;
- `profile.onboardingCompletedAt`; and
- `profile.preparationOnboarding.completedAt`.

API routes use the equivalent preparation-onboarding API guard. Architecture routes must use these
same guards. Do not invent a weaker route-specific check.

### 4.4 Exact Architecture context data line

Architecture focus must be assembled on the server in this order:

```text
CandidateProfile
  targetRole, level, targetCompany, targetDate, headline, resumeAnalysis
                         |
PreparationBaselineQuestion(section = "architecture")
  frozen private question and question/content identity
                         |
CandidateProfile.preparationOnboarding.answers.architecture
  selected choice and answer timestamp
                         |
preparationOnboarding.skillProfile
  architecture-design directional signal
                         |
active personalized plan (optional)
  architecture-system-design blueprint, role/domain topic seeds, skill keys
                         |
prior Architecture blocks and reports
  weak/strong/unassessed dimensions, used scenario keys, difficulty evidence
                         v
immutable ArchitectureFocusRevision
                         v
deterministic compatible-scenario ranking
```

Use a Core-Technical-style `ArchitectureBaselineEvidenceService` to resolve the private frozen
`architecture` question and saved answer. Freeze only answer-free derived evidence into the focus:

- schema and registry versions;
- question ID and question fingerprint;
- source fingerprint;
- resolution (`RESOLVED`, `MISSING`, or `UNRESOLVABLE`);
- correctness (`CORRECT`, `INCORRECT`, or `UNKNOWN`);
- mapped Architecture dimensions;
- calibration: `STANDARD` for one resolved correct answer, `GUIDED` for one resolved incorrect
  answer, and `UNKNOWN` otherwise.

A single onboarding question can never assign `STRETCH`. Never copy the correct option, answer key,
or private question snapshot into a public focus, API response, prompt, log, or analytics event.

The public `architecture-design` signal may be used as a consistency check and display summary. The
private frozen baseline record is the authoritative grading input.

### 4.5 What can be sent to an AI generator or evaluator

If an AI is used in the reviewed authoring pipeline or bounded written-answer evaluation, send only
the minimum frozen context required:

- role family and seniority;
- sanitized target job/company and target date, when relevant;
- normalized architecture/domain skill keys and project keywords;
- answer-free baseline state and dimension keys;
- previous Architecture report dimensions and excluded scenario keys;
- the exact public scenario/question and private evaluation rubric for the current attempt.

Do not send the raw resume file, addresses, phone numbers, email, unrelated personal content,
onboarding answer keys, other users' data, or mutable database objects. Persist the provider/model,
prompt/evaluator version, content fingerprint, and bounded result needed for auditability.

## 5. Target end-to-end Practice flow

```text
completed onboarding + resume + Architecture baseline
                         |
                         v
/practice loads order-4 availability/progress independently
                         |
                         v
first entry opens the shared preparation modal
                         |
                         v
confirm: server freezes role-aligned Architecture focus
                         |
                         v
prepare: rank one compatible published scenario
                         |
                         v
audit approved 4-question artifact and publish atomically
                         |
                         v
shared overview -> shared question workspace -> 4 terminal questions
                         |
                         v
shared five-prompt assessment -> immutable report
                         |
                         v
explicit Continue -> next adapted scenario; old block remains history
```

The browser should send only a small explicit confirmation. The recommended version-1 payload is:

```ts
{
  path: "role-aligned";
}
```

Do not reuse `{ language: "javascript" }`; Architecture is language-independent. Make the shared
preparation component accept configurable choices and a `buildConfirmation` function so Core and
Applied continue sending language while Architecture sends its path. If there is only one launch
path, retain the same modal UX with one preselected “Role-aligned system design” option.

The request sequence remains two-phase:

1. `confirm` returns an immutable focus revision.
2. `prepare` accepts `{ requestId, focusRevisionId }` and is replay-safe.

This boundary prevents the browser from manufacturing resume evidence, baseline calibration,
difficulty, or scenario selection.

## 6. Architecture scenario and question contract

One block is one coherent system-design interview, not four unrelated trivia questions. The reduced
MVP combines the original eight-stage interview arc into four compound questions while retaining
explicit rubric coverage of all sixteen Architecture dimensions.

| Order | Stage                    | Candidate work                                                                                    | Reused format                                             |
| ----: | ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
|     1 | Requirements and scale   | Clarify scope and constraints, then estimate traffic, storage, latency, and availability targets  | `written` or `mcq`                                        |
|     2 | Contracts and data       | Define API/event correctness plus models, access patterns, indexes, and consistency boundaries    | `production-decision`, `artifact-diagnosis`, or `written` |
|     3 | Architecture and failure | Describe components and flow, then address caching, backpressure, hotspots, and failure isolation | `written` or `artifact-diagnosis`                         |
|     4 | Quality and evolution    | Defend observability, security, privacy, cost, trade-offs, rollout, and migration                 | `production-decision` or `written`                        |

Version 1 should reuse the existing question formats:

- `mcq`;
- `written`;
- `artifact-diagnosis`;
- `production-decision`;
- optionally `spoken` if the existing workspace path is already release-safe.

Do not include `debug-repair` or `micro-implementation`; those imply executable runner contracts.
The workspace must hide Run whenever the normalized question has no executable capability.

### 6.1 Architecture dimensions

Use stable, domain-owned keys for ranking and scoring:

- `requirements-framing`;
- `capacity-estimation`;
- `api-event-contracts`;
- `data-modeling`;
- `storage-access-patterns`;
- `component-boundaries`;
- `consistency-transactions`;
- `caching-contention`;
- `async-work-backpressure`;
- `partitioning-hotspots`;
- `reliability-failure-isolation`;
- `observability-slos`;
- `security-privacy`;
- `cost-efficiency`;
- `tradeoff-communication`;
- `migration-evolution`.

The Architecture catalogue, baseline registry, ranker, question rubrics, and report must use these
same keys. Do not reuse Core “mechanism” keys or Applied “production signal” keys under misleading
names.

### 6.2 Artifacts

To preserve frontend parity and minimize production code, version 1 uses the existing shared
artifact renderer and existing kinds:

- `scenario` for requirements and constraints;
- `metrics` for traffic/SLO/capacity snapshots;
- `config` for API schemas, data models, and policy examples;
- `trace` for request/event flows;
- `logs` only when an operational symptom is part of the design prompt.

A new interactive diagram surface is explicitly deferred. If a later version adds `topology`,
`api-contract`, or `data-model` artifacts, extend the neutral shared artifact contract and renderer;
do not add Architecture-only JSX branches to the Core workspace.

### 6.3 Initial launch scenarios

Ship at least two owner-approved, reviewed scenarios before eligibility becomes available. A useful
backend/full-stack first pack is:

1. **Multi-tenant webhook delivery platform** — subscriptions, delivery contracts, ordering,
   retries, idempotency, tenant isolation, queues, rate limits, observability, and replay.
2. **High-volume notification platform** — preferences, templates, scheduling, fan-out, provider
   fallback, deduplication, quiet hours, delivery state, regional failure, and cost.

Each scenario needs:

- role and seniority compatibility;
- difficulty support (`guided`, `standard`, `stretch`);
- stable dimension/topic keys;
- four ordered compound stages and questions covering all sixteen dimensions;
- three progressive hints per question;
- a private 10-point rubric, reference answer, common mistakes, follow-ups, and transfer connection;
- content fingerprint, schema version, review record, and publication status;
- public/private snapshot audits proving answer material does not leak.

The click path should prefer approved static artifacts. AI generation belongs primarily in a
separate authoring/review pipeline, not in a candidate's start request.

## 7. Assessment and scoring

After all four questions are `COMPLETED` or `LEARNED`, unlock the existing five-prompt assessment
shell. Freeze the prompts at assessment start. Recommended measures are:

1. Requirements & scope;
2. APIs, data & capacity;
3. Architecture & trade-offs;
4. Reliability, security & operability;
5. Communication & evolution.

The final report must include:

- one score per measure;
- rubric-grounded evidence from the frozen transcript;
- strengths, gaps, and actionable next steps;
- dimension-level mastery evidence;
- a deterministic next-scenario recommendation with selection reasons;
- evaluator/schema/model versions and fingerprints.

Keep the existing lifecycle semantics:

```text
Block:    PRACTISING -> ASSESSMENT_READY -> ASSESSMENT_IN_PROGRESS -> ASSESSED
Question: ACTIVE -> COMPLETED
                 -> LEARNED
```

Drafts and hints never complete a question. **Learn** is explicit zero-mastery evidence. Historical
blocks are immutable and read-only. Start, finalize, and continue are idempotent. An AI evaluator
may score bounded written reasoning, but it must follow the frozen rubric and must not invent
requirements, traffic, or system facts not present in the scenario.

## 8. Reusability architecture

### 8.1 Reuse matrix

| Concern                                   | Reuse unchanged   | Configure through a neutral contract     | Architecture-owned                     |
| ----------------------------------------- | ----------------- | ---------------------------------------- | -------------------------------------- |
| Practice card visuals                     | Yes               | label/order/copy/href                    | availability and progress projection   |
| Preparation modal                         | Yes               | options, payload builder, copy, API base | Architecture focus confirmation schema |
| Overview/history UI                       | Yes               | noun, label, routes, normalized view     | Architecture block/history adapter     |
| Question workspace                        | Yes               | routes, labels, capabilities             | questions, rubric, evaluation          |
| Draft/hint/attempt/Learn                  | Shared lifecycle  | endpoint namespace and error prefix      | Architecture repository/evaluator      |
| Code runner                               | No                | capability must be false                 | none in v1                             |
| Assessment/report UI                      | Yes               | score rows/measures/next-item labels     | Architecture blueprint/evaluator       |
| Auth, error envelope, rate limits, leases | Yes               | namespace and policy                     | strict Architecture schemas            |
| Ranking algorithm shape                   | Yes               | generic candidate/evidence port          | dimensions, compatibility, catalogue   |
| Persistence orchestration                 | Shared interfaces | Architecture Prisma repository adapter   | Architecture rows/snapshots            |
| Content                                   | No                | common publication protocol              | scenarios, questions, reviews          |

### 8.2 Frontend extraction target

Applied Engineering currently imports components named `CoreTechnical*`, supplies
`StoryPractice*Experience` objects, and converts its domain into Core types using adapters. This
proved the visual reuse, but it should not become the permanent third-track API.

Move or re-export the stable presentation contracts under a neutral directory:

```text
src/components/workspace/story-practice/
  story-practice-preparation.tsx
  story-practice-intro.tsx
  story-practice-overview.tsx
  story-practice-question-workspace.tsx
  story-practice-assessment.tsx
  story-practice-artifact.tsx
  contracts.ts
```

Define one normalized presentation model owned by `story-practice`, not by Core Technical. Core,
Applied, and Architecture each adapt their public domain objects into it. Preserve compatibility
re-exports while moving code so existing imports and tests do not all need to change at once.

The neutral experience configuration must cover at least:

```ts
type StoryPracticeExperience = {
  key: "core-technical" | "applied-engineering" | "architecture-design";
  label: string;
  subjectNoun: string;
  routeBase: string;
  apiBase: string;
  intro: { description: string; script(title: string): string };
  preparation: {
    optionDetail: string;
    choices: readonly { value: string; label: string }[];
    buildConfirmation(value: string): unknown;
  };
  capabilities: { runCode: boolean };
  assessment: {
    measures: readonly string[];
    scoreRows(report: unknown): ReadonlyArray<readonly [string, number]>;
  };
};
```

Avoid `as unknown as CoreTechnical...` in the new Architecture adapter. If the normalized view
cannot represent a required Architecture field, improve the shared presentation contract rather
than pretending it is a Core object.

Architecture-specific components should be tiny:

```text
architecture-design-experience.ts
architecture-design-adapter.ts
architecture-design-preparation.tsx
architecture-design-overview.tsx
architecture-design-question-workspace.tsx
```

Most wrappers should only adapt props and render the neutral shell.

### 8.3 Backend extraction target

Do not copy all of `src/server/core-technical/` or `src/server/applied-engineering/`. Extract stable
orchestration behind typed ports:

```text
src/server/story-practice/
  contracts.ts                 # generic IDs, lifecycle states, public result shapes
  preparation-orchestrator.ts  # replay-safe confirm/prepare transaction protocol
  practice-orchestrator.ts     # draft/hint/attempt/learn state transitions
  assessment-orchestrator.ts   # readiness/start/finalize protocol
  continuation-orchestrator.ts # exactly one next current block
  history-reader.ts
  route-kit.ts                 # auth/parse/error/lease helpers or handler factories
```

The generic layer may own only behavior that is identical across domains. It receives domain ports
for:

- focus derivation;
- eligibility;
- catalogue/publication reads;
- deterministic ranking;
- content validation and public/private snapshotting;
- attempt evaluation;
- assessment blueprint/evaluation;
- persistence transactions and history projections;
- optional executable runner capability.

Core and Applied behavior must remain covered by their existing tests during extraction. Prefer
small compatibility adapters over a simultaneous data migration.

### 8.4 Persistence decision

Do **not** migrate Core Technical and Applied Engineering records into new generic tables as part of
this feature. That is high-risk and unrelated to the candidate-visible outcome.

Use separate Architecture-owned tables but implement them behind the shared repository port. The
recommended models are:

- `ArchitectureFocusRevision`;
- `ArchitectureScenarioDefinition` and `ArchitectureScenarioVersion`;
- `ArchitectureScenarioProgress`;
- `ArchitectureBlock` and `ArchitectureBlockQuestion`;
- `ArchitectureQuestionState` and `ArchitectureQuestionAttempt`;
- `ArchitectureAssessment` and `ArchitectureAssessmentReport`;
- `ArchitecturePreparationAttempt`.

There is no `ArchitectureCodeRun` in version 1. This makes the data domain explicit while still
sharing lifecycle code. Schema repetition is preferable to unsafe polymorphic foreign keys or a
large live-history migration.

Enforce:

- owner-scoped composite relations;
- one current block per owner through a partial unique index;
- stable owner ordinal;
- unique owner/request IDs for replay safety;
- immutable scenario/content/evaluator fingerprints;
- separate public/private snapshots;
- one assessment per block;
- history that remains readable after a catalogue item is retired;
- all-four-or-nothing block publication.

## 9. Pages, API routes, and application wiring

### 9.1 Server pages

Add:

```text
src/app/practice/architecture-design/page.tsx
src/app/practice/architecture-design/questions/[questionId]/page.tsx
src/app/practice/architecture-design/loading.tsx
src/app/practice/architecture-design/error.tsx
src/app/practice/architecture-design/not-found.tsx
```

Follow the existing App Router boundary:

- pages are Server Components;
- pages call owner-scoped services directly for reads;
- only serializable public snapshots cross into client components;
- client mutations call Route Handlers;
- current and historical blocks use the same owner-safe not-found behavior.

### 9.2 API surface

Architecture mirrors the lifecycle but omits the runner route:

| Method | Route                                                   | Responsibility                     |
| ------ | ------------------------------------------------------- | ---------------------------------- |
| GET    | `/api/practice/architecture-design`                     | Read current public block          |
| POST   | `/api/practice/architecture-design/confirm`             | Freeze Architecture focus          |
| POST   | `/api/practice/architecture-design/prepare`             | Idempotently publish first block   |
| POST   | `/api/practice/architecture-design/draft`               | Save a draft                       |
| POST   | `/api/practice/architecture-design/hint`                | Reveal the next hint               |
| POST   | `/api/practice/architecture-design/attempt`             | Evaluate and persist an attempt    |
| POST   | `/api/practice/architecture-design/learn`               | Confirm zero-mastery learned state |
| POST   | `/api/practice/architecture-design/assessment/start`    | Start/resume frozen assessment     |
| POST   | `/api/practice/architecture-design/assessment/finalize` | Persist immutable report           |
| POST   | `/api/practice/architecture-design/continue`            | Publish one adapted next block     |

Use a shared route kit so each `route.ts` is ideally an export plus Architecture schemas/config,
not another copy of leases and try/catch blocks. Keep explicit Architecture error codes and lease
namespaces for observability.

Every mutation requires authentication, completed preparation onboarding, strict Zod parsing,
owner-scoped IDs, existing rate-limit policies, a shared API error envelope, and a distributed
lease where the existing Core/Applied operation has one. Preparation remains all-or-nothing and
replay-safe.

### 9.3 `/practice` integration

Add an `ArchitectureDesignPracticeEntry` at order 4. For version 1, follow the currently shipped
transient-entry integration rather than changing personalized-plan projection:

1. `/practice` loads Architecture eligibility, current block, and analytics in parallel with the
   other reads.
2. Each Architecture read is isolated with the same safe fallback so it cannot break DSA, Core, or
   Applied cards.
3. `PracticeSessionsView` merges the entry by `order` and includes its totals.
4. Architecture activity is merged into Practice activity without changing other event shapes.
5. Progress remains owned by Architecture tables.

Leave `PRACTICE_SESSION_KEYS = ["dsa"]` and the interview projection alone unless a separate,
explicit migration makes every story-driven track first-class. Do not partly project Architecture
while Core and Applied remain appended.

Register Architecture services beside Core and Applied in `src/server/app-container.ts`. If the
container grows materially, introduce one `storyPractice` registry keyed by experience rather than
adding another long list of unrelated top-level properties. Do not use optional service access to
hide incomplete wiring.

## 10. Minimal-LOC guardrails

The goal is few new integration lines, not fewer correctness checks. Excluding reviewed content,
tests, Prisma schema/migration, and domain-specific rubrics, target:

| Area                                                | New production-line target |
| --------------------------------------------------- | -------------------------: |
| Architecture component experience/adapters/wrappers |               200 or fewer |
| Server pages and route wrappers                     |               250 or fewer |
| Architecture-specific orchestration adapters        |               400 or fewer |
| Practice card/container/analytics wiring            |               100 or fewer |
| **Total track-specific glue**                       |           **950 or fewer** |

If track-specific glue exceeds this, stop and identify which stable lifecycle or presentation
concept is being copied. Extract that concept into `story-practice` and keep per-track types at the
boundary.

Do not optimize LOC by:

- using broad `unknown as` casts;
- combining private and public snapshots;
- removing validation, leases, idempotency, or owner checks;
- making one table hold unrelated JSON without invariants;
- placing `if (track === ...)` branches throughout shared JSX;
- using Core/Applied records for Architecture history;
- turning content review into live generation;
- creating one enormous generic file.

Small domain files with clear contracts are preferable to a short unsafe implementation.

### 10.1 Whole-session LOC estimate

The `950 or fewer` target above applies only to Architecture-specific integration glue. It is not
the estimate for the complete production feature. The complete session also requires reviewed
questions and private rubrics, Architecture contracts, ranking and evaluation, persistence, and
release tests.

For comparison, the current Applied Engineering implementation contains approximately 7,083
production lines inside its feature directories before counting its Prisma migration and shared
integration edits. Architecture should be smaller because it reuses the presentation and lifecycle
and has no executable-question runner.

| Area                                           |   Estimated LOC |
| ---------------------------------------------- | --------------: |
| Shared extraction/refactoring                  |   0–300 net-new |
| Architecture contracts and onboarding evidence |         450–650 |
| Two complete reviewed scenarios                |     1,200–1,800 |
| Ranking and evaluation                         |         600–900 |
| Persistence and migration                      |         400–600 |
| Backend adapters and Architecture services     |         500–800 |
| Components, pages, APIs, Practice wiring       |         600–950 |
| **Production total**                           | **4,000–5,500** |
| Tests                                          |     2,000–3,000 |
| **Complete feature total**                     | **6,000–8,500** |

Use approximately **4,500 production lines and 7,000 total lines** as the working budget. These are
planning estimates, not targets to reach. Fewer lines are welcome when they come from real reuse.
If production exceeds roughly 5,500 lines, stop and audit the change for copied presentation,
Route Handler, lifecycle, persistence-orchestration, or assessment behavior.

Most Architecture-owned lines should be substantive domain material: eight reviewed MVP questions,
private grading rubrics, scenario metadata, evidence mappings, and tests. A small line count must
not be achieved by weakening owner scoping, snapshot privacy, validation, idempotency, or content
review.

## 11. Recommended file map

Architecture-owned code:

```text
src/lib/practice/architecture-design/
  contracts.ts
  baseline-evidence-contracts.ts
  focus-ranking-contracts.ts
  scenario-contracts.ts
  question-contracts.ts
  assessment-contracts.ts
  reviewed-scenarios.ts
  scenario-ranking-catalogue.ts
  ui-state.ts
  workspace-analytics.ts

src/server/architecture-design/
  baseline-evidence.service.ts
  focus.service.ts
  eligibility.service.ts
  scenario-ranking.service.ts
  persistence.service.ts
  attempt-evaluator.ts
  assessment-blueprint.ts
  assessment-evaluator.ts
  repository-adapter.ts
  workspace-analytics.service.ts

src/components/workspace/architecture-design/
  architecture-design-experience.ts
  architecture-design-adapter.ts
  architecture-design-preparation.tsx
  architecture-design-overview.tsx
  architecture-design-question-workspace.tsx
```

Shared extractions belong in `src/components/workspace/story-practice/` and
`src/server/story-practice/`, as described above. Do not create Architecture copies of shared
orchestrators after they exist.

## 12. Build order

The complete feature has **10 formal implementation and release steps**. Implement and verify one
vertical step at a time.

| Step | Deliverable                                                               | Status      |
| ---: | ------------------------------------------------------------------------- | ----------- |
|    1 | Freeze naming, scope, dimensions, formats, and neutral view contracts     | Complete    |
|    2 | Extract neutral frontend shells with Core/Applied regression coverage     | Complete    |
|    3 | Extract shared server lifecycle/route ports without data migration        | Complete    |
|    4 | Architecture contracts, private/public snapshots, and baseline evidence   | Complete    |
|    5 | Two reviewed scenarios, ranking catalogue, release audit, and publisher   | Complete    |
|    6 | Architecture Prisma models, migration, and repository adapter             | Complete    |
|    7 | Focus, eligibility, preparation, attempt evaluation, and lifecycle wiring | Complete    |
|    8 | Assessment, report, continuation, history, and analytics                  | Complete    |
|    9 | Thin pages, Route Handlers, Practice card, and container registration     | Complete    |
|   10 | Unit, integration, regression, and authenticated browser release gate     | Not started |

Step 1 completion evidence:

- `src/lib/practice/architecture-design/contracts.ts` freezes the canonical identity, version-1
  scope, sixteen design dimensions, non-executable formats/artifacts, and four-stage MVP interview arc.
- `src/components/workspace/story-practice/contracts.ts` defines the neutral, typed presentation
  experience that Step 2 will adopt without combining domain persistence types.
- `src/lib/practice/architecture-design/contracts.spec.ts` passes 6 focused contract tests.
- `pnpm exec tsc --noEmit` and focused ESLint checks pass.

Step 2 completion evidence:

- `src/components/workspace/story-practice/view-contracts.ts` owns the normalized block, question,
  work, feedback, run, assessment, history, and library presentation models. The contracts contain
  no Core Technical, Applied Engineering, or Architecture persistence types.
- The six direct `story-practice` facade modules provide the stable preparation, intro, overview,
  workspace, assessment, and artifact imports while compatibility exports preserve existing Core
  call sites.
- Preparation, overview, question, and assessment shells now take typed experience configuration
  for route/API namespaces, copy, options, payloads, environment labels, coach steps, scoring rows,
  response guidance, and the executable-run capability.
- Applied Engineering imports the neutral facades and maps its public domain data directly into the
  neutral view contracts; it no longer casts Applied records into Core Technical presentation or
  server types.
- Architecture proves the seam with a thin preparation wrapper and configuration that sends only
  `{ path: "role-aligned" }`, uses the design icon/copy, and targets its own API and route namespace.
- TypeScript, focused ESLint/format checks, and 38 focused Core/Applied/Architecture regression tests
  pass. Browser-DOM tests emit only the existing jsdom `HTMLMediaElement.load()` warning.

Do not begin Step 3 on top of an unexplained Core or Applied regression. The passing Step 2 suite is
the baseline for extracting server lifecycle ports without a data migration.

Step 3 completion evidence:

- `src/server/story-practice/contracts.ts` defines neutral preparation, question, optional runner,
  assessment, continuation, and history ports plus the shared lifecycle status vocabulary.
- The preparation, practice, assessment, and continuation orchestrator modules own the identical
  replay checks, deterministic fingerprints, work/hint/run validation, assessment start/response
  rules, bounded diagnostics, and continuation readiness rules.
- `src/server/story-practice/route-kit.ts` centralizes authentication, completed-onboarding access,
  rate limiting, strict JSON parsing, eligibility error mapping, API envelopes, and optional
  distributed-lease cleanup. Core and Applied `_shared.ts` route gates now configure this kit.
- Core Technical and Applied Engineering services call the neutral invariants while retaining their
  existing domain schemas, error codes/messages, Prisma transactions, tables, and persistence
  services. No data model or migration changed.
- The focused shared/Core/Applied lifecycle and route suite passes alongside TypeScript, ESLint,
  formatting, and diff checks. This is the regression baseline for Architecture domain work.

Step 4 adds Architecture-owned contracts and baseline evidence against these ports without
introducing Architecture Prisma models or application routes before their later documented steps.

Step 4 completion evidence:

- Architecture-owned scenario, question, focus/ranking, and assessment schemas enforce the fixed
  four-stage MVP arc, all sixteen dimensions, non-executable formats, three hints, 10-point private
  rubrics, five assessment measures, and immutable fingerprint/version fields.
- Explicit public question, focus, and assessment projections omit reference answers, answer
  indexes, hints, rubrics, expected answers, private source identities, and evaluator material.
- The versioned baseline registry maps all 50 backend/full-stack Architecture onboarding questions
  to valid Architecture dimensions using canonical fingerprints that ignore shuffled option IDs,
  option order, and the private answer key.
- `ArchitectureDesignBaselineEvidenceService` reads only owner-scoped frozen `architecture`
  assignments and saved answers. It treats the private snapshot as authoritative, uses the public
  `architecture-design` signal only as a consistency check, returns deeply frozen answer-free
  evidence, maps correct to `STANDARD`, incorrect to `GUIDED`, and every missing/corrupt/stale case
  to `UNKNOWN`; `STRETCH` is not representable by the baseline state schema.
- Twenty focused Architecture contract/evidence tests and 180 affected onboarding,
  story-practice, Core, and Applied regression tests pass with TypeScript, ESLint, formatting, and
  diff checks. No Prisma model, migration, application route, or container registration changed.

Step 5 completion evidence:

- Two approved four-question artifacts cover multi-tenant webhook delivery and a
  high-volume notification platform. Every question has three progressive hints, a private
  reference answer, a 10-point dimension-linked rubric, common mistakes, follow-ups, and a transfer
  connection; the two scenarios cover all sixteen dimensions without executable capabilities.
- The ranking catalogue is derived deterministically from reviewed artifact compatibility and
  exposes both approved artifacts as version-1 published candidates.
- The content audit checks schema identity, scenario/question coherence, distinct artifacts,
  complete dimension coverage, unique hints, and private/public snapshot safety.
- The project owner approved both artifacts on 2026-09-08. The idempotent repository publisher
  persists stable fingerprints and separate private/public question snapshots while continuing to
  reject candidate or unapproved content.
- Both immutable version-1 scenarios are published in the configured database and live eligibility
  reports `AVAILABLE` with `publishedScenarioCount: 2` for a supported backend/full-stack profile.

Step 6 completion evidence:

- Architecture-owned Prisma models cover immutable focus revisions, reviewed scenario versions,
  owner progress, four-question blocks and state, attempts, assessments and reports, and replayable
  preparation attempts. There is deliberately no `ArchitectureCodeRun`.
- The isolated migration enforces owner ordinals and request IDs, owner-scoped composite foreign
  keys, one current block per owner through a partial unique index, one assessment per block,
  four-question order bounds, snapshot retention, and restrictive scenario-version history.
- `ArchitectureDesignRepositoryAdapter` implements the neutral story-practice repository port. Its
  transaction saves content-addressed focus, refuses content without human approval, preserves
  separate public/private reviewed snapshots, verifies the exact published content fingerprint,
  and creates all four questions plus the locked assessment atomically.
- Persistence tests independently retain a synthetic unapproved fixture to prove the approval gate;
  the two approved source artifacts are published through the same idempotent persistence service.
  The full suite passes alongside Prisma validation, TypeScript, ESLint, formatting, and diff checks.

Step 7 completion evidence:

- Strict practice contracts accept only choice and written work; Architecture has no code work,
  run input, runner service, or executable lifecycle branch.
- `ArchitectureDesignFocusService` freezes server-derived, owner-scoped profile, resume, latest
  ready Architecture blueprint, and baseline evidence. The browser can confirm only
  `{ path: "role-aligned" }` and cannot choose a scenario or difficulty.
- Eligibility fails closed unless the role and level are supported and at least two compatible
  catalogue entries also exist as published database versions. It has no runner dependency.
- Deterministic first-scenario ranking enforces publication, role, seniority, prerequisite,
  exclusion, and recency gates before scoring baseline gaps, target fit, resume relevance,
  dimension coverage, plan coverage, and novelty.
- Preparation uses the shared replay/failure protocol and reads exact private scenario/question
  snapshots from the published database version. The Step 6 transaction remains the only block
  publication path, so retry or failure cannot save a partial four-question block.
- Choice evaluation is deterministic; written evaluation is bound to the frozen scenario,
  artifact, reference answer, and rubric. Attempts retain evaluator version and fingerprint, while
  a no-model fallback is explicitly unverified and model failures do not persist partial attempts.
- Owner-scoped draft, progressive hint, attempt, and Learn transitions are durable. Drafts and
  hints remain non-terminal, Learn has no scored attempt, and the fourth terminal question unlocks
  exactly the existing block assessment; Step 8 now owns its assessment/report behavior.
- Active public question reads omit reference answers, answer indexes, hidden hints, rubrics, and
  evaluator source material. The full suite passes 1,245 tests across 200 files (with the existing
  8 skipped tests), alongside TypeScript and ESLint checks.

Step 8 completion evidence:

- The assessment blueprint freezes five prompts from the four terminal design questions and keeps
  expected answers, source identities, and private rubrics out of the public assessment snapshot.
- Assessment start/resume and finalization preserve the shared replay-safe lifecycle. Submitted
  answers are checkpointed before bounded semantic evaluation, evaluation failures remain
  retryable, and the report plus safe transcript are persisted once as immutable snapshots.
- Reports include all five measure scores, all sixteen dimension results, evaluator/model/scoring
  identities and fingerprints, strengths, gaps, next steps, solved-versus-Learned evidence, and a
  deterministic next-scenario selection. Learned questions contribute zero adaptive Practice
  mastery.
- Continue reads the exact recommended published scenario version and publishes one successor
  atomically while the assessed block remains current until success. Successful request replays do
  not publish another block, and failures preserve the completed report.
- History and workspace analytics are owner-scoped projections of frozen block, question,
  assessment, report, and transcript snapshots; historical reads do not depend on the live
  catalogue and Architecture projects no executable exercise.
- Twelve focused Architecture suites pass 67 tests. The full repository suite passes 1,255 tests
  across 202 files, with the existing 8 tests skipped, alongside TypeScript, ESLint, Prisma
  validation, focused formatting, and diff checks.

Step 9 completion evidence:

- Thin async Server Component pages now serve the current or owner-scoped historical Architecture
  scenario and question workspace. They read services directly, pass only public serializable
  snapshots into the shared client presentation, and provide loading, error, and owner-safe
  not-found boundaries.
- The Architecture presentation adapter maps its scenario, written/choice questions, design
  feedback, five assessment measures, immutable report, history, and library records into the
  neutral story-practice views. Its workspace explicitly disables executable runs, and shared
  question-count labels now derive from each block so existing eight-question Core/Applied blocks
  and four-question Architecture blocks render correctly.
- The complete Route Handler surface now includes the current-block read plus confirm, prepare,
  draft, hint, attempt, Learn, assessment start/finalize, and continuation mutations. Every route
  uses the shared completed-onboarding/owner guard, strict Architecture schemas, rate limits, and
  the required distributed leases. There is deliberately no Architecture `/run` route.
- `/practice` reads Architecture eligibility, current progress, and analytics independently and in
  parallel. An Architecture failure cannot break DSA, Core, or Applied cards. The order-4 card stays
  discoverable with the exact unavailable reason while publication or profile gates are closed;
  eligible or resumable work links to the Architecture workspace. Historical totals and activity
  contribute to the existing workspace summaries.
- `getAppContainer()` registers the complete Architecture service graph as one explicit grouped
  capability, including baseline, focus, ranking, repository, practice, preparation, assessment,
  continuation, history, eligibility, and analytics services, without a runner dependency.
- The focused Step 9 boundary suite passes 23 tests across 7 files, and the affected shared, Core,
  Applied, Architecture, page, and API regression suite passes 231 tests across 49 files. The full
  repository suite passes 1,269 tests across 207 files, with the existing 8 tests skipped. TypeScript,
  ESLint, Prisma validation, formatting, diff checks, and the optimized Next.js production build
  pass; the build route manifest contains the Architecture pages and required handlers and no
  Architecture run endpoint.

## 13. Test and release requirements

### Contract and content tests

- exactly four ordered questions per scenario;
- allowed non-executable formats only;
- three hints and a 10-point private rubric per question;
- unique keys and stable fingerprints;
- no answer/reference/rubric leakage in public snapshots;
- all referenced dimensions exist in the Architecture registry;
- both scenarios pass human-review and publication audits.

### Onboarding/focus/ranking tests

- resolved correct Architecture baseline becomes `STANDARD`, never `STRETCH`;
- resolved incorrect becomes `GUIDED`;
- missing, corrupt, stale, or unresolvable baseline becomes `UNKNOWN` without failing Practice;
- answer keys never appear in returned evidence/focus;
- profile, plan, and previous reports are owner-scoped;
- ranking is deterministic for frozen inputs;
- incompatible roles/difficulties and recent scenarios are excluded;
- at least two database-published compatible scenarios are required;
- eligibility does not depend on the Node runner.

### Lifecycle and persistence tests

- confirm creates/reuses content-addressed focus revisions correctly;
- prepare replay returns the same result for the same owner/request ID;
- concurrent prepare cannot create two current blocks;
- failed prepare leaves no partial block/questions;
- drafts/hints do not complete questions;
- evaluated attempt and Learn transitions are correct;
- Learn contributes zero mastery;
- all four terminal questions unlock one assessment;
- assessment start/finalize/continue are idempotent;
- continuation creates exactly one new current block;
- historical public snapshots survive catalogue retirement;
- cross-owner IDs return not-found/conflict without leaking existence.

### Shared UI and app regression tests

- Core Technical appearance and behavior remain unchanged;
- Applied Engineering adapters remain type-safe and behaviorally unchanged;
- DSA is unchanged;
- Architecture preparation, overview, workspace, assessment, report, and history match the shared
  visual baseline on desktop and mobile;
- no Run button or runner call is possible for Architecture;
- refresh restores drafts and current state;
- browser back/forward and historical block URLs work;
- keyboard focus, modal trapping, labels, errors, and reduced-motion behavior match the existing
  session;
- an Architecture service failure does not break the other `/practice` cards.

Run narrow tests after each step, then the affected Practice/Core/Applied regression suites, type
checking, lint, and an authenticated end-to-end browser pass before release. Do not mark the feature
complete from unit tests alone.

## 14. Definition of done

Architecture & Design is complete only when:

- every user sees the order-4 card, while only an eligible backend/full-stack user or an owner with
  resumable work can open it;
- a first entry freezes server-derived onboarding/resume context;
- the browser cannot select difficulty or scenario;
- two reviewed, database-published scenarios satisfy eligibility;
- preparation atomically creates one frozen four-question block;
- all question states, assessment states, history, and continuation survive refresh/retry;
- public APIs never expose answer keys or private rubrics;
- Architecture has no runner dependency or dead `/run` UI;
- Core, Applied, and DSA regressions pass;
- authenticated desktop/mobile browser verification passes;
- this document's status and build table reflect the shipped state.

## 15. Context packet for the next AI agent

The next agent should not scan the repository randomly. Give it this document plus the current git
status and ask it to read in the following order.

### Required reading order

1. `docs/STORY_DRIVEN_ARCHITECTURE_DESIGN.md` — this source of truth.
2. `docs/CORE_TECHNICAL_UI_BASELINE.md` — visual and interaction parity contract.
3. `docs/STORY_DRIVEN_CORE_TECHNICAL.md` — complete lifecycle and release decisions.
4. `docs/STORY_DRIVEN_APPLIED_ENGINEERING.md` — nearest reuse implementation and current status.
5. Profile onboarding:
   - `src/app/onboarding/page.tsx`
   - `src/components/onboarding/flow/onboarding-flow.tsx`
   - `src/app/api/onboarding/resume/route.ts`
   - `src/app/api/onboarding/complete/route.ts`
   - `src/server/profile/profile.service.ts`
6. Preparation onboarding and Architecture evidence source:
   - `src/app/(marketing)/page.tsx`
   - `src/components/workspace/dashboard/maya-welcome.tsx`
   - `src/app/api/preparation-onboarding/route.ts`
   - `src/lib/preparation/preparation-onboarding.ts`
   - `src/lib/preparation/preparation-areas.ts`
   - `src/lib/preparation/architecture-question-bank.ts`
   - `src/lib/preparation/ai-ml-architecture-question-bank.ts`
   - `src/server/preparation/preparation-onboarding-state.ts`
   - `src/server/preparation/preparation-onboarding.service.ts`
7. Practice entry:
   - `src/app/practice/page.tsx`
   - `src/lib/practice/practice-roadmap.ts`
   - `src/components/workspace/practice/practice-sessions-view.tsx`
8. Existing reusable presentation:
   - `src/components/workspace/core-technical/`
   - `src/components/workspace/applied-engineering/applied-engineering-experience.ts`
   - `src/components/workspace/applied-engineering/applied-engineering-adapter.ts`
   - `src/components/workspace/shared/story-practice-artifact.tsx`
9. Existing backend pattern:
   - `src/app/api/practice/core-technical/`
   - `src/server/core-technical/`
   - `src/app/api/practice/applied-engineering/`
   - `src/server/applied-engineering/`
   - the Core/Applied models in `prisma/schema.prisma`
   - their registration in `src/server/app-container.ts`
10. Existing personalized Architecture context:
    - `src/lib/interviews/personalized-plan.ts`
    - `src/server/interview/personalized-plan-generator.ts`
    - `src/server/interview/candidate-profile-compiler.ts`
    - `src/server/interview/personalized-interview-planning.service.ts`

Do not use `docs/CORE_TECHNICAL_ADAPTIVE_PRACTICE.md`; it is superseded by the story-driven Core
document. Treat `docs/NEW_ONBOARDING_AND_ADAPTIVE_PRACTICE.md` as historical context where it
conflicts with current code.

### First response expected from the next agent

Before editing, the agent should report:

1. the current `git status` and which changes belong to the in-progress Applied work;
2. the next unfinished build step from this document;
3. the exact Core/Applied behavior it will preserve;
4. the shared files it will extract or reuse;
5. the Architecture-owned files it will add;
6. the narrow and regression tests it will run.

### Ready-to-use handoff prompt

```text
Implement the next unfinished step in docs/STORY_DRIVEN_ARCHITECTURE_DESIGN.md.

Read that document completely, then follow its “Context packet for the next AI agent” reading
order. Inspect git status first. The current Applied Engineering work is in progress and must be
preserved.

Architecture & Design is Practice session 4 at /practice/architecture-design. It must reuse the
same story-practice lifecycle and visual shell as Core Technical and Applied Engineering. Do not
copy either feature into a third large implementation. Extract stable presentation and lifecycle
behavior behind neutral typed contracts, keep each domain's content/evaluation/persistence
separate, and retain compatibility adapters so existing behavior does not change.

Use the private frozen onboarding section `architecture` plus the public `architecture-design`
signal to derive answer-free server-owned baseline evidence. Add resume/target context and prior
Architecture results on the server; never ask the browser to send them. The interview blueprint
kind remains `architecture-system-design`; do not rename persisted interview identities.

Version 1 supports reviewed backend/full-stack system-design scenarios, contains no executable
questions, does not depend on Node.js, and has no /run route. Keep confirm -> idempotent prepare,
four terminal questions -> frozen five-prompt assessment -> report -> explicit continue. Preserve
owner scoping, private/public snapshots, atomic publication, history, rate limits, leases, strict
validation, and human review.

Implement only the next coherent build step. Before editing, summarize the request path, reuse
boundary, files, and tests. After editing, run the narrow tests and affected Core/Applied/Practice
regressions, then update this document only when the status really changed.
```

At every agent handoff, include:

- current branch and `git status`;
- changed and untracked files;
- completed build step;
- commands/tests run and exact results;
- next unfinished step;
- any release/content approval still required;
- known assumptions or blockers.

## 16. Non-goals

- No redesign of `/practice`, DSA, Core Technical, or Applied Engineering.
- No rename/migration of the persisted `architecture-system-design` interview kind.
- No Core/Applied history-table migration during this feature.
- No live diagram editor, collaborative canvas, or diagram image grading in version 1.
- No code runner, cloud sandbox, live database, queue, cache, or external network.
- No live unreviewed question generation on the candidate start path.
- No frontend-owned focus, difficulty, ranking, grading, or lifecycle decisions.
- No readiness score inferred from the one-question onboarding pulse.
- No launch for a role with fewer than two reviewed compatible scenarios.

The intended result is a fourth Practice session that feels native and complete while adding very
little track-specific glue: shared UX and lifecycle, Architecture-owned knowledge and evidence.
