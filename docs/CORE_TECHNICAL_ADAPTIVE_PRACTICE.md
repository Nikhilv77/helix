# Core Technical Adaptive Practice

> **Superseded:** This document describes the removed fixed-bank non-DSA Practice flow and must
> not be used as the implementation plan. Use
> [STORY_DRIVEN_CORE_TECHNICAL.md](./STORY_DRIVEN_CORE_TECHNICAL.md) for the current end-to-end
> Core Technical specification. This file remains only as historical design context.

## Status

This document is archived historical context for the removed fixed-bank Core Technical
design. It is not an active product or implementation specification.

The first delivery target is a candidate whose confirmed interview stack is:

- Target role: backend or full stack
- Primary language: JavaScript
- Runtime: Node.js
- Optional framework specialization: Express, Fastify, or NestJS when confirmed

The design is intentionally reusable by Applied Engineering and Architecture & System
Design later, but this project must first prove one complete JavaScript/Node.js Core
Technical path. The working DSA implementation remains authoritative for DSA and must
not be rewritten as part of the first Core Technical vertical slice.

## Relationship to existing documents

This specification extends the product loop in
`docs/NEW_ONBOARDING_AND_ADAPTIVE_PRACTICE.md` to Core Technical. For Core Technical,
this document supersedes older assumptions in `docs/PRACTICE_REQUIREMENTS.md` where
they conflict with the decisions below, particularly:

- Core Technical may use a small number of MCQs as warmups.
- Core Technical includes written/spoken explanations.
- Core Technical includes editable debugging and micro-implementation questions.
- A candidate receives stable adaptive blocks rather than one fixed 12-question session.
- Finishing the saved block assessment, not merely finishing practice questions,
  unlocks the next block.

## Current repository foundation

The repository already contains useful non-DSA infrastructure. It must be audited and
extended rather than rebuilt:

- The Practice roadmap exposes `core-technical`.
- Non-DSA Practice has session and question routes.
- Current question contracts include `mcq`, `typed`, `spoken`, `diagram`,
  `predict-run`, `find-the-flaw`, and `diagnose`.
- `predict-run` supports private expected output and deterministic evaluation.
- `find-the-flaw` and `diagnose` have private authored evaluation evidence.
- The workspace supports prompts, snippets, artifacts, hints, saved drafts, attempts,
  and review feedback.
- Practice evidence records verification, evaluator version, content version, score,
  hints, and retries.
- The current placement selector can choose up to 12 Core Technical questions.
- Source content includes ten JavaScript runtime-prediction questions and additional
  JavaScript, TypeScript, React, and testing prompts.
- Separate runtime-prediction packs exist for Python, Java, and C++.

The current foundation is not yet a complete Core Technical product. In particular,
it does not yet provide a confirmed technology track, strict ecosystem isolation,
durable adaptive Core Technical blocks, editable implementation challenges, a block
assessment, block history, or assessment-driven adaptation.

## Product objective

Core Technical answers:

> Can the candidate explain and apply how their selected language, runtime, and
> framework actually behave beneath the syntax?

The session must teach and verify mechanisms such as execution order, values and
references, memory, asynchronous control flow, runtime scheduling, I/O, cancellation,
resource cleanup, concurrency, and relevant framework behavior.

It must not become:

- A generic computer-science trivia quiz
- A duplicate DSA library
- A long mandatory course
- A random cross-language question list
- A production-incident session that duplicates Applied Engineering
- A system-design session that duplicates Architecture & System Design
- A direct resume interrogation that duplicates Resume and Behavioral Defense

## Evidence hierarchy

Personalization follows this precedence:

1. The target role defines the interview bar.
2. A candidate-confirmed stack defines eligible ecosystems.
3. Resume evidence suggests the initial language, runtime, and frameworks.
4. A target job description, when present, adjusts topic priority.
5. The preparation baseline establishes a directional starting point.
6. Verified Practice and block-assessment evidence becomes the strongest signal.
7. Seniority controls expected depth; demonstrated performance controls starting
   difficulty and pacing.

Resume data selects and frames authored questions. It must never create an unreviewed
private question bank or silently change an answer key.

### Resume relevance versus resume dependence

Core Technical questions are relevant to technologies claimed or explicitly selected
by the candidate, but they do not need to mention a resume project. For example:

- Core Technical: explain why a missing `await` escapes a surrounding `try/catch`.
- Applied Engineering: investigate duplicate checkout writes after a retry.
- Resume Defense: defend the claim that checkout reliability improved by 30 percent.

This separation keeps the sessions complementary.

## Candidate-confirmed technology track

Before the first Core Technical block is prepared, Trailgrad must persist an immutable
version of the candidate's confirmed track. A suggested track is derived from the
resume and target role, then shown to the candidate for confirmation or correction.

Example presentation:

> **Your Core Technical track: JavaScript and Node.js**
>
> Based on your resume and backend target role. Change track.

Minimum saved fields:

```ts
interface CoreTechnicalTrackSnapshot {
  version: number;
  targetRoleFamily: string;
  targetRoleTitle: string;
  targetLevel: string;
  primaryLanguage: string;
  runtime: string | null;
  frameworks: string[];
  secondaryTechnologies: string[];
  source: "resume-confirmed" | "candidate-selected" | "baseline-fallback";
  resumeFingerprint: string | null;
  targetJobFingerprint: string | null;
  confirmedAt: number;
}
```

The snapshot, not a newly parsed resume, controls every question in an existing block.
A later resume or track change may influence the next block but cannot rewrite history.

### Eligibility must fail closed

Question compatibility is a hard gate:

- A language-bound question requires an exact supported language.
- A runtime-bound question requires an exact supported runtime.
- A framework-required question requires that confirmed framework.
- A role-specific question requires a compatible target role.
- Runtime-sensitive code must declare the runtime version used to author and execute it.
- Insufficient eligible content produces a clear unavailable state; it must never cause
  fallback to an unrelated ecosystem.

This means a JavaScript/Node.js backend candidate must not receive React, Java, Python,
or C++ content simply because the eligible Node.js pool is too small.

### Mixed full-stack candidates

A track has one primary language/runtime and at most one secondary ecosystem. A Java
and React candidate may receive a weighted track, for example:

- Java/JVM: 40 percent
- Spring: 25 percent
- Java concurrency: 15 percent
- TypeScript/React: 15 percent
- Shared testing foundations: 5 percent

If resume evidence is ambiguous, the candidate chooses the stack they expect to use in
interviews. Alphabetical or database-order tie-breaking must not silently make that
product decision.

## JavaScript and Node.js curriculum

The complete authored bank target is approximately 70–80 questions. It is a selection
pool, not a mandatory checklist. A candidate will normally complete only the adaptive
path needed to demonstrate stable mastery.

| Chapter | Target count | Coverage |
| --- | ---: | --- |
| JavaScript values and object behavior | 10 | Identity, equality, mutation, copying, prototypes |
| Functions, scope, and modules | 8 | Closures, binding, `this`, CommonJS, ESM |
| Promises and asynchronous execution | 12 | Promises, `async`/`await`, scheduling, cancellation |
| Node.js runtime | 10 | Event loop, libuv, worker pool, process lifecycle |
| Streams, buffers, and I/O | 10 | Backpressure, piping, binary data, cleanup |
| Concurrency and work isolation | 8 | Workers, processes, task limits, shared state |
| HTTP server mechanics | 8 | Request streams, response lifecycle, disconnects |
| Errors, resources, and testing | 10 | Propagation, cleanup, leaks, deterministic tests |

Framework packs are additive. Express, Fastify, or NestJS questions are eligible only
when that framework is confirmed. Database query plans, caching incidents, retry
operations, and observability investigations normally belong to Applied Engineering.

## Question taxonomy

The complete JavaScript/Node.js bank should use the following approximate mix:

| Product category | Target count | Share | Current/proposed storage format |
| --- | ---: | ---: | --- |
| Pure MCQ | 8 | 10% | Existing `mcq` |
| Written or spoken explanation | 12 | 15% | Existing `typed` or `spoken` |
| Predict and explain a code snippet | 20 | 25% | Extend existing `predict-run` |
| Debug and repair code | 20 | 25% | Existing `find-the-flaw` for identification; add editable repair contract |
| Micro-implementation coding | 20 | 25% | Add an implementation contract |

The implementation may retain existing persisted enum names where migration safety
requires it. The UI should use the understandable product-category names above.

### 1. Pure MCQ

MCQs are short recognition checks and warmups. They are not sufficient evidence of
senior technical ability.

Examples:

- What does `stream.write()` returning `false` mean?
- Which workload is appropriate for a worker thread?
- What happens when an `EventEmitter` emits `error` without a listener?
- Which API composes streams while forwarding errors and cleanup?

Evaluation is deterministic against a private authored answer key.

### 2. Written or spoken explanation

The candidate explains a mechanism, limitation, or trade-off.

Examples:

- Explain what happens when execution reaches `await`.
- Explain event-loop concurrency versus parallel execution.
- Explain why CPU-heavy JavaScript delays unrelated requests.
- Compare worker threads and child processes.
- Explain stream backpressure.

Evaluation uses an authored rubric containing required concepts, strong signals, weak
signals, and disallowed claims. Model evaluation may structure feedback, but a keyword
match alone cannot establish mastery.

### 3. Predict and explain

The candidate reads an exact saved snippet, predicts its output or behavior, and
explains the mechanism.

Examples cover:

- Synchronous work, promises, `process.nextTick`, timers, and I/O
- Closures created with `var` and `let`
- Shallow-copy mutation
- `this` binding
- Promise rejection and `finally`
- CommonJS caching and circular initialization
- Buffer views and shared memory
- EventEmitter listener ordering

The output portion is evaluated deterministically. The explanation is evaluated
separately. Runtime-sensitive questions are authored and executed against a pinned
runtime version saved in the question and assessment snapshots.

### 4. Debug and repair

The candidate receives broken code, identifies the defect, edits the code, runs public
checks, and submits it for authoritative server-side evaluation.

Examples:

- A promise is neither awaited nor returned.
- `Promise.all` creates unbounded work.
- A stream ignores backpressure.
- An HTTP response is sent twice.
- A listener or timer leaks.
- A client disconnect does not cancel downstream work.
- An async test completes before its assertions run.
- A callback is invoked twice.

The private contract includes the planted defect, accepted repairs, hidden tests, and a
reference solution. Hidden tests, runner contracts, and reference code never reach the
browser.

### 5. Micro-implementation coding

These are the Core Technical equivalent of DSA coding: small behavior-focused tasks,
not algorithm puzzles or complete applications. A normal task should require roughly
15–25 focused lines of candidate code and take 10–20 minutes.

JavaScript/Node.js examples:

- Implement a promise concurrency limiter.
- Implement a cancellable timeout wrapper.
- Implement `mapWithConcurrency`.
- Wait for an EventEmitter event once and remove all listeners safely.
- Implement a line-oriented transform stream.
- Enforce a request-body size limit.
- Implement cancellable polling with `AbortSignal`.
- Compose middleware with correct error propagation.
- Guarantee asynchronous resource cleanup.
- Implement a bounded task queue.
- Flush a batch by size or timeout.
- Implement a safe callback-to-promise adapter.
- Consume a stream while respecting backpressure.
- Wrap worker-thread work with cancellation and cleanup.
- Implement an asynchronous iterator over paginated results.

For a frontend track, an accessible accordion, keyboard-navigable tabs, abortable
search, or controlled/uncontrolled state can be valid Core Technical tasks when they
test state, events, cleanup, identity, and accessibility behavior rather than styling.

## Question authoring contract

Every published Core Technical question requires:

- Stable canonical ID
- Positive content version
- Bank and chapter
- Product category and persisted format
- Compatible roles and levels
- Language, runtime, framework, and ecosystem gates
- Runtime version when execution semantics matter
- Difficulty and estimated time
- Candidate-visible objective and prompt
- Optional public starter code and examples
- Two or three progressive hints
- Authored post-attempt explanation
- Common misconception
- Production relevance
- A small transfer example
- Private answer key or evaluation contract
- Strong and weak answer signals where judgment is required
- Evaluator version
- Authoring sources or notes where relevant
- Publication state

### Publication workflow

```text
Author draft
    -> schema validation
    -> deterministic execution or test verification where possible
    -> answer-leak audit
    -> human technical review
    -> PUBLISHED
```

For executable questions:

- The authored expected output must match an actual execution.
- Broken starter code must fail the intended test.
- The reference repair/solution must pass public and hidden tests.
- Hidden tests must cover behavior beyond visible examples.
- A malformed private contract produces unverified evidence, never an incorrect score.

## Coaching and explanations

Core Technical is a learning experience during Practice and an independent proof
experience during the assessment.

### Chapter primer

Each chapter may begin with an optional two-to-four-minute theory primer containing:

- The core mechanism
- A minimal example
- Why it matters in production
- A common misconception
- Relevant runtime/version assumptions

The primer must not reveal the answer to the active question.

### Progressive hints during Practice

Each question provides up to three authored hints:

1. **Direction:** points to what the candidate should inspect.
2. **Mechanism:** recalls the relevant runtime rule.
3. **Guided trace:** provides most of the reasoning without directly submitting an
   answer or code solution.

Hint usage is persisted as evidence:

- No hint: strong independent evidence
- One hint: mostly independent evidence
- Two or three hints: guided completion
- Revealed solution: learning evidence, not mastery

### Learn and retry

During regular Practice, the candidate can choose **Learn this concept**. Confirmation
must explain:

> Revealing the explanation will mark this question as Learn & retry. It will not count
> as demonstrated mastery.

After confirmation:

- The question becomes `SKIPPED` for the current block.
- It receives no mastery credit.
- The full explanation becomes available.
- It remains eligible for a future spaced retry or an authored variant.
- The candidate may continue through the block.

### Post-attempt explanation

After submission or an explicit reveal, show only the relevant sections:

1. Correct result or behavior
2. Step-by-step execution trace
3. Underlying theory
4. Candidate-specific mistake or missing concept
5. Why alternatives fail
6. Production consequence
7. Common interview trap
8. Transfer example

Private grading instructions remain server-only even after the public explanation is
revealed.

## Adaptive block model

A Core Technical session is a sequence of small saved blocks, not a single permanent
list. A block is frozen after preparation.

| Starting tier | Block size | Intended mix |
| --- | ---: | --- |
| Foundations | 8 | More mechanism guidance, easy-to-medium transfer |
| Building | 8 | Mostly medium, balanced explanation and application |
| Advanced | 7 | Mostly medium/hard debugging and implementation |
| Unknown | 6 | Diagnostic variety before committing to a path |

A typical eight-question block contains:

- 1 MCQ
- 1 written/spoken explanation
- 2 predict-and-explain questions
- 2 debug-and-repair questions
- 2 micro-implementation questions

Question format weighting changes by seniority:

| Category | Junior | Mid-level | Senior |
| --- | ---: | ---: | ---: |
| MCQ | 15% | 10% | 5% |
| Explanation | 25% | 15% | 15% |
| Predict and explain | 25% | 25% | 20% |
| Debug and repair | 20% | 25% | 30% |
| Implementation | 15% | 25% | 30% |

Seniority controls depth, not volume. Senior candidates may complete fewer total
questions if they prove mastery faster.

### Weak senior starting behavior

A poor baseline must not contradict a senior resume by assigning syntax trivia. It
creates a senior-context foundations refresh:

```text
Resume evidence: senior JavaScript/Node.js developer
Baseline evidence: weak runtime mechanisms
Initial state: Senior Node.js - foundations refresh
```

Example first block:

1. Stream-backpressure recognition check
2. Explain event-loop concurrency
3. Predict promise, `nextTick`, and timer ordering
4. Predict closure and shared-mutation behavior
5. Repair missing `await` and error propagation
6. Repair ignored stream backpressure
7. Implement a concurrency limiter
8. Implement a cancellable timeout wrapper

Suggested difficulty is two easy mechanism checks, five medium questions, and one hard
transfer. Strong assessment evidence accelerates the candidate into advanced runtime,
worker, cancellation, and resource-management topics. Continued weakness produces a
different focused reinforcement block, not repetition of the same questions.

### Block stability and terminal states

- The block stores its exact track snapshot, recommendation, question order, and
  question-content versions.
- Refreshing cannot reshuffle it.
- Passing verified evidence marks a question `COMPLETED`.
- Choosing Learn & retry marks it `SKIPPED` with no mastery credit.
- An unsuccessful attempt remains non-terminal until the candidate retries or chooses
  Learn & retry.
- The assessment becomes ready only when every saved question is `COMPLETED` or
  `SKIPPED`.
- The next block is selected only after the assessment is completed.
- Completing the assessment, not attaining a passing score, unlocks progression.

## Core Technical block assessment

Every saved Core Technical block owns exactly one teacher-led assessment.

Recommended 30–40 minute structure:

1. Four or five rapid questions grounded in saved block attempts
2. One unseen authored debugging transfer problem
3. One unseen authored micro-implementation transfer problem
4. Teacher follow-ups and wrap-up

Grounded review prompts may ask the candidate to:

- Explain the exact saved output or runtime trace.
- Identify why their saved explanation was incomplete.
- Defend a repair they submitted.
- Explain the consequence of a skipped concept.
- Compare their implementation with a different constraint.

### Assessment preparation

When the block becomes ready, save an immutable assessment snapshot containing:

- Block and track snapshots
- Exact source attempt, answer, code, output, and evidence used by each review prompt
- Candidate-visible prompts and snippets
- Private correct answers and rationales where applicable
- Both unseen transfer questions
- Public starters and examples
- Frozen hidden runner contracts and reference solutions
- Rubric and evaluator versions
- Pinned runtime version
- Teacher and session configuration

Later content, runtime, recommender, or evaluator changes cannot alter the in-progress
or completed assessment.

### Assessment behavior

- No answer-revealing hints are available.
- The teacher may clarify wording but not teach the required mechanism.
- **I can't solve this** displays a confirmation that the prompt receives zero.
- Confirming marks the prompt terminal as skipped and moves to the next prompt.
- The session cannot finalize until every prompt is answered or explicitly skipped.
- Leaving before that point preserves the same resumable assessment and creates no next
  block.
- Starting or resuming must be idempotent and must never create a duplicate assessment
  or interview session.
- Detailed explanations become visible only after the assessment is finalized.

### Assessment scoring

The completed report contains five scores:

- Technical accuracy: 30 percent
- Runtime and mechanism depth: 25 percent
- Reasoning and tracing: 20 percent
- Debugging and implementation: 15 percent
- Communication: 10 percent

Evidence authority:

- Hidden tests control executable correctness.
- Frozen expected output controls prediction correctness.
- Authored rubrics control required explanation concepts.
- Saved code and run fingerprints prevent stale-run submission.
- Transcript evidence supports communication scoring.
- A language model cannot override failed deterministic evidence.
- Skipped assessment prompts receive zero for their applicable evidence.

Finalization must be atomic and idempotent. A failed deferred finalizer must be
recoverable when Practice is opened again.

## Results, history, and adaptation

Core Technical is a URL-addressable block viewer:

```text
/practice/core-technical?block=<uuid>&panel=overview
/practice/core-technical?block=<uuid>&panel=transcript
```

The default is the newest/current block. A requested block must belong to the
authenticated owner.

Historical blocks render exclusively from saved snapshots and include:

- Block ID and ordinal
- Dates and lifecycle state
- Frozen technology track and recommendation
- Frozen question cohort and terminal statuses
- Completed/total counts
- Assessment session ID
- Five assessment scores
- Answered/total and skipped count
- Assessment duration and date
- Teacher summary, strengths, and improvement areas
- Safe assessment problem summaries
- Sanitized teacher/candidate transcript turns
- Previous/next navigation

Never recalculate an old block using the current resume, current question bank, current
runtime, or current recommender.

The next block adapts from weak and strong evidence. Examples:

- Weak streams plus strong async reasoning emphasizes backpressure and cleanup.
- Strong foundations advances to workers, cancellation, and runtime trade-offs.
- Broad weakness creates another foundations block with different authored questions.
- Hint-heavy completion lowers mastery confidence even when the final answer is correct.
- Skips create explicit gaps and never masquerade as demonstrated mastery.

## Data and architecture direction

The non-DSA block foundation should be reusable by Core Technical, Applied Engineering,
and Architecture & System Design. Prefer new general non-DSA records such as:

```text
PrepPracticeBlock
PrepPracticeBlockQuestion
PrepBlockAssessment
PrepBlockAssessmentReport
```

They should be keyed by `practiceSessionKey`. Do not migrate or rewrite the completed
DSA records during the first Core Technical delivery unless a separately reviewed
migration proves that historical DSA evidence remains unchanged.

Required durable concepts:

- Owner scope on every root record
- One current block per owner and Practice session
- One assessment per block
- One interview session per assessment
- Immutable track/recommendation/question/assessment snapshots
- Idempotency keys or uniqueness constraints for start/finalize operations
- Canonical code fingerprints for run/submission matching
- Content, evaluator, rubric, runtime, and recommendation versions
- Explicit timestamps and terminal statuses
- Atomic report persistence and next-block preparation

## Public/private data boundary

The browser may receive:

- Public prompt and objective
- Public code snippet or starter
- Public examples and options
- Public hints only after each is requested
- Saved candidate answer/code
- Public execution results
- Post-attempt explanation after eligibility to reveal it
- Final public report and sanitized transcript

The browser must never receive:

- MCQ answer keys before submission
- Expected runtime output before submission
- Private rationales before reveal
- Strong/weak evaluator signals
- Hidden tests or hidden cases
- Runner contracts
- Reference repairs or solutions
- Private scoring prompts
- Raw model traces or tool payloads
- Another owner's blocks, attempts, sessions, or reports

Modern malformed snapshots fail closed. Explicitly supported legacy records may degrade
to a clear unavailable state without exposing raw JSON.

## Implementation plan

### Step 1 - Requirements and boundaries

**Status: complete in this document.**

- Define product objective and session boundaries.
- Fix JavaScript/Node.js as the first ecosystem.
- Define personalization precedence and candidate confirmation.
- Define the five question categories.
- Define coaching, reveal, skip, block, assessment, scoring, history, and safety rules.
- Define current-versus-planned repository scope.

### Step 2 - Audit existing Core Technical content

**Status: pending.**

- Enumerate every template currently mapped to `core-technical` after seed derivation.
- Record publication state, ecosystem, role, level, language, framework, chapter,
  format, verification, and explanation quality.
- Identify frontend or cross-stack leakage.
- Identify missing runtime-version metadata.
- Preserve existing templates; archive only after replacement content clears bank floors.

### Step 3 - Persist the confirmed technology track

**Status: pending.**

- Add the versioned track contract and durable storage.
- Derive a suggestion from target role, resume, language, and job description.
- Add candidate confirmation/change UI.
- Owner-scope all reads and writes.
- Snapshot the confirmed track into each block.

### Step 4 - Enforce question compatibility

**Status: pending.**

- Add ecosystem, runtime, and framework targeting metadata.
- Replace permissive cross-role fallback with fail-closed eligibility.
- Keep deterministic stable tie-breaking within an eligible pool.
- Add unavailable-state behavior for an undersized compatible bank.

### Step 5 - Define and verify format contracts

**Status: pending.**

- Retain compatible current formats.
- Extend `predict-run` with a separate explanation response.
- Add an editable debug/repair contract.
- Add a micro-implementation contract.
- Define safe public serializers for every format.
- Define server-only answer and runner contracts.

### Step 6 - Author the 24-question vertical-slice bank

**Status: pending.**

- 3 MCQs
- 4 explanations
- 6 predict-and-explain questions
- 6 debug-and-repair questions
- 5 micro-implementation questions
- Cover the JavaScript/Node.js chapters required for at least three distinct blocks.
- Verify all deterministic output, starter failures, reference solutions, and hidden
  tests before publication.

### Step 7 - Add durable non-DSA blocks

**Status: pending.**

- Add generic non-DSA block and assessment lifecycle records.
- Freeze exact question cohorts and versions.
- Preserve terminal question states.
- Add uniqueness and idempotency constraints.
- Do not alter working DSA history.

### Step 8 - Build Core Technical recommendation

**Status: pending.**

- Select only track-compatible questions.
- Calculate starting tier from seniority and evidence.
- Balance chapters, formats, and difficulty.
- Use hints, retries, skips, verified scores, and assessment results.
- Save the recommendation rather than reshuffling it on read.

### Step 9 - Complete the five Practice workspaces

**Status: pending.**

- MCQ submission and reveal
- Written/spoken explanation and rubric feedback
- Blind prediction plus explanation and verified execution
- Editable debugging with public run and hidden submission
- Micro-implementation editor with public run and hidden submission
- Autosave, stale-run protection, keyboard access, loading, and error states

### Step 10 - Add coaching and Learn & retry

**Status: pending.**

- Optional chapter primers
- Three progressive hints
- Persisted hint evidence
- Reveal confirmation
- `SKIPPED`/Learn & retry state with zero mastery
- Complete post-attempt explanation and retry path

### Step 11 - Prepare and run the block assessment

**Status: pending.**

- Ready transition after every question is terminal.
- Freeze grounded review and two unseen transfer problems.
- Extend the voice runtime with review, debugging, implementation, and wrap-up stages.
- Add explicit skip-for-zero confirmation.
- Require every assessment prompt to become terminal.
- Resume the same session without duplication.

### Step 12 - Finalize scoring and adaptation

**Status: pending.**

- Calculate and persist all five evidence-backed scores.
- Apply hidden-test authority and stale-run rejection.
- Add correctness safety behavior for failed executable work.
- Persist the report atomically and idempotently.
- Recover failed deferred finalization through a Practice read.
- Prepare the next block from weak and strong evidence.

### Step 13 - Add block history and completion handoff

**Status: pending.**

- URL-selected block viewer with overview/transcript panels.
- Previous/next navigation.
- Immutable historical rendering.
- Safe transcript serialization.
- Four assessment-card states.
- Core Technical completion CTA returning to the exact block result.

### Step 14 - Expand content and verify the complete product

**Status: pending.**

- Expand the JavaScript/Node.js bank from 24 to approximately 70–80 questions.
- Review every published item technically and editorially.
- Run schema, type, unit, integration, lint, build, and diff checks.
- Browser-test the complete learning, assessment, history, resume, adaptation, and
  cross-owner rejection stories.
- Only after the JavaScript/Node.js path is stable, add Java, Python, Go, C++, C#,
  frontend-framework, data, and AI/ML ecosystem packs.

## Delivery checkpoints

### Checkpoint 1 - Learning vertical slice

- Confirmed JavaScript/Node.js track
- 24-question reviewed bank
- All five question categories
- One stable adaptive block
- Hints, explanations, Learn & retry, and verified evidence

### Checkpoint 2 - Proof loop

- Teacher-led block assessment
- Grounded review prompts
- Unseen debugging and implementation transfers
- Five saved scores
- Adapted next block

### Checkpoint 3 - Complete JavaScript/Node.js product

- Immutable block history and safe transcripts
- 70–80-question bank
- Complete recovery and idempotency behavior
- Full regression and browser verification

## Step 1 acceptance criteria

Step 1 is complete when this document records, without unresolved product ambiguity:

- Who receives the first Core Technical track
- How resume, target role, seniority, and evidence interact
- Why personalization uses authored banks rather than generated answer keys
- Which topics belong to Core Technical
- Which topics remain in other sessions
- The five question categories and target mix
- How real coding differs from DSA
- How hints, explanations, reveal, and Learn & retry work
- How a weak senior candidate starts and advances
- How blocks become assessment-ready
- How assessment skipping and resumption work
- The five score dimensions and evidence authority
- Immutable historical rendering requirements
- The public/private data boundary
- The ordered implementation and verification plan

All of those decisions are fixed above. Step 2 begins with a read-only inventory of the
currently seeded and source-authored Core Technical content before any schema or runtime
changes are made.
