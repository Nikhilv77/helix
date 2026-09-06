# Story-Driven Adaptive Practice

## Status and authority

This document is the product requirement, architecture specification, UI handoff, migration
plan, and acceptance checklist for rebuilding every **non-DSA Practice** experience around
real-world stories and candidate-specific frozen question blocks.

This document is intentionally detailed. A future engineer or agent should be able to read it
without relying on the conversation that produced it.

The decisions in this document are:

1. Preserve the existing DSA product, DSA question bank, DSA routes, DSA persistence, DSA
   assessment lifecycle, and DSA history.
2. Use the DSA Practice page as the visual, interaction, hierarchy, accessibility, and lifecycle
   reference for the replacement.
3. Retire and remove the current non-DSA Practice implementations after the replacement is
   verified. Do not run both old and new non-DSA engines indefinitely.
4. Preserve historical database records and immutable snapshots. Removing an implementation
   does not authorize hard-deleting candidate history.
5. Author a small, carefully ordered catalogue of real-world **stories**. Do not manually author
   enormous question banks for every language, framework, role, and specialization.
6. Generate only the next eight-question Practice block when its story unlocks. Generate the
   question, hints, brief answer, private rubric, sources, and executable contract as one versioned
   bundle, validate it, and then freeze it.
7. Keep the user experience simple. Candidates see a current story, eight questions, an
   assessment, results, and the next story. They do not see question-bank sizes, content-module
   registries, generation internals, or “not ready” product cards.

Until the replacement passes its acceptance gates, this is a specification rather than a claim
that the story-driven product is already implemented.

## One-sentence product definition

> Practice is a sequence of interview-relevant, real-world stories; each unlocked story becomes
> one frozen block of eight questions tailored to the candidate's confirmed role, stack, level,
> resume, target job, prior evidence, and selected teacher.

## Why this rebuild exists

The current non-DSA design grew around static session catalogues and technology-specific banks.
That creates a combinatorial problem. A candidate may use Java, Go, Python, Rust, JavaScript,
Ruby, C++, or another language; a frontend candidate may use React, Vue, Angular, or another
framework; and an AI/ML candidate may be preparing for data science, applied AI, ML engineering,
research engineering, or ML platform work.

Manually pre-authoring a complete bank for every possible combination is not sustainable.
Falling back to another language is incorrect. Displaying a visible “not ready” session is poor
product behaviour. Calling every candidate full stack only hides the mismatch.

The replacement therefore makes the **story and its evidence goals** the authored curriculum.
The eight questions are generated or retrieved only after the candidate context and story are
known. The block remains structured and durable like DSA, without requiring a course-sized bank
for every technology.

## What this product is not

The replacement must not become:

- a mandatory course with hundreds of visible lessons;
- a catalogue of language tracks that the candidate has to understand or configure;
- a list of every question stored in the database;
- an unbounded chat where a model invents arbitrary questions;
- a certification exam claiming more certainty than its evidence supports;
- a generic system-design interview disguised as Core Technical Practice;
- DSA with different nouns;
- a page that substitutes an unrelated language when exact content is missing; or
- a reason to rewrite or destabilize the working DSA product.

## Candidate-facing experience

The entire experience should be understandable without documentation.

### First visit

1. The candidate opens Practice.
2. DSA continues to appear exactly as it does today.
3. The released story-driven Practice session appears as one clear session card.
4. The card is based on the candidate's preparation target. It must not advertise a raw bank
   size.
5. Opening the session shows a short suggested focus derived from the resume and target job.
6. The candidate confirms or edits that focus using a small number of plain-language controls.
7. The first story block is prepared in the background and frozen.

Example confirmation copy for a Java backend candidate:

> **Suggested focus: Java backend**  
> Java 21, JVM, Spring Boot, PostgreSQL, Kafka, concurrency, and production reliability.

The candidate can remove Kafka, change the framework, or change the target. Resume analysis is a
recommendation; it is never an irreversible decision.

### Normal return visit

The candidate sees, in this order:

1. Back to Practice.
2. A DSA-style introduction/current-focus hero.
3. The current eight-question story block.
4. The assessment card directly beneath the eight questions.
5. The story path beneath the current block.
6. Previous and next block navigation when history exists.
7. A small sticky coaching card on wide screens, matching the DSA page hierarchy.

### Completion loop

```text
Confirm preparation focus
          ↓
Unlock one real-world story
          ↓
Generate, validate, and freeze eight questions
          ↓
Complete, learn, or retry the eight questions
          ↓
Complete the story assessment
          ↓
See the report and the reason for the next recommendation
          ↓
Unlock and prepare the next story
```

The completed result must remain visible until the candidate explicitly chooses to continue. A
new block must never replace a report before that handoff.

## The central distinction: authored story, tailored questions

The product authors and reviews the story definition once. The system tailors the questions for
the candidate.

Consider the story **Peak Traffic**:

> The product works normally during development, but latency and failures rise sharply during
> peak traffic.

The story is reusable. The questions are not technology-neutral:

| Candidate | The story focuses on |
| --- | --- |
| Java backend | JVM/Spring request execution, executors, database pools, timeouts, rejection, and observability |
| Go backend | Goroutines, channels, HTTP handlers, context cancellation, connection pools, and goroutine growth |
| Python backend | Python runtime constraints, async execution, worker configuration, database pools, and timeouts |
| Frontend | Request waterfalls, browser main-thread work, rendering, duplicate fetching, caching, and real-user metrics |
| Full stack | The confirmed frontend/backend boundary, request lifecycle, duplicated work, API pressure, and end-to-end evidence |
| AI/ML | Inference queues, batching, CPU/GPU pressure, model lifecycle, fallback behaviour, and prediction latency |

There is no universal question fallback. The story is the universal narrative envelope; every
delivered question must be compatible with the confirmed candidate context.

## Candidate focus contract

### Inputs

The focus suggestion may use:

- target role and role specialization;
- target seniority;
- resume skills, projects, and experience;
- target job description;
- interview timeline;
- candidate-confirmed language, runtime, frameworks, libraries, databases, and infrastructure;
- onboarding baseline signals; and
- verified Practice and assessment evidence.

### Confirmation rule

No technology becomes a hard question constraint merely because it appears somewhere in the
resume. The candidate must confirm the focus before the first block is prepared.

The confirmation UI should ask only what affects question correctness:

- “Which interview are you preparing for?”
- “Which language/runtime should coding questions use?”
- “Which frameworks or libraries should we include?”
- “Anything important to exclude?”

Do not expose internal names such as `trackKey`, `ecosystem`, `question bank`, or `compatibility
pool`.

### Data-driven values

Do not encode the supported world as a permanent TypeScript union such as:

```ts
type Language = "javascript" | "python" | "java" | "cpp";
```

Persist normalized string identifiers backed by a versioned registry. Aliases such as `golang`
and `go` may normalize to one identifier, but the candidate-facing label remains human-readable.

```ts
interface ConfirmedPracticeFocus {
  schemaVersion: number;
  roleFamily: string;
  specialization: string | null;
  seniority: string;
  language: string | null;
  runtime: string | null;
  runtimeVersion: string | null;
  frameworks: string[];
  libraries: string[];
  databases: string[];
  infrastructure: string[];
  excludedTechnologies: string[];
  resumeFingerprint: string | null;
  targetJobFingerprint: string | null;
  confirmedAt: string;
}
```

Freeze this focus into every block. Later profile changes affect future blocks only.

### AI/ML is a specialization, not a single technology

AI/ML may remain in the product without requiring hundreds of initial questions. Its confirmed
specialization determines the story interpretation:

| Specialization | Typical evidence areas |
| --- | --- |
| Data scientist | Statistics, experimentation, leakage, metrics, model selection, and communication |
| ML engineer | Data pipelines, training, evaluation, inference, deployment, monitoring, and reliability |
| Applied AI/LLM engineer | Retrieval, grounding, evaluation, inference, safety, latency, and cost |
| Research engineer | Model behaviour, optimization, experiment correctness, distributed training, and reproducibility |
| ML platform engineer | Pipelines, orchestration, model serving, resource control, observability, and rollout |

The confirmation screen should recommend one specialization and allow the candidate to change
it. Do not silently treat every AI/ML candidate as a Python backend engineer.

## Story catalogue

### What is authored upfront

A story is a versioned generation and evaluation contract, not eight prewritten questions.

```ts
interface PracticeStoryDefinition {
  schemaVersion: number;
  key: string;
  version: number;
  title: string;
  shortDescription: string;
  openingSituation: string;
  applicableRoleFamilies: string[];
  applicableSpecializations: string[];
  tier: "foundation" | "intermediate" | "advanced";
  prerequisiteStoryKeys: string[];
  competencies: StoryCompetencyTarget[];
  questionSlots: EightQuestionBlueprint;
  interviewPatternKeys: string[];
  sourcePolicyKey: string;
  assessmentBlueprintKey: string;
  estimatedPracticeMinutes: number;
  publicationStatus: "draft" | "review" | "published" | "retired";
}
```

Every published story must define:

- the realistic problem being experienced;
- why interviewers care about it;
- which roles and specializations it applies to;
- the mechanisms it may test;
- the evidence each of the eight slots must collect;
- how foundation, intermediate, and advanced variants differ;
- which topics are forbidden because they belong to another session;
- which interview patterns may be used;
- authoritative source requirements;
- generation constraints;
- assessment transfer requirements; and
- editorial owner, review date, and version.

### Initial cross-role story spine

These are story families, not a promise that every role receives identical questions:

#### Foundation

1. Follow one request or operation from input to result.
2. A page, endpoint, job, or inference request becomes slow.
3. Invalid or unexpected input reaches the application.
4. An operation fails halfway through.

#### Intermediate

5. Peak traffic saturates a limited resource.
6. Duplicate requests or events create duplicate work.
7. Concurrent work corrupts state or produces inconsistent results.
8. Cached or derived data becomes stale.
9. A dependency becomes slow or unavailable.
10. Memory, handles, workers, listeners, or another resource continuously grows.

#### Advanced

11. Retries amplify an outage.
12. A release introduces a regression.
13. Data becomes inconsistent across a boundary.
14. Background processing falls behind.
15. A trust or tenant boundary is violated.
16. The system fails without enough diagnostic evidence.

### Initial AI/ML story variants

AI/ML reuses the same engine and eight-slot schema. It may define specialized stories where a
generic software story is insufficient:

1. Offline evaluation looks strong but production quality is poor.
2. Training data contains leakage.
3. Inference becomes slow under traffic.
4. Model quality degrades over time.
5. Training or feature pipelines produce inconsistent results.
6. A new model version creates a regression.
7. Results cannot be reproduced or explained.
8. A retrieval/LLM system returns unsupported answers.
9. Compute or memory consumption becomes excessive.
10. Monitoring captures latency but misses model quality.

Only the story definitions and their contracts are authored initially. The system generates the
eight candidate-specific questions when the story unlocks.

## Story ordering, difficulty, and unlocking

### Progression lock versus availability failure

The UI may show a story as locked because the candidate must complete the current block and its
assessment first. That is healthy progression.

The UI must not show a session card that opens to “this content is not ready.” Content-generation
or infrastructure failures are operational failures and must be retried or recovered; they are
not candidate-facing curriculum states.

### Unlock rule

A story becomes eligible when:

1. all prerequisite stories are assessed or explicitly bypassed by a documented placement rule;
2. the previous current block has a terminal assessment report;
3. the story applies to the confirmed role/specialization;
4. the system can prepare a complete valid eight-question block; and
5. no other current story block exists for the same session.

Completion unlocks progression; a passing threshold does not. Scores determine what is
reinforced next, not whether the candidate is allowed to continue.

### Adaptive choice

When several stories are eligible, rank them using:

- prerequisite order;
- target-job importance;
- unresolved competency weaknesses;
- interview frequency and importance;
- seniority calibration;
- recency/cooldown of similar concepts; and
- deliberate coverage breadth.

The result must include a human-readable reason:

> Peak Traffic is next because the last assessment showed weak concurrency and cleanup evidence,
> and the target role emphasizes high-throughput Java services.

### Difficulty

Difficulty is controlled by constraints and reasoning depth, not by making prompts vague or long.

- **Foundation:** one mechanism, visible evidence, bounded scope, guided constraints.
- **Intermediate:** interacting mechanisms, incomplete evidence, meaningful trade-offs.
- **Advanced:** ambiguity that must be clarified, partial failure, concurrency, operational limits,
  and competing trade-offs.

The first block may use baseline evidence. Every later block must use persisted Practice and
assessment evidence.

## The exact eight-question blueprint

Every story block contains exactly eight questions and covers all required Practice formats.

| Slot | Candidate-facing label | Required format | Evidence goal | Typical difficulty | Target time |
| ---: | --- | --- | --- | --- | ---: |
| 1 | Spot the signal | MCQ | Recognize the first important mechanism or diagnostic direction | Easy | 2–3 min |
| 2 | Predict what happens | Predict and explain | Trace execution, state, data, or system behaviour | Easy–medium | 4–5 min |
| 3 | Explain the mechanism | Written explanation | Explain why the behaviour occurs and name the relevant boundary | Medium | 4–5 min |
| 4 | Defend your reasoning | Spoken explanation, with typed accessibility alternative | Communicate and defend the mechanism like a real interview | Medium | 4–5 min |
| 5 | Read the evidence | Artifact diagnosis | Interpret logs, metrics, traces, outputs, request timelines, or data samples | Medium | 5–6 min |
| 6 | Repair the defect | Debug and repair | Locate and correct a realistic bug while preserving the contract | Medium–hard | 7–9 min |
| 7 | Build the critical piece | Micro-implementation | Implement one small production-relevant mechanism | Hard | 9–12 min |
| 8 | Prove it in production | Written/spoken production decision | Test, monitor, roll out, and discuss alternatives and consequences | Hard | 5–7 min |

An honest eight-question block is approximately 40–50 minutes. Do not advertise 20–30 minutes
when the block includes diagnosis, debugging, and implementation.

### Slot invariants

1. All eight questions advance one coherent story.
2. Narrative continuity must not make Question 5 impossible because the candidate answered
   Question 4 incorrectly. Later artifacts are frozen, not dynamically corrupted by prior
   answers.
3. At least one question produces executable evidence when an exact safe runner is available.
4. Debugging and implementation must remain small enough for interview Practice, not complete
   applications.
5. The two code questions must test different evidence: one repair and one construction.
6. No two questions may test the same concept using cosmetic wording changes.
7. Question 8 must connect the technical work to verification and operational consequences.
8. The block must have a deliberate difficulty curve; generation may not return eight medium
   questions merely because they are easier to produce.

### Example: Peak Traffic for Java/Spring

1. Identify the most plausible signal of request-thread saturation.
2. Predict the behaviour of a bounded executor when its queue is full.
3. Explain the relationship between request threads and database connections.
4. Defend queueing, rejection, backpressure, or load-shedding choices.
5. Interpret latency, executor, connection-pool, and error metrics.
6. Repair code that creates unbounded concurrent work or fails to cancel it.
7. Implement a bounded operation with timeout and cleanup behaviour.
8. Describe load testing, monitoring, gradual rollout, and rollback.

The equivalent Go block uses goroutines, channels, contexts, and Go HTTP behaviour. The
equivalent AI/ML block uses inference queues, batching, compute pressure, model lifecycle, and
quality/latency evidence. Do not translate syntax mechanically; regenerate against the correct
runtime mechanisms.

## Interview relevance and question importance

### Do not claim unverifiable verbatim provenance

Public interview reports are noisy, company processes change, and copying leaked or proprietary
questions is unacceptable. The product should promise **interview-proven patterns**, not claim
that every generated sentence was asked verbatim at a named company.

### Interview pattern catalogue

Maintain a smaller reviewed catalogue of normalized patterns:

```ts
interface InterviewPattern {
  key: string;
  version: number;
  title: string;
  roles: string[];
  specializations: string[];
  seniority: string[];
  competencies: string[];
  formats: QuestionFormat[];
  interviewEvidence: InterviewEvidenceReference[];
  technicalSources: TechnicalSourceReference[];
  importance: "essential" | "high" | "supporting";
  lastReviewedAt: string;
  publicationStatus: "draft" | "review" | "published" | "retired";
}
```

A pattern may be published only when it has:

- at least two independent public interview reports; or
- one authoritative public hiring/interview guide plus recurring independent evidence;
- official or primary technical documentation supporting the expected answer;
- a clear role and seniority fit;
- an editor-confirmed reason that the mechanism matters in real work; and
- no copied proprietary wording.

Generated questions must reference one or more published pattern keys. The model cannot invent
an underlying interview topic merely because it sounds plausible.

### Selection hard gates

Reject a candidate question unless all of these are true:

- exact confirmed role/specialization compatibility;
- exact language/runtime compatibility when the question depends on them;
- confirmed framework/library compatibility when required;
- applicable runtime/tool version;
- published interview-pattern provenance;
- authoritative technical sources;
- one unambiguous evaluation contract;
- suitable time and scope for its slot;
- no duplicate or near-duplicate in current/recent blocks;
- no private-answer leakage; and
- executable verification when deterministic correctness is claimed.

### Ranking after hard gates

Use an explicit, versioned ranking policy. A reasonable starting point is:

| Signal | Weight |
| --- | ---: |
| Interview evidence and importance | 30% |
| Target-role and job-description relevance | 25% |
| Story objective and planned coverage | 15% |
| Strength of practical evidence produced | 15% |
| Candidate's demonstrated weakness | 10% |
| Novelty and repeat avoidance | 5% |

Compatibility, correctness, privacy, and difficulty are hard gates, not weighted preferences.

## Question generation contract

### Generation input

The generator receives only the minimum server-side context required:

- immutable confirmed-focus snapshot;
- story key/version and opening situation;
- current question-slot contract;
- permitted interview-pattern records;
- permitted authoritative source excerpts/references;
- sanitized resume/project descriptors;
- target-job competency summary;
- prior competency evidence, without private transcripts unless explicitly required;
- difficulty and time limit;
- recent concept keys for cooldown; and
- generator, evaluator, and runtime versions.

Do not send a raw resume to an external generator when a minimized, sanitized context is enough.

### Generate more than one candidate

For each slot, generate multiple candidates, then use an independent critic and deterministic
validators to choose or reject them. Do not accept the first model response automatically.

### Generate one complete bundle

The question and its teaching/evaluation material must be generated and versioned together:

```ts
interface GeneratedStoryQuestionBundle {
  schemaVersion: number;
  id: string;
  contentVersion: number;
  storyKey: string;
  storyVersion: number;
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  conceptKeys: string[];
  interviewPatternKeys: string[];
  format: QuestionFormat;
  difficulty: "easy" | "medium" | "hard";
  expectedMinutes: number;
  compatibility: QuestionCompatibility;
  publicContent: PublicQuestionContent;
  coaching: FrozenCoachingContent;
  privateEvaluation: PrivateEvaluationContract;
  sources: FrozenSourceReference[];
  generatorVersion: string;
  evaluatorVersion: string;
  runtimeVersion: string | null;
  contentFingerprint: string;
}
```

Generating these fields separately risks a hint, answer, rubric, or hidden test that no longer
matches the prompt.

### Public question content

The browser may receive:

- title and story stage;
- prompt and sanitized candidate framing;
- code starter or safe evidence artifact;
- constraints and examples;
- public tests;
- estimated time;
- already revealed hints;
- saved candidate work;
- public run output; and
- authorized post-attempt coaching/answer fields.

### Private evaluation content

The browser must never receive, before or after answer reveal unless explicitly transformed into
an authorized public explanation:

- raw answer keys;
- scoring rubrics;
- hidden tests;
- reference implementation used for grading;
- evaluator prompts;
- planted-defect maps;
- accepted-fix lists;
- private expected output;
- model chain-of-thought or raw traces;
- private source excerpts; or
- another candidate's content or evidence.

## Validation and publication pipeline

No generated question is candidate-visible until the complete eight-question block passes.

### 1. Schema validation

- Parse all generated fields with strict schemas.
- Reject unknown formats, oversized content, missing hints, missing brief answers, and incomplete
  compatibility metadata.
- Require stable story, slot, concept, source, generator, evaluator, and runtime identifiers.

### 2. Relevance validation

- Confirm that the question tests the assigned story stage and slot.
- Confirm exact role, specialization, seniority, language, runtime, and framework applicability.
- Reject trivia, generic motivational prompts, and questions that belong in DSA.
- Enforce boundaries between Core Technical, Applied Engineering, and Architecture.

### 3. Technical validation

- Verify factual claims against authoritative sources.
- Use an independent critic to look for ambiguity, missing assumptions, disputed behaviour, and
  version mismatches.
- Require the brief answer to address every requested part of the prompt.
- Require rubric signals to be observable in a candidate response.

### 4. Code validation

For executable repair or implementation:

1. resolve an exact sandbox runner and version;
2. compile or parse the starter;
3. prove that the starter fails for the intended reason;
4. compile/run the reference implementation;
5. prove that it passes every public test;
6. prove that it passes every hidden test;
7. check timeout, memory, output, filesystem, and network limits;
8. confirm the harness distinguishes common wrong solutions; and
9. store code fingerprints and runner versions.

Never execute candidate or generated code in the application host process.

Use a data-driven runner registry so Java, Go, Python, JavaScript, and future languages can be
added without redesigning the block lifecycle. Framework-dependent repository tasks belong to
Applied Engineering and require a separate repository sandbox contract.

### 5. Hint and answer alignment

- Each hint must help with the current prompt.
- Hint 1 must not reveal the answer.
- Hint 2 may name the mechanism but not the complete fix.
- Hint 3 may provide the approach but not paste the final response/reference implementation.
- The brief answer must be complete, concise, technically correct, and consistent with tests.

### 6. Privacy and serialization validation

- Run explicit forbidden-field scans against browser projections.
- Test HTML, RSC payloads, route responses, and client bundles.
- Fail closed when a modern snapshot is malformed.
- Enforce owner scope on every read and write.

### 7. Whole-block validation

- Exactly eight questions.
- Exactly one question per slot.
- All required formats represented.
- Intended easy/medium/hard curve.
- No repeated concept disguised by wording.
- Total time within the published range.
- All questions share the same story and frozen focus.
- The block is persisted atomically or not at all.

## Hints, attempts, answers, and learning

### Three progressive hints

Every question contains exactly three authored/generated hints.

1. **Direction:** points at the area to inspect.
2. **Mechanism:** identifies the important mechanism or boundary.
3. **Approach:** gives a near-complete problem-solving route without providing the final answer.

Example for a saturated service:

- Direction: “Compare active requests with the resources available to process them.”
- Mechanism: “Check whether request workers are blocked while waiting for database connections.”
- Approach: “Bound concurrent database work, set acquisition timeouts, and choose an explicit
  rejection or load-shedding policy.”

Hint reveals are server-controlled, idempotent, saved, and included in later evidence. Client
autosave may preserve a hint count but may never increase it.

### Attempt first

After a genuine attempt, return concise coaching containing:

- result or correct conclusion;
- the mechanism;
- what the candidate did well;
- what was missing or incorrect;
- production consequence;
- one transfer example; and
- one likely interviewer follow-up.

For code, additionally show:

- public-test results;
- missed edge cases;
- a concise annotated reference solution after authorization; and
- relevant complexity/resource behaviour.

### Show complete answer

The candidate may learn when stuck. The action must:

1. require confirmation;
2. transition the question to `LEARNED` rather than `COMPLETED`;
3. award zero mastery credit;
4. authorize a browser-safe brief answer and explanation;
5. optionally reveal an annotated reference solution;
6. allow the assessment to unlock once every question is `COMPLETED` or `LEARNED`; and
7. make the concept eligible for a cooled-down future retry.

Do not fetch the raw private rubric and filter it in the browser. The server creates a separate
authorized answer projection.

### Brief complete answer standard

“Brief” means concise, not incomplete. Every answer must include:

1. the direct answer;
2. the governing mechanism;
3. the practical consequence; and
4. the correct repair/decision when one was requested.

## Playground experience

The story should feel like solving a small production mystery, not completing a worksheet.

### Narrative progression

The eight stages may reveal evidence in a controlled sequence:

1. the symptom appears;
2. the candidate predicts what happens;
3. the mechanism is challenged;
4. the interviewer asks for a defence;
5. logs, metrics, traces, output, or data arrive;
6. the candidate repairs a defect;
7. the candidate builds the critical piece; and
8. the candidate explains how to prove and ship the result.

### Workspace tools

Depending on the slot, provide:

- code editor using the same editor theme and interaction standards as DSA;
- Run button with idempotency and double-submit protection;
- public test list;
- console output;
- logs/metrics/trace tabs;
- request timeline or data preview;
- written response editor;
- spoken-answer recorder with typed alternative;
- story progress (`5/8`);
- progressive hint controls;
- concise post-attempt feedback; and
- brief-answer reveal after attempt or confirmed Learn action.

Do not add noisy points, coins, confetti, streak pressure, fake leaderboards, or decorative game
mechanics. The fun comes from a coherent scenario, visible evidence, experimentation, and the
satisfaction of fixing something realistic.

### Question navigation

- Preserve drafts before navigation.
- Warn or wait when a save is pending.
- Browser back/forward must restore the selected question without duplicating attempts.
- Completed and learned questions are read-only.
- Refresh must restore editor content, revealed hints, status, and authorized answer state.
- Previous/next controls must be keyboard accessible and preserve story/block identity.

## Assessment after every story block

The assessment sits directly beneath the current eight-question list, matching the DSA page.

### States

- **Locked:** at least one question is still active; show the exact remaining count.
- **Ready:** all questions are completed or learned; assessment can start once.
- **In progress:** resume the existing durable assessment session.
- **Complete:** show the report, transcript link, and explicit next-story action.

### Assessment blueprint

A reasonable starting assessment contains five prompts:

1. grounded review of a weak response from the block;
2. grounded review of a code/evidence decision from the block;
3. unseen diagnosis transfer using the same story mechanism;
4. unseen small repair or implementation transfer; and
5. production defence and follow-up.

All prompts are frozen when the assessment becomes ready. Deterministic execution evidence
remains authoritative. Model feedback cannot override failing code or missing required evidence.

### Report

Persist five scores appropriate to the story-driven product:

- technical accuracy;
- mechanism/reasoning depth;
- diagnosis and evidence use;
- debugging/implementation;
- communication and production judgement.

Also persist:

- teacher summary;
- strengths;
- improvement areas;
- learned-versus-solved distinction;
- recommended next story and reason;
- safe transcript; and
- exact scoring/evaluator versions.

Completion, not a pass score, unlocks the next story. The score changes the next difficulty and
focus.

## Shared story spine across Practice products

The same high-level story may support different Practice lenses without duplicating the product
spine:

| Practice session | Question asked about Peak Traffic |
| --- | --- |
| Core Technical | Why does the confirmed language/runtime behave this way under pressure? |
| Applied Engineering | Can the candidate repair, test, instrument, and safely deliver the feature/service? |
| Architecture | Can the candidate design capacity, scaling, load shedding, caching, and failure boundaries? |

### Core Technical boundary

Core Technical emphasizes language, runtime, framework/library mechanisms, execution behaviour,
debugging, and small implementations. It may use the candidate's domain, including AI/ML, to make
the mechanism relevant.

### Applied Engineering boundary

Applied Engineering emphasizes turning requirements into reliable production changes. Its
stories may be language-independent at the scenario level while using the candidate's confirmed
language for code. Typical evidence includes requirement clarification, repository navigation,
implementation, tests, integration, reliability, security, observability, and rollout.

### Architecture boundary

Architecture is normally language-independent. Personalize by role, domain, scale, constraints,
seniority, and target job. AI/ML architecture may cover data/training pipelines, retrieval,
serving, evaluation, and model operations without pretending those are generic web-backend
questions.

Do not ask the same question in three sessions. Reuse the story, then change the evidence lens.

## Persistence and lifecycle

### Preserve DSA models

Do not modify or migrate working DSA records merely to make the new story models look generic.
The replacement may reuse DSA lifecycle ideas and shared safety utilities, but DSA remains an
independent stable product.

### Required story records

The exact Prisma names may change during design review, but the persistence model must represent:

- published story definitions and versions;
- candidate-confirmed focus revisions;
- owner-scoped story progress and unlock state;
- one current frozen block per story-driven session;
- eight ordered frozen question bundles;
- question draft/hint/attempt/run/terminal state;
- one assessment and one report per block;
- sanitized transcript snapshots; and
- generation/validation attempts and failure diagnostics kept server-side.

### Suggested state model

```text
Story: LOCKED → AVAILABLE → PREPARING → PRACTISING
                                   ↓
                         ASSESSMENT_READY
                                   ↓
                       ASSESSMENT_IN_PROGRESS
                                   ↓
                               ASSESSED

Question: ACTIVE → COMPLETED
                 ↘ LEARNED
```

Generation failure must not create a partial block. Return the story to a retryable preparation
state while preserving the previous assessed result.

### Invariants

1. Every record is owner-scoped.
2. Exactly one current block exists per story-driven Practice session.
3. Exactly eight ordered questions exist in a published block.
4. Focus, story, questions, hints, answers, sources, rubrics, and runtime versions are frozen.
5. Every mutation is idempotent.
6. Attempts bind to owner, block, question, content fingerprint, and submitted work fingerprint.
7. Code evidence binds to an exact run ID and code hash.
8. A terminal question cannot silently return to active.
9. One block owns at most one assessment and one report.
10. Assessment completion and next-story unlock are atomic or recoverable.
11. History renders snapshots only.
12. Current source content is never used to recalculate a historical block.

## Next.js and service boundaries

### Page reads

- Use an authenticated async Server Component for the story Practice entry page.
- Read services directly from the server page; do not call internal HTTP APIs from the Server
  Component.
- Await recovery before current-block, story-path, and history reads.
- Fetch independent safe reads in parallel.
- Treat `params` and `searchParams` as promises according to the repository's Next.js version.
- Use `notFound()` for unknown or foreign history IDs after an owner-scoped service check.

### Client workspace

Use Client Components only for editor interaction, hints, autosave, running code, attempts,
dialogs, audio recording, and browser navigation state. Props crossing the server/client boundary
must be plain serialized objects; serialize dates to strings and never pass service instances,
maps, sets, or private contracts.

### Mutations

Use the repository's established authenticated mutation boundary consistently. Interactive
autosave, code execution, and idempotent attempt endpoints may remain Route Handlers because they
are client-driven, rate-limited APIs with explicit replay contracts. Do not mix Server Actions
and Route Handlers arbitrarily for the same state transition.

Every mutation performs:

- authentication;
- onboarding/feature gate;
- strict request validation;
- owner check;
- block/question/story binding;
- status-transition validation;
- idempotency/replay check;
- rate/concurrency limit where applicable;
- atomic persistence; and
- browser-safe response serialization.

## UI hierarchy and DSA visual parity

### Source of truth

The implementation must study and visually match the existing DSA page, especially:

- `src/app/practice/dsa/page.tsx`
- `src/components/workspace/dsa/dsa-topics.tsx`
- `src/components/workspace/practice/practice-intro.tsx`
- `src/components/workspace/dsa/block-assessment-preview.tsx`
- the existing DSA question workspace/editor

Do not create a separate bright design system, card language, spacing scale, or navigation model
for story Practice.

### Page shell

Match the DSA shell:

- centered content, approximately `max-w-[86rem]`;
- compact responsive horizontal padding;
- `Back to Practice` link at the top;
- dark workspace background;
- cream primary text;
- muted cream secondary text;
- workspace accent variable for progress and active states;
- rounded dark cards with restrained borders and inset highlights; and
- visible focus rings using existing workspace tokens.

### Desktop hierarchy

Use the same main/sticky-aside composition as DSA:

```text
┌──────────────────────────────────────────────────────────────┐
│ Back to Practice                                             │
├───────────────────────────────────────────────┬──────────────┤
│ Current story introduction / hero             │ Coach card   │
├───────────────────────────────────────────────┤ (sticky)     │
│ Current eight-question block                  │              │
│   Question rows                               │              │
│   Assessment card directly below              │              │
├───────────────────────────────────────────────┤              │
│ Your story path                               │              │
│   Completed / current / locked story rows     │              │
└───────────────────────────────────────────────┴──────────────┘
```

The current block is always visually dominant. The full story path is secondary.

### Mobile hierarchy

- One column.
- Back link first.
- Intro/hero.
- Current block.
- Assessment.
- Coach card.
- Story path.
- No horizontal scrolling for normal content.
- Sticky desktop elements become normal-flow mobile elements.
- Primary buttons are at least 44 CSS pixels high and may become full width.

### Current story hero

Reuse the DSA introduction hierarchy:

- quiet uppercase eyebrow;
- story title as the dominant heading;
- one-sentence reason tailored to current evidence;
- current progress and honest estimated time;
- one primary Start/Continue action;
- selected teacher presence/voice only if it does not delay or obstruct work.

Example:

> **Peak Traffic**  
> Trace why your Java service slows under load, repair the concurrency boundary, and prove the
> fix with production evidence.  
> `3/8 complete · about 34 min remaining`

Do not display “70-question bank” or implementation-oriented compatibility text.

### Current block card

Match the DSA recommendation block:

- heading: `Your 8-question practice block`;
- story focus and rationale beneath;
- compact time/difficulty summary;
- two-column question rows on large screens and one column on small screens;
- numbered question markers;
- status labels for active, completed, and learned;
- next question visually emphasized without excessive animation; and
- history navigation above the frozen block when viewing past work.

### Assessment placement

The assessment card is part of the current block card and appears immediately below the eight
question rows. Match DSA's locked, ready, in-progress, and completed hierarchy. A locked card may
nudge and explain how many questions remain; it must not imply that platform content is missing.

### Story path

Replace DSA's `Explore all DSA` section with `Your story path`.

Each story row matches the DSA chapter row:

- stable number or completion check;
- title;
- tier and short purpose;
- completed/current/locked state;
- progress for a generated current block;
- chevron/details disclosure where useful; and
- an explicit lock reason such as `Complete the Peak Traffic assessment to unlock`.

Do not reveal generated future question titles before their story unlocks. Future story rows show
the story premise and skills, not nonexistent questions.

### History

Use the same-area URL-selected model as DSA:

```text
/practice/<story-session>?block=<blockId>&panel=overview
/practice/<story-session>?block=<blockId>&panel=transcript
```

Previous/next controls render the selected immutable block in the same page. Browser back and
forward must work. Historical views cannot start assessments, reveal new hints, save drafts, or
change answers.

### Accessibility

- One page `h1`; correctly nested headings thereafter.
- Story path, question list, history, and score regions have names.
- Native buttons, links, fieldsets, legends, details, and summaries where appropriate.
- Spoken questions always have an equivalent typed path.
- Dialogs have accessible names/descriptions, initial focus, focus trap, Escape behaviour, and
  focus restoration.
- Status and errors use appropriate live regions without announcing every keystroke.
- Do not rely on colour alone for locked, learned, completed, or failed states.
- Respect reduced motion.
- Keyboard users can operate question navigation, tabs, editor actions, hints, answer reveal,
  assessment start, and history.
- Validate common screen-reader output in a real authenticated browser.

## Failure and recovery behaviour

### Background preparation

Prepare the next story only after the prior assessment provides the evidence required for
adaptation. Preparation may run asynchronously, but it needs an idempotent request ID and durable
state.

Candidate-facing copy while legitimate work is running:

> Preparing your next challenge from your latest assessment…

Do not call this a missing bank or unsupported role. If generation fails, keep the completed
report visible, retry safely, and show a bounded recoverable error without losing progress.

### Generation failure

- Never publish seven of eight questions.
- Never fill a missing slot with another language.
- Retry with a new generation attempt under the same idempotent preparation request.
- Fall back only to an exact compatible reviewed question.
- Persist diagnostic information privately.
- Allow a user retry after infrastructure failure.

### Runtime failure

Differentiate:

- candidate code failure;
- compilation failure;
- timeout caused by candidate code;
- sandbox infrastructure failure;
- stale run/code mismatch; and
- save failure after a successful run.

Only candidate-caused deterministic failure affects mastery. Infrastructure failure remains
retryable and cannot become evidence against the candidate.

## Security and privacy

### Owner isolation

Every current and historical read includes the authenticated owner ID. Return not found rather
than disclosing that another owner's block exists.

### Snapshot-only history

Historical pages read saved focus, story, questions, public artifacts, authorized answers,
attempt evidence, assessment, report, and safe transcript snapshots. They never join the current
story definition or regenerate content.

### Private-field boundary

Create explicit public serializers. Do not serialize a complete database/model object and delete
known private keys afterward. Allowlist public fields.

Test that these never reach HTML, RSC, JSON/network responses, logs exposed to clients, or client
bundles:

- answer keys before authorization;
- private rubrics;
- hidden tests;
- reference grading code;
- expected private outputs;
- generator/critic prompts;
- raw model traces;
- raw resume text not needed by the UI;
- private transcript metadata; and
- other-owner records.

### Code execution

- Sandbox all candidate/generated code.
- No `child_process`, `vm`, dynamic import, or host interpreter execution in request handlers.
- Pin language/runtime/tool versions.
- Restrict time, memory, output, filesystem, process, and network capabilities.
- Store runner identity and version with every result.
- Verify run ownership and code fingerprint before accepting completion.

## Observability

Track product and reliability signals without logging private question answers or resume content:

- focus suggestion changed/confirmed;
- story recommended/unlocked/started/completed;
- block preparation latency and retry count;
- generator rejection reasons;
- question format completion/learn/retry rates;
- hint usage by level;
- sandbox availability and failure class;
- assessment start/resume/complete/recovery;
- next-story handoff;
- history access failures; and
- private-serialization audit failures.

Use these signals to improve story contracts and validators, not to punish candidates for using
hints.

## Removal and migration plan

### Meaning of “remove current stuff except DSA”

This means remove or retire the current **non-DSA Practice product implementations** after the
story-driven replacement is proven. It does not mean deleting unrelated Interviews, onboarding,
profiles, resume processing, teachers, notifications, or DSA. It does not mean deleting historical
database evidence.

### Preserve without modification unless a verified integration requires it

- `/practice/dsa` and DSA question routes;
- DSA question bank and authoring/audit pipeline;
- DSA recommendation and block lifecycle;
- DSA assessment preparation/runtime/finalization;
- DSA question workspace/editor and code-run integrity;
- DSA reports, history, transcripts, and progress;
- shared authentication, profile, resume, teacher, and interview infrastructure;
- shared sandbox adapter where its contract is safe; and
- shared transcript sanitization and owner-scoping utilities.

### Candidate non-DSA code to retire after replacement parity

Inventory the working tree again before deletion. Expected categories include:

- current Core Technical fixed-track options and confirmation UI;
- current static compatible-bank count and card semantics;
- current Core recommendation/eligibility logic tied to monolithic question banks;
- current Core-specific practice, assessment, history, and track routes superseded by the story
  engine;
- current Core block/history UI superseded by DSA-parity story components;
- static runtime/frontend Core banks and their seed placement;
- the generated 70-question Node bank as a required product dependency;
- old non-DSA `PrepPracticeService` paths and static Applied/Architecture question delivery once
  their story lenses replace them; and
- obsolete tests that assert the retired catalogue, counts, routes, or track enums.

The 70 Node questions may be retained temporarily as an exact-match reviewed source and quality
benchmark. They must not remain the architecture's universal dependency. Decide whether to retain,
archive, or delete them only after the story generator provides equivalent Node coverage and
historical blocks no longer require live source lookup.

### Database retirement

- Never hard-delete templates, attempts, blocks, assessments, reports, or transcripts referenced
  by candidate history.
- Mark old templates/engines retired and stop selecting them for new work.
- Preserve old route access only when required to render immutable history safely.
- If old history cannot use a removed UI, create a read-only legacy history adapter before deleting
  the mutation/runtime path.
- Seed changes must explicitly retire removed source content; deleting JSON alone does not remove
  previously seeded rows.
- Track all destructive source deletion in a reviewed migration checklist.

### Safe sequence

1. Freeze DSA behaviour with focused tests.
2. Add story schemas, persistence, and validators without routing users to them.
3. Implement one complete story vertical slice.
4. Implement DSA-parity UI and history.
5. Run authenticated end-to-end verification.
6. Route one non-DSA session to the story engine behind a controlled release flag.
7. Prove new writes no longer enter the retired engine.
8. Add read-only compatibility for historical non-DSA blocks.
9. Remove old non-DSA mutations, services, UI, and source banks in small reviewed patches.
10. Run repository-wide tests, type check, lint, Prisma validation, production build, and private
    serialization/host-execution searches.

Do not delete old code first and hope to rebuild parity afterward.

## Implementation order

### Phase 1: Contract and story authoring

1. Define the session boundary and released lenses.
2. Define focus, story, pattern, question-bundle, coaching, assessment, and report schemas.
3. Author three stories: one foundation, one intermediate, and one advanced.
4. Author the exact eight slots and difficulty variants for each.
5. Create interview-pattern provenance and technical-source review workflows.

### Phase 2: Generation and validation vertical slice

1. Implement focus minimization and snapshotting.
2. Implement pattern retrieval.
3. Generate multiple candidates per slot.
4. Implement independent critique and deterministic validators.
5. Implement one language runner adapter plus non-code evaluation.
6. Atomically freeze a complete eight-question block.
7. Prove idempotent retry and no partial publication.

### Phase 3: Practice workspace

1. Implement all eight slot formats.
2. Implement autosave and pending-save navigation.
3. Implement server-controlled progressive hints.
4. Implement attempt-first coaching.
5. Implement confirmed Learn/answer reveal.
6. Implement read-only terminal questions.
7. Implement refresh and browser-history recovery.

### Phase 4: Assessment and adaptation

1. Add locked/ready/in-progress/complete assessment lifecycle.
2. Freeze five assessment prompts from block evidence.
3. Run spoken/typed and sandboxed transfer tasks.
4. Persist evidence-backed scores and report.
5. Rank, unlock, and prepare the next story atomically/recoverably.

### Phase 5: DSA-parity UI and history

1. Match the DSA page shell and hierarchy.
2. Place the current block above the story path.
3. Place assessment directly beneath the eight questions.
4. Add completed/current/locked story rows.
5. Add URL-selected immutable block history and transcript.
6. Verify mobile, keyboard, focus, dialogs, and screen readers.

### Phase 6: Expand stories, roles, and runners

1. Add additional cross-role stories.
2. Add role/specialization-specific variants, including AI/ML.
3. Add language/runtime adapters based on actual candidate demand.
4. Add Applied Engineering and Architecture lenses without duplicating lifecycle.
5. Measure generator rejection and question-quality signals.

### Phase 7: Retire old non-DSA Practice

Follow the removal sequence above. Preserve DSA and historical evidence.

## Verification strategy

### Unit tests

- focus normalization and confirmation;
- story prerequisites and ordering;
- eight-slot completeness;
- difficulty and format balance;
- interview-pattern eligibility;
- exact stack compatibility;
- duplicate/cooldown logic;
- hint progression;
- answer-reveal authorization;
- public/private serializers;
- score caps; and
- next-story ranking.

### Generation contract tests

- invalid model output rejected;
- first candidate not automatically accepted;
- wrong language/framework rejected;
- unsourced claim rejected;
- ambiguous answer rejected;
- mismatched hint/answer rejected;
- starter/reference/public/hidden test contract verified;
- private field absent from public projection; and
- full block either persists with eight questions or does not persist.

### Integration tests

- owner isolation;
- one current block under concurrent preparation;
- idempotent generation retry;
- autosave and attempt replay;
- verified run required for deterministic completion;
- Learn transition and zero mastery;
- assessment readiness;
- assessment start/resume/finalization;
- deferred recovery;
- next-story unlock; and
- snapshot-only history after focus/story/source changes.

### Component/browser tests

- DSA-parity hierarchy;
- eight question formats;
- pending-save navigation;
- terminal read-only behaviour;
- hint failure/retry;
- answer confirmation and double-submit protection;
- generation and sandbox infrastructure errors;
- refresh and browser back/forward;
- assessment states;
- story locks and unlock reason;
- report-to-next-story handoff;
- history previous/next navigation;
- mobile layout;
- keyboard navigation and visible focus;
- dialog labels/focus restoration;
- screen-reader output; and
- absence of private content in HTML, RSC, JSON, and network responses.

### Engineering gate

After every material implementation phase:

```bash
pnpm exec vitest run
pnpm exec tsc --noEmit
pnpm exec eslint <all changed TypeScript/TSX files>
pnpm exec prisma validate
git diff --check
pnpm build
```

Also search production paths and client bundles for private serialization signatures and host-side
candidate code execution.

## Definition of done

The story-driven replacement is complete only when all of the following are true:

1. DSA is behaviourally and visually unchanged except for explicitly approved shared fixes.
2. A candidate confirms a plain-language preparation focus.
3. The system recommends an applicable published story with a clear reason.
4. Unlocking the story creates exactly eight coherent, interview-pattern-grounded questions.
5. All required formats are represented.
6. Questions, hints, brief answers, private rubrics, sources, and code contracts are generated and
   frozen together.
7. Every question passes relevance, technical, source, privacy, and whole-block validation.
8. Executable tasks run only in a pinned sandbox and bind completion to verified evidence.
9. Hints are progressive and durable.
10. A candidate can attempt first or explicitly learn and reveal a concise complete answer.
11. The assessment remains locked until all eight questions are completed or learned.
12. One durable assessment starts/resumes/finalizes idempotently.
13. The report shows real evidence and leaves the completed result visible.
14. The next story unlocks only after explicit handoff.
15. The page hierarchy, theme, responsive behaviour, and interaction patterns match DSA.
16. Historical blocks render only owner-scoped immutable snapshots.
17. No private evaluation material reaches the browser.
18. No incompatible language or domain question is used as fallback.
19. Generation/runtime failures are recoverable without lost progress or partial blocks.
20. Current non-DSA Practice code is retired only after replacement parity and historical safety
    are proven.

## Instructions for future agents

Before implementing:

1. Read this entire document.
2. Read `docs/NEW_ONBOARDING_AND_ADAPTIVE_PRACTICE.md` for the broader FIND → FIX → PRACTICE →
   PROVE loop.
3. Inspect the live DSA page and components listed in the UI section. Do not rely only on
   screenshots.
4. Inspect the current working tree and preserve unrelated user changes.
5. Classify every proposed component as **reuse**, **adapt**, **new**, or **retire**.
6. Write or update the relevant acceptance tests before destructive cleanup.

During implementation:

- build one complete story vertically before adding a large catalogue;
- keep reads server-side and send only allowlisted projections to Client Components;
- freeze all candidate-visible and private evaluation content together;
- prefer deterministic evidence over model judgement;
- preserve DSA contracts;
- never weaken compatibility to make generation succeed;
- never publish a partial block; and
- never hard-delete candidate history as part of source cleanup.

At handoff, report:

- which phase is complete;
- which stories, roles, languages, and formats were actually verified;
- exact automated and browser verification performed;
- any remaining private-payload or sandbox risks;
- which legacy non-DSA paths remain reachable; and
- why the next implementation step is safe.

