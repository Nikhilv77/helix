# Interview Engine

## Purpose

Trailgrad builds one adaptive interview path from grounded candidate evidence. Historical profiles,
plans, sessions, and performance revisions remain immutable.

```text
Resume upload
  → structured extraction + deterministic technology detection
  → candidate interview profile
  → relevance ranking
  → five personalized blueprints
  → live guarded interviews
  → correctness and behavioral evidence
  → demonstrated-performance profile
  → adapted plan revision
```

## Candidate-facing path

The planner keeps five stable internal kinds:

1. `problem-solving`
2. `core-technical`
3. `applied-engineering`
4. `architecture-system-design`
5. `final-mock`

The UI displays six sessions: dedicated DSA, three technical sessions, Resume and Behavioral
Defense, and the Final Mock. DSA replaces the generic problem-solving card.

## Evidence

Candidate evidence is assembled server-side from:

- grounded structured resume extraction;
- deterministic exact technology detection over the original document text;
- target-role relevance;
- completed interview performance.

The deterministic pass recovers explicit technologies missed by the model and normalizes aliases
such as `React.js` → `React`. Ambiguous names such as `Go`, `R`, and `C` require a skills section or
clear technical context. Evidence sources, excerpts, confidence, and weights are not shown in the
onboarding UI.

Resume evidence precedence is work experience, projects, repeated use, recency, then skills-only
mentions. Demonstrated performance adjusts future coverage and difficulty without rewriting the
historical resume profile.

## Planning and runtime

- Candidate profiles and plans use versioned Zod contracts.
- Exactly five blueprints are generated in the stable order above.
- Topics and rubric weights must total 100.
- Launch APIs resolve plan and blueprint IDs on the server.
- Live session APIs require the signed-in owner, a signed anonymous-browser identity, or a
  short-lived voice-worker capability bound to that session.
- Questions and follow-ups stay inside the selected blueprint.
- The state machine enforces question count, follow-up budgets, and time caps.
- Session mutations use optimistic versions, so concurrent answers or code runs cannot overwrite
  newer state.
- Every answer carries a unique turn ID; completed retries replay the stored response, while
  simultaneous different turns produce a conflict instead of double-advancing.
- Shared Redis limits interview starts, answer evaluation, LiveKit tokens, code execution, resume
  uploads, and uncached TTS generation across every web instance.
- Distributed leases allow one answer evaluation and one code run at a time per scope. LiveKit
  reconnects reuse one session room and candidate identity, preventing duplicate active rooms.
- Provider failures use bounded in-topic fallbacks.

## Evaluation and adaptation

- Technical answers receive a persisted semantic correctness verdict.
- Clear but materially incorrect answers must score below 45.
- DSA code runs persist authored test results and execution errors.
- Failed tests cap correctness; execution without tests does not prove correctness.
- MCQs use the authored answer key.
- Resume/behavioral answers update ownership, decision, specificity, and outcome signals.
- Evaluator outages are marked unverified and excluded from adaptation.
- Performance profile schema version 3 includes personalized, DSA, and behavioral sessions.
- The Final Mock includes weak technical, DSA-pattern, and behavioral signals.

## Progress across plan revisions

Blueprint IDs change when the plan adapts, but visible progress is matched by stable session kind.

- Completed slots remain completed.
- Changed blueprints display `Completed · Updated round`.
- Starting again launches the newest blueprint.
- In-progress sessions from superseded plans resume their existing room.

## Persistence

Primary records:

- `CandidateInterviewProfileVersion`
- `PersonalizedInterviewPlanVersion`
- `InterviewSessionBlueprint`
- `InterviewSession`
- `CandidatePerformanceProfileVersion`

Only one plan per owner is `READY`. Publishing a replacement marks the previous plan
`SUPERSEDED`; it is never overwritten.

## Key files

- Contracts: `src/lib/interviews/personalized-plan.ts`
- Performance: `src/lib/interviews/performance-profile.ts`
- Resume compiler: `src/server/interview/candidate-profile-compiler.ts`
- Technology detector: `src/server/onboarding/resume/technology-detector.ts`
- Relevance: `src/server/interview/relevance-engine.ts`
- Plan generator: `src/server/interview/personalized-plan-generator.ts`
- Planning service: `src/server/interview/personalized-interview-planning.service.ts`
- Blueprint runtime: `src/server/interview/personalized-blueprint-runtime.ts`
- Live service: `src/server/interview/interview.service.ts`
- Correctness evaluator: `src/server/interview/technical-answer-evaluator.ts`
- Performance aggregation: `src/server/interview/performance-profile-aggregator.ts`
- Visible progress: `src/lib/interviews/interview-roadmap-sessions.ts`

## Verification

```bash
pnpm exec prisma validate
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

## Current limitations

- There is no job-description upload flow.
- DSA uses authored cases rather than a hidden-test suite.
- Personalized code tasks do not yet have generated test contracts.
- Existing resumes need re-uploading for deterministic technology recovery because raw text is not
  retained.
- Performance refresh occurs when the personalized plan is next requested.
- Scores guide practice and must not be used as automated hiring decisions.
