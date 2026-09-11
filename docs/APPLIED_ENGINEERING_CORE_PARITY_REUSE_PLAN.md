# Applied Engineering — Core Technical Parity and Reuse Plan

Status: Implementation in progress; Steps 1–8 complete; Step 9 automated gate complete

Scope: `/practice/applied-engineering`

Companion documents:

- `docs/CORE_TECHNICAL_PERSONALIZED_PATH_REQUIREMENTS.md` defines the current product behavior to
  mirror.
- `docs/CORE_TECHNICAL_UI_BASELINE.md` defines the visual and responsive baseline.
- `docs/STORY_DRIVEN_APPLIED_ENGINEERING.md` remains the source of truth for Applied Engineering
  content, evidence, persistence, and release rules.

## 1. Objective

Make Applied Engineering use the same polished product shell, lifecycle, and live assessment room
as Core Technical while keeping its curriculum more applied.

The two experiences should feel like consecutive sessions in one product:

- the same authenticated first-entry welcome;
- the same technology-selection interaction and teacher treatment;
- the same path-library layout and question-row behavior;
- the same question workspace controls and responsive states;
- the same assessment card, media setup, live teacher room, typed fallback, transcript, save/resume
  behavior, and completion handoff;
- the same reliability guarantees for retries, immutable history, privacy, and atomic persistence.

Only the subject matter changes:

- Core Technical explains language and runtime mechanisms.
- Applied Engineering diagnoses production evidence, repairs a failure, verifies the repair, and
  ships it safely.

Exact parity means sharing the implementation, not manually copying its current markup and logic.
A future Core polish change should flow into Applied Engineering through the shared layer unless
the difference is intentionally declared in the Applied experience configuration.

## 2. Non-negotiable product invariants

### 2.1 Visual parity

Applied Engineering must use the same component implementation as Core Technical for:

- page width, responsive padding, and breakpoints;
- teacher/avatar placement and mobile visibility;
- bounded alpha feathering without decorative blur behind the avatar;
- typography hierarchy, surfaces, borders, radii, and focus rings;
- progress rail, history navigation, sticky coach panel, and path cards;
- animated card disclosure and question rows;
- locked, ready, in-progress, finalizing, completed, retry, and historical states;
- question workspace toolbar, editor, artifact, hints, feedback, learning guide, and diagram;
- assessment preview, live room, completion screen, and report layout;
- keyboard, screen-reader, touch, reduced-motion, and mobile behavior.

Do not create an Applied-only copy of the Core components. Do not approximate the styling in a
second implementation. Shared components must render both experiences from a neutral view model
and an explicit experience configuration.

### 2.2 Lifecycle parity

The lifecycle must remain server-owned:

```text
unavailable
  -> technology welcome
  -> confirming
  -> preparing
  -> practising
  -> assessment ready
  -> live assessment in progress
  -> finalizing
  -> completed report
  -> next incident or preparation complete
```

Client components may display state and invoke authenticated mutations. They must not calculate
eligibility, choose an incident, unlock an assessment, grade an answer, infer readiness, or promote
the next block.

### 2.3 Assessment-room parity

Applied Engineering assessment must use the same live room used by DSA and Core Technical:

- the selected teacher joins and speaks all five frozen prompts;
- the current prompt and its frozen production artifact remain visible;
- candidates can answer by voice or with the typed fallback;
- the teacher may ask at most one focused, evidence-grounded follow-up per prompt;
- the teacher gives a concise teaching point before the next prompt;
- **Save & exit** disconnects without submitting a partial assessment;
- reopening resumes the same durable room, question index, transcript, and answers;
- there is no second interview-setup form;
- there is no form-only Applied assessment substitute;
- reaching prompt five converts the saved transcript into the Applied five-score report;
- interrupted evaluation leaves the submission in a recoverable `FINALIZING` state;
- returning to the Applied overview recovers a completed room or shows an explicit retry action.

The five prompts must be prepared from the immutable Applied block before the room opens. Opening
or resuming the room must never generate assessment questions in real time.

### 2.4 Domain isolation

Shared behavior does not mean shared candidate records. Keep these Applied-specific:

- Applied Engineering Prisma models and database rows;
- focus, incident, question, assessment, report, and ranking schemas;
- reviewed incidents and private answer material;
- production-signal evidence and scoring;
- API namespace, lease namespace, analytics, and error codes;
- content publication and human-review gates.

An Applied service must not write Core Technical blocks or cast an Applied private snapshot to a
Core private snapshot merely to reuse business logic.

## 3. Current implementation inventory

Applied Engineering already has most domain infrastructure:

- pages under `src/app/practice/applied-engineering/`;
- authenticated routes under `src/app/api/practice/applied-engineering/`;
- separate schemas under `src/features/practice/applied-engineering/domain/`;
- focus, ranking, preparation, persistence, practice, assessment, continuation, history, analytics,
  and runner services under `src/features/practice/applied-engineering/server/`;
- two reviewed production incidents in
  `src/features/practice/applied-engineering/domain/reviewed-incidents.ts`;
- a normalized presentation adapter in
  `src/features/practice/applied-engineering/ui/applied-engineering-adapter.ts`;
- experience copy and score mappings in
  `src/features/practice/applied-engineering/ui/applied-engineering-experience.ts`;
- thin Applied wrappers for preparation, overview, and question workspace;
- reuse of the isolated Node.js runner through
  `src/features/practice/applied-engineering/server/runner.service.ts`.

The shared foundation already includes:

- neutral UI contracts and view models in `src/features/practice/shared/ui/`;
- preparation, practice, assessment, continuation, and evidence helpers in
  `src/features/practice/shared/server/`;
- authenticated route factories and leases in
  `src/features/practice/shared/server/route-kit.ts`.

### 3.1 Current shared ownership

The stable presentation implementations, including the polished technology welcome, now live in
`src/features/practice/shared/ui/`. Core Technical keeps thin configuration wrappers so its route
and test imports remain stable; Applied Engineering consumes the same neutral components through
its own configuration and view adapters.

### 3.2 Missing parity today

The implementation work is complete through readiness and continuation parity. Release verification
still needs authenticated desktop/mobile comparison, keyboard and screen-reader checks, and a real
voice-room exercise covering microphone, typed fallback, Save & exit, resume, and completion.

## 4. Target architecture

Use a neutral Story Practice shell with typed domain adapters:

```text
                         Story Practice shared layer
                 UI + room protocol + lifecycle orchestration
                         /                         \
                        /                           \
        Core Technical adapter              Applied Engineering adapter
        mechanism curriculum                production incident curriculum
        Core schemas/repository             Applied schemas/repository
        Core evaluator/ranking              Applied evaluator/ranking
```

The dependency direction is:

```text
Core Technical ---------> shared story-practice <--------- Applied Engineering
       |                                                       |
       v                                                       v
Core domain + persistence                            Applied domain + persistence
```

The shared layer must not import either feature's domain contracts.

## 5. Shared UI design

### 5.1 Move implementation ownership

Move the stable implementations into these neutral files:

```text
src/features/practice/shared/ui/
  story-practice-technology-welcome.tsx
  story-practice-preparation.tsx
  story-practice-intro.tsx
  story-practice-overview.tsx
  story-practice-question-workspace.tsx
  story-practice-assessment.tsx
  story-practice-artifact.tsx
  contracts.ts
  view-contracts.ts
```

Keep compatibility wrappers in the Core directory if they avoid a large simultaneous import
rewrite. Those wrappers should contain no behavior.

### 5.2 Experience configuration

Extend the neutral configuration instead of checking feature slugs inside components. A useful
shape is:

```ts
type StoryPracticeExperience = {
  key: "core-technical" | "applied-engineering";
  label: string;
  subjectNoun: "practice path" | "incident";
  routeBase: `/practice/${string}`;
  apiBase: `/api/practice/${string}`;
  environmentLabel: string;
  technologyWelcome: {
    heading: string;
    script: (technology?: string) => string;
    options: readonly TechnologyOption[];
    buildConfirmation: (technology: string) => unknown;
  };
  library: {
    description: string;
    startUnstartedPathEndpoint: `/api/practice/${string}/start-path`;
  };
  workspace: {
    canRunCode: boolean;
    answerPlaceholder: string;
    reasoningLabel: string;
  };
  assessment: {
    mode: "shared-voice-room";
    measures: readonly [string, string, string, string, string];
    defenceDescription: string;
    evidenceAnchorLabel: string;
    scoreRows: (report: unknown) => ReadonlyArray<readonly [string, number]>;
  };
};
```

Avoid conditions such as:

```ts
experience.slug === "core-technical";
```

Use capabilities or explicit configuration instead:

```ts
experience.assessment.mode === "shared-voice-room";
```

### 5.3 Normalized view model

Continue using `StoryPracticeBlockView`, `StoryPracticeQuestionView`, and
`StoryPracticeAssessmentView`. Improve those neutral types when Applied needs another public field.
Do not solve a missing field with `as unknown as CoreTechnical...`.

Applied adapters should translate names without erasing domain meaning:

- `incident` -> shared `story` presentation;
- `productionSignalKeys` -> shared mechanism/evidence tags;
- Applied feedback fields -> shared feedback presentation;
- `nextIncident` -> shared next-item presentation;
- Applied score dimensions -> the five shared report rows.

## 6. Shared live assessment-room design

### 6.1 Neutral durable identity

Replace new Core-only branching with a neutral identity while keeping backward compatibility for
already saved Core sessions:

```ts
type StoryPracticeAssessmentIdentity = {
  kind: "story-practice-assessment";
  practice: "core-technical" | "applied-engineering";
  blockId: string;
  assessmentId: string;
  snapshotVersion: number;
  evaluatorVersion: string;
};
```

Existing `coreTechnicalAssessment` sessions must remain readable and resumable. Introduce the new
identity additively, teach the session helpers to recognize both forms, and remove the compatibility
field only after saved-session retention no longer requires it.

### 6.2 Neutral runtime service

Extract the stable portion of `CoreTechnicalAssessmentRuntimeService` into a shared coordinator.
The coordinator should receive domain ports for:

- start/resume assessment state;
- load the owned frozen assessment and block context;
- build the public interview setup;
- build exactly five planned questions;
- identify the practice kind and return route.

Core and Applied keep small adapters:

```text
core-technical/server/assessment-runtime.service.ts
applied-engineering/server/assessment-runtime.service.ts
```

The Applied adapter maps its prompt kinds to interview stages and listening expectations:

| Applied prompt        | Room competency | Required evidence                                 |
| --------------------- | --------------- | ------------------------------------------------- |
| Evidence defence      | Diagnosis       | strongest signal, causal chain, consequence       |
| Repair defence        | Implementation  | restored invariant, edge case, test evidence      |
| Unseen diagnosis      | Transfer        | first inspection, likely cause, alternative       |
| Verification transfer | Testing         | deterministic proof, race/retry/load boundary     |
| Rollout defence       | Safe delivery   | success signal, rollback trigger, bounded failure |

Private expected answers and rubrics may be attached to the server-side planned question. They must
be omitted by the interview API serializer.

### 6.3 Dialogue behavior

Extract the stable Core assessment dialogue into a neutral helper with domain-provided wording:

```ts
type StoryPracticeAssessmentDialogue = {
  openingShape: string;
  expectations: readonly string[];
  transitions: readonly string[];
  closingLines: readonly string[];
  teachingPrefix: string;
};
```

Applied wording should sound production-oriented, for example:

- establish the observable signal before naming a cause;
- state blast radius and failure boundary;
- defend the smallest safe repair;
- prove the repair with deterministic evidence;
- define rollout success and rollback thresholds.

Do not fork the conversation state machine. The same follow-up limits, evaluation handling,
turn persistence, reconnect behavior, microphone behavior, typed fallback, and completion screen
must serve both domains.

### 6.4 Transcript finalization

Extract a neutral helper that groups saved user turns by frozen question index and bounds each
answer to the domain schema's maximum length. The Applied assessment service remains responsible
for:

- verifying owner, session, block, and assessment identity;
- requiring the durable room to be in `done` phase;
- mapping the five transcript answers to the five frozen Applied prompt IDs;
- checkpointing the exact submission and request fingerprint;
- invoking `AppliedEngineeringAssessmentEvaluator`;
- atomically creating the Applied report and completing Applied rows;
- recovery when deferred report generation was interrupted.

The interview completion API may invoke both domain finalizers safely; each finalizer must return
`null` unless the session identity belongs to its domain.

## 7. Applied-specific product behavior

### 7.1 Technology welcome

Use the same welcome shell and teacher/avatar treatment as Core Technical. Applied technology
options should be restricted to reviewed executable scope. Initially this may be JavaScript,
TypeScript, Node.js, and only the frameworks for which exact Applied incident content or truthful
framing exists.

The browser sends only the selected technology. The server derives role, seniority, resume
evidence, baseline evidence, target job/company, framework, and exclusions.

Use one session-storage idempotency key per confirmed focus so a retry replays the same preparation
request instead of creating a duplicate block.

### 7.2 Applied paths and questions

Applied paths are production incidents. They may use a different question contract from Core as
long as the normalized UI can display them and the assessment remains five prompts.

Every incident should progress through:

1. symptom triage;
2. evidence interpretation;
3. root-cause and blast-radius reasoning;
4. unsafe assumption or defect identification;
5. bounded repair;
6. verification;
7. resilience, security, or operability hardening;
8. rollout, monitoring, and rollback.

If Applied later adopts six questions for product consistency, preserve eight-question immutable
snapshots and make count compatibility explicit in schemas and assessment builders. UI components
must always derive counts from the saved block rather than hard-code six or eight.

Useful artifacts include:

- logs and correlated traces;
- latency and saturation metrics;
- query plans and database evidence;
- request waterfalls;
- retry and queue-delivery timelines;
- code, tests, configuration, and rollout constraints.

### 7.3 Library behavior

Match Core's library exactly:

- current incident first and expanded;
- prerequisite/curriculum order for the remainder;
- expandable cards with status, difficulty, topic, and progress;
- question rows are the only action;
- selecting an unstarted question materializes an exact reviewed snapshot without live generation;
- the selected question opens after materialization;
- loose incident work does not replace the current assessment-bearing incident;
- promotion after assessment reuses existing question states and attempts;
- selected cards use the same restrained accent border without a gradient or glow wash.

Add an Applied `start-path` route only if it delegates to the same neutral row-start interaction and
the Applied preparation service's exact reviewed-artifact path.

## 8. Reuse boundaries by layer

| Layer                 | Reuse                                       | Keep Applied-specific                 |
| --------------------- | ------------------------------------------- | ------------------------------------- |
| Page shell            | Shared layout and state projection          | Metadata and unavailable copy         |
| Welcome               | Shared component and state machine          | Options, speech, confirmation payload |
| Overview/library      | Shared component                            | Adapter and experience copy           |
| Question workspace    | Shared component                            | Question/feedback adapter             |
| Code execution        | Shared sandbox executor                     | Applied contract adapter and records  |
| Route plumbing        | Shared factories/leases                     | Schemas, namespaces, service calls    |
| Practice lifecycle    | Shared pure assertions/orchestration        | Applied Prisma transaction adapter    |
| Assessment room       | Shared interview protocol and UI            | Applied plan builder and rubric       |
| Finalization protocol | Shared transcript/checkpoint structure      | Applied evaluator and persistence     |
| Ranking               | Algorithm shape may be shared through ports | Signals, weights, gates, catalogue    |
| Persistence           | Transaction patterns and interfaces         | Applied models and snapshots          |
| Content               | Publication protocol only                   | Incidents, questions, answers, tests  |

Do not force Prisma into one generic table during this parity change. The existing separate Applied
tables preserve ownership, history, and rollout safety. A data-model unification would be a separate
migration project and is not required to eliminate UI or room duplication.

## 9. Core behavior that must be corrected before reuse

Do not generalize known defects into the shared layer.

### 9.1 End-of-curriculum outcome

Core currently assumes every completed assessment has a `nextStory`. Its evaluator calls
`rankNextStory()` unconditionally, while the current catalogue has only two paths. After the second
path there is no unused candidate, so finalization can remain stuck in `FINALIZING`.

Define a neutral continuation decision before extracting report UI:

```ts
type StoryPracticeContinuationDecision<TNext> =
  | { kind: "continue"; next: TNext }
  | { kind: "ready"; masteredKeys: string[]; summary: string }
  | { kind: "complete"; summary: string };
```

Applied Engineering must support the same terminal outcome. A report must not require a next
incident when there is no material eligible gap.

### 9.2 Count-aware copy

Core's solved-mastery note currently contains an eight-question sentence even for new six-question
blocks. Shared report copy must derive the count from the frozen block.

### 9.3 Exact fallback compatibility

Before sharing fallback orchestration, require an exact match for path/incident key, version,
technology/runtime/framework compatibility, and difficulty. A generic Node artifact must not be
labelled as technology-specific merely because it can execute on Node.js.

## 10. Implementation sequence

Implement in small, independently tested steps.

### Step 1 — Freeze parity contracts

Status: Complete on 2026-09-11.

Implemented as an additive, backward-compatible contract slice. Core and Applied now explicitly
declare the shared voice-room mode and evidence label, Architecture explicitly retains its current
inline mode, and the shared server contracts define the neutral durable assessment identity and
terminal continuation decision. Runtime migration begins in Step 5; legacy Core identity behavior
is intentionally unchanged until then.

- Add the missing capability fields to shared UI contracts.
- Add the neutral assessment identity and continuation outcome.
- Add contract tests for Core and Applied adapters.
- Do not change rendered behavior yet.

### Step 2 — Move shared UI ownership

Status: Complete on 2026-09-11.

The preparation gate, intro, overview/library, question workspace, assessment surface, learning
guide, and presentation helpers now live under `practice/shared/ui`. Existing Core UI filenames are
thin compatibility wrappers containing only Core configuration, so routes and tests keep their
stable imports. Applied and Architecture wrappers consume those same shared implementations. The
legacy Core-only room-launch check is deliberately retained until Step 5; this keeps rendered and
navigation behavior unchanged while Applied's room runtime is not yet registered.

- Move component implementations from Core UI into neutral shared UI files.
- Leave thin Core compatibility exports.
- Keep Applied wrappers thin.
- Prove snapshots, accessibility queries, and responsive classes remain unchanged.

### Step 3 — Share technology welcome

Status: Complete on 2026-09-11.

Core and Applied now use `story-practice-technology-welcome.tsx` for the identical teacher stage,
avatar feathering, responsive layout, voice lifecycle, pending states, errors, and replay-safe
preparation. Domain wrappers provide only reviewed options, copy, and separate confirmation and
preparation payload builders. Applied currently offers JavaScript because that is the only stack
accepted by its server contract and backed by reviewed executable incidents.

- Extract Core's polished welcome as a configured shared component.
- Provide Core and Applied options/copy/payload builders.
- Preserve teacher voice, avatar feathering, mobile layout, pending states, errors, and idempotency.

### Step 4 — Match library behavior

Status: Complete on 2026-09-11.

Applied eligibility now exposes reviewed incident stages as library question rows. The new
owner-scoped `start-path` route selects the requested published incident server-side, copies its
exact reviewed snapshot, and publishes it as a non-current library block. Continuing later
promotes a matching loose block in place, retaining question progress and making its assessment
ready immediately when all eight saved questions are already terminal.

- Configure Applied's unstarted-row endpoint.
- Add exact reviewed incident materialization without live AI.
- Preserve the current incident and reuse loose-path progress during promotion.

### Step 5 — Extract the voice assessment protocol

Status: Complete on 2026-09-11.

Core and Applied now resolve through one neutral, durable story-practice assessment identity. The
interview service, decider, technical evaluator, resumability checks, voice client, assessment
workspace, completion handoff, and server-only interviewer guide all use that shared protocol.
Opening, transition, teaching, and closing behavior is selected by practice configuration, so
Applied uses production-specific language without copying the room. Existing Core sessions remain
readable through a compatibility resolver, including older sessions that predate version fields.

- Generalize interview identity checks and resumable-block helpers.
- Extract neutral opening/transition/teaching/closing behavior.
- Replace slug checks in the assessment UI and voice client with capabilities.
- Keep old Core sessions compatible.

### Step 6 — Add Applied assessment runtime

Status: Complete on 2026-09-11.

A shared replay-safe runtime coordinator now owns assessment start, frozen-record loading, reserved
session validation, and room creation. Thin Core and Applied adapters supply their own snapshot
parser, identity, presentation labels, and five-question plan. Applied assessment start now returns
the durable assessment UUID as the room session ID with `{ assessment, sessionId, created }`, and
the shared assessment surface opens the same voice room used by Core. Private expected answers and
rubrics remain only in the persisted server plan and are omitted by the interview API serializer.
Transcript-to-report finalization remains intentionally scoped to Step 7.

- Build a five-question room plan from the frozen Applied snapshot.
- Register `AppliedEngineeringAssessmentRuntimeService` in the app container.
- Make Applied assessment start return `{ assessment, sessionId, created }`.
- Redirect the Applied assessment page to the shared interview room.

### Step 7 — Add Applied transcript finalization and recovery

Status: Complete on 2026-09-11.

Core and Applied now share one bounded transcript-to-response helper that groups durable candidate
turns by frozen prompt index. Applied validates the owned room and neutral assessment identity,
requires the room to be complete, replays the room UUID as its finalization request ID, and invokes
its existing five-score evaluator and atomic report transaction. Both interview completion paths
schedule the Applied finalizer, while overview load recovers completed rooms and checkpointed
`FINALIZING` submissions without repeating the interview.

- Convert owned room turns to the five Applied response IDs.
- Trigger deferred finalization after the final answer.
- Recover on Applied overview load.
- Keep failures retryable without repeating the interview.

### Step 8 — Add readiness and continuation parity

Status: Complete on 2026-09-11.

Core and Applied reports now add an explicit continuation decision while remaining compatible with
saved reports that contain only `nextStory` or `nextIncident`. Ranking returns a next reviewed item
when one exists; otherwise evaluation records either evidence-backed readiness or clean curriculum
completion instead of throwing and leaving the assessment in `FINALIZING`. Shared report UI renders
the terminal outcome without a phantom Continue action, and existing loose-block promotion retains
question attempts, runs, hints, and completion state. Mastery copy now derives its question count
from the frozen block.

- Return either a next incident or a terminal readiness/completion result.
- Promote a prepared incident without losing progress.
- Keep historical reports read-only.
- Never leave the last available incident permanently finalizing.

### Step 9 — Polish and release verification

Status: Automated gate complete on 2026-09-11; authenticated manual verification blocked.

Core and Applied now have durable render-parity coverage for the shared responsive technology
welcome, overview, and all assessment states: locked, ready, in progress, finalizing, and completed.
The checks assert matching structural geometry, mobile-visible teacher placement, labelled
landmarks, progress semantics, keyboard-sized controls, and visible focus treatment. This pass
found and fixed missing focus rings on the shared ready/retry assessment controls and allowed the
portrait quality already requested by the shared and DSA assessment cards in the central Next.js
image configuration. Interview response serialization is directly tested to exclude the private
answer guide and rubric.

The five focused regression groups passed with 87 files / 468 tests after the new parity cases;
the final repository run passed with 233 files / 1,391 tests (2 files / 8 tests skipped). Scoped
ESLint, Prisma validation, Vercel function-count verification, the production Next.js build, and
`git diff --check` pass. Repository-wide `tsc --noEmit` still reports only the two pre-existing
tuple/undefined errors in `src/app/api/help/[...path]/route.test.ts:49`.

The local app loads with content and no framework error overlay, and the stored Trailgrad account
reaches Clerk's Google OAuth callback. Clerk then requires a Cloudflare human-verification
challenge, which automated browser tooling must not bypass. Consequently the authenticated
desktop/mobile screenshots and the real LiveKit microphone, typed fallback, Save & exit, resume,
and completion exercise remain a manual release gate. Evidence of the boundary is saved at
`artifacts/applied-engineering-step9/authentication-blocker.png`.

- Compare Core and Applied desktop/mobile screenshots for every state.
- Run keyboard and screen-reader checks.
- Verify no private guide enters an interview API response.
- Run Core, Applied, shared UI, shared server, interview, and Practice regressions.

## 11. File-level implementation map

Primary Core sources to extract from:

```text
src/features/practice/core-technical/ui/core-technical-technology-welcome.tsx
src/features/practice/core-technical/ui/core-technical-intro.tsx
src/features/practice/core-technical/ui/core-technical-overview.tsx
src/features/practice/core-technical/ui/core-technical-question-workspace.tsx
src/features/practice/core-technical/ui/core-technical-assessment.tsx
src/features/practice/core-technical/server/assessment-runtime.service.ts
src/features/practice/core-technical/server/assessment.service.ts
src/features/interviews/server/core-technical-assessment-dialogue.ts
```

Existing neutral/shared surfaces to improve:

```text
src/features/practice/shared/ui/contracts.ts
src/features/practice/shared/ui/view-contracts.ts
src/features/practice/shared/ui/story-practice-*.tsx
src/features/practice/shared/server/contracts.ts
src/features/practice/shared/server/assessment-orchestrator.ts
src/features/practice/shared/server/continuation-orchestrator.ts
src/features/practice/shared/server/preparation-orchestrator.ts
src/features/practice/shared/server/practice-orchestrator.ts
src/features/practice/shared/server/route-kit.ts
```

Applied integration points:

```text
src/app/practice/applied-engineering/page.tsx
src/app/practice/applied-engineering/assessment/[assessmentId]/page.tsx
src/app/api/practice/applied-engineering/assessment/start/handler.ts
src/app/api/practice/applied-engineering/assessment/finalize/handler.ts
src/app/api/practice/applied-engineering/start-path/handler.ts
src/features/practice/applied-engineering/ui/applied-engineering-experience.ts
src/features/practice/applied-engineering/ui/applied-engineering-adapter.ts
src/features/practice/applied-engineering/server/assessment-runtime.service.ts
src/features/practice/applied-engineering/server/assessment.service.ts
src/features/practice/applied-engineering/server/assessment-blueprint.ts
src/features/practice/applied-engineering/server/assessment-evaluator.ts
src/features/practice/applied-engineering/server/preparation.service.ts
src/features/practice/applied-engineering/server/continuation.service.ts
src/server/app-container.ts
```

Some listed Applied files do not exist yet; create them only in the relevant step.

Shared interview integration points:

```text
src/features/interviews/server/types.ts
src/features/interviews/server/interview.service.ts
src/features/interviews/server/decider.ts
src/features/interviews/server/state-machine.ts
src/features/interviews/server/voice-connection-policy.ts
src/features/interviews/ui/voice/voice-interview-client.tsx
src/features/interviews/ui/voice/components/block-assessment-review-workspace.tsx
src/features/interviews/ui/voice/components/session-state.tsx
src/app/api/interview/[sessionId]/route.ts
src/app/api/interview/decide/route.ts
```

## 12. Acceptance criteria

1. Core and Applied render the same component implementation for equivalent states.
2. Desktop and mobile geometry, styling, transitions, teacher placement, and controls match.
3. Applied first entry uses the polished technology welcome and sends only the selected technology.
4. Applied library cards and question rows behave exactly like Core, including loose-path progress.
5. Applied questions retain production-focused content, evidence, feedback, and scoring.
6. Only the current Applied incident can unlock or run its assessment.
7. Applied assessment opens the shared DSA/Core live room without another setup form.
8. The teacher speaks five frozen prompts, may ask one grounded follow-up, and teaches between them.
9. Voice and typed responses persist in the same durable transcript.
10. Save & exit resumes the exact room without submitting partial work.
11. Completion produces the Applied five-score report and safely returns to the Applied block.
12. Interrupted finalization is recoverable without repeating the assessment.
13. Reports can recommend a next incident or end preparation cleanly.
14. No expected answer, rubric, hidden test, reference repair, or model-only context enters a public
    API response before authorization.
15. Existing Core, DSA, and saved-session behavior remains compatible.

## 13. Required tests

At minimum, future agents should add or update tests for:

- Core and Applied experience configuration;
- normalized block/question/assessment adapters;
- shared welcome behavior and request replay;
- current/loose/historical library behavior;
- exact reviewed incident materialization;
- neutral assessment identity and legacy Core identity compatibility;
- Applied assessment plan mapping and private-guide omission;
- opening, one follow-up, teaching transition, and closing dialogue;
- voice and typed answers;
- Save & exit and session resume;
- transcript-to-response mapping;
- deferred finalization and overview recovery;
- final incident with no next candidate;
- owner isolation and foreign assessment/session rejection;
- Core and Applied assessment/report UI regressions;
- mobile teacher visibility and question-panel evidence rendering.

Recommended verification commands after the relevant tests exist:

```bash
pnpm exec vitest run src/features/practice/shared
pnpm exec vitest run src/features/practice/core-technical
pnpm exec vitest run src/features/practice/applied-engineering
pnpm exec vitest run src/features/interviews/server src/features/interviews/ui/voice
pnpm exec vitest run src/app/practice/core-technical src/app/practice/applied-engineering
pnpm exec eslint src/features/practice/shared src/features/practice/core-technical src/features/practice/applied-engineering src/features/interviews
pnpm exec tsc --noEmit
```

If the repository-wide TypeScript check fails in an unrelated file, record the exact existing
failure and still run focused lint/tests for every changed surface.

## 14. Rules for future agents

Before editing:

1. Read this document completely.
2. Read `docs/CORE_TECHNICAL_PERSONALIZED_PATH_REQUIREMENTS.md` completely.
3. Read the UI baseline and the relevant sections of the Applied requirements.
4. Inspect `git status` and preserve all existing user changes.
5. Trace the current Core implementation for the one step being implemented.
6. Trace the matching Applied service and its nearest tests.
7. State which step is being implemented and which tests will prove it.

While editing:

- implement one numbered step at a time;
- extract stable behavior instead of copying Core files and renaming symbols;
- keep shared code domain-neutral;
- keep private domain data behind the correct service and serializer;
- make migrations additive and backward compatible;
- do not redesign DSA or alter its behavior to make extraction easier;
- do not combine Core and Applied persistence tables during this work;
- do not mark parity complete based only on unit tests—verify rendered desktop and mobile states.

When handing off:

- include current `git status`;
- list files changed by the parity work;
- list tests run and their exact results;
- name the next unfinished numbered step;
- record known failures and whether they predate the work;
- state whether screenshots and manual voice-room verification were completed.

## 15. Ready-to-use implementation prompt

```text
Implement the next unfinished step from
docs/APPLIED_ENGINEERING_CORE_PARITY_REUSE_PLAN.md.

Read that document completely, then read
docs/CORE_TECHNICAL_PERSONALIZED_PATH_REQUIREMENTS.md,
docs/CORE_TECHNICAL_UI_BASELINE.md, and the relevant sections of
docs/STORY_DRIVEN_APPLIED_ENGINEERING.md.

Applied Engineering must use the exact same shared UI and live assessment-room implementation as
Core Technical. Differences belong in typed experience configuration, domain adapters, reviewed
content, scoring, ranking, and separate persistence—not in duplicated UI or conversation state
machines.

Before editing, inspect git status, preserve existing user changes, identify the numbered step,
list the Core source behavior being extracted, list the Applied integration points, and name the
tests that will prove parity. Implement only that step and any minimal prerequisite needed for it to
compile. Run focused Core, Applied, shared, and interview regressions before handing off.
```
