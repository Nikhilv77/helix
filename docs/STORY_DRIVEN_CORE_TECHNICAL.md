# Story-Driven Core Technical: Build Plan

## Goal

Ship one complete Core Technical loop:

```text
Initial assessment + resume + target
        → confirm stack
        → personalized 8-question story
        → block assessment
        → report
        → next adaptive story
```

Shared rules live in
[STORY_DRIVEN_ADAPTIVE_PRACTICE.md](./STORY_DRIVEN_ADAPTIVE_PRACTICE.md). Do not implement the
older [CORE_TECHNICAL_ADAPTIVE_PRACTICE.md](./CORE_TECHNICAL_ADAPTIVE_PRACTICE.md); it describes
the removed fixed-bank flow.

## Product decisions

- Build Core Technical only. Do not build Applied Engineering or Architecture.
- Do not change DSA.
- Prove the first vertical slice with JavaScript/Node.js 22 for backend/full-stack candidates.
- Publish two stories so the first assessment can lead to a real second block.
- Every block has exactly eight frozen questions and one assessment.
- Candidate-confirmed stack is a hard gate. Never substitute another language.
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
2. The candidate confirms role, language, runtime, framework, and exclusions.
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

### PR 5 — Plug the engines into the existing DSA design

- Reuse the DSA shell and components; add no new visual style.
- Add the card, page, eight workspaces, drafts, hints, attempts, Learn, feedback, and code runs.
- Pass desktop/mobile DSA comparison, refresh, navigation, keyboard, and screen-reader checks.

### PR 6 — Assessment and adaptation

- Freeze assessment after eight terminal questions.
- Add idempotent start/resume/finalize and evidence-backed report.
- Keep the report selected until Continue.
- Select the second story from verified assessment/Practice evidence.
- Add continuation retry, immutable history, report, and transcript.

### PR 7 — Release

- Run tests, type check, lint, Prisma validation, production build, authenticated browser flow,
  and private-payload inspection.
- Enable only for validated stacks.

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
