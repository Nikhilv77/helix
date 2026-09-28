# Interview Engine

Last updated: September 28, 2026. The audit behind the current design, with its history, is in
[docs/INTERVIEW_AUDIT.md](docs/INTERVIEW_AUDIT.md).

## Purpose

Trailgrad runs mock interviews built from the learner's own resume, target role, level, and
practice history. Each round is a live voice conversation with a reserved interviewer (Claire or
James). The server owns the plan, the state, every decision, and every score. The model hears
and speaks, proposes the next move, and rates answers against written anchors.

Scores guide practice. They are not hiring decisions.

## The rounds

| # | Round | Interviewer | Cap | Built from |
| --- | --- | --- | --- | --- |
| 1 | Resume & Behavioral Defense | James | 24 min | Resume interview kit + fixed resume-grounded prompts |
| 2 | Core Technical & Projects | Claire | 40 min | 3 MCQs (kit, then a role-weighted bank), 3 project questions, 1 coding task |
| 3 | DSA Interview | Claire | 35 min | One solved problem and one unseen problem from a practised pattern (needs 10 solved) |
| 4 | System Design | Claire | 45 min | An authored Architecture scenario the learner has not practised |
| 5 | Hiring Manager & Final Behavioural | James | 30 min | Fixed agenda: direction, fit, learning, uncertainty, conflict, mistakes, feedback, close |

- AI/ML learners have no DSA round (coding is assessed inside the technical rounds).
- Frontend and Data learners do not see System Design until their scenarios exist (see
  "System Design for Frontend and Data" in docs/09_FUTURE_SCOPE.md).
- Freshers get college, internship, and first-role versions of the behavioural questions.
- Each round has its own start route under `src/app/api/interview/<round>/start`, which builds the
  questions from stored content. No model plans questions at start.
- Limit: 2 round starts per rolling 24 hours; resuming an open room is free.

## Evidence and planning

```text
Resume upload
  → structured extraction + deterministic technology detection
  → candidate interview profile (versioned)
  → relevance ranking against the target role
  → personalized plan: five blueprints (problem-solving, core-technical,
    applied-engineering, architecture-system-design, final-mock)
  → rounds, graded answers
  → demonstrated-performance profile → next plan revision
```

- Plans are deterministic (no model call) and versioned. Only one plan per owner is `READY`;
  publishing a replacement marks the old one `SUPERSEDED`.
- Round 2 uses the core-technical and applied-engineering blueprints. The final-mock blueprint is
  generated but not used by any round.
- A resume update alone keeps the current plan; the next practice or interview result regenerates
  it. Visible progress is matched by round kind, so finished rounds stay finished and show
  `Completed · Updated round`.
- The resume interview kit (skill questions, a coding task, experience questions) is written in
  the background after onboarding and after a resume update, for the current role and level.

## A live turn

```text
Browser mic ──► Gemini Live (credential and settings locked by the server)
                    │ complete_interview_turn(answer, proposed action)
                    ▼
            POST /api/interview/decide
              · owner check, rate limit, one turn at a time per session
              · idempotent turn ID (a retry replays the saved reply)
              · state machine: question count, follow-up budget, time caps
              · answer saved; grading queued
                    │ approved reply
                    ▼
            Gemini Live speaks the approved reply
```

- **Settings are locked into the credential.** The token route puts the system instruction (plan,
  rubric, private design guide), transcription, context compression, and tools into the ephemeral
  token. The browser never receives the instruction. (Before September 28 the browser sent them
  and the API ignored them.)
- **Connections rotate.** Gemini closes each Live connection after about ten minutes. The client
  replaces it every 8 minutes, on `goAway`, or on an unexpected close, using a `rotation`
  credential with the saved history and a silent start.
- **Turns are resilient.** The browser retries network errors, timeouts, 5xx, and busy responses
  with the same turn ID. The server replays a turn when only a grade or code run changed the
  session in between.

## Grading and scores

The model observes; code scores.

- The evaluator rates each round parameter on an anchored 1–5 scale (5 exceptional, 4 strong,
  3 adequate, 2 weak or shallow, 1 absent or wrong) with evidence quotes, plus a correctness
  verdict. Level 0 marks a parameter the question did not ask about.
- Code converts levels to scores (94, 78, 55, 30, 10), averages them, and caps the answer and each
  parameter by the verdict (incorrect ≤ 44, partially correct ≤ 69, mostly correct ≤ 84) and by
  test results. MCQs use the stored answer key.
- Grading runs after the response, on Gemini's reasoning model with Groq as fallback, temperature
  0 and a fixed seed. Each question is graded once when it closes; an open question's answer waits
  10 minutes in case a follow-up replaces it. Ending the round grades everything left.
- The round score is answer quality times coverage: declined questions, and questions skipped by
  ending early, count as zero; pacing skips and time cut-offs do not. Reports show "X of Y questions
  answered".
- Unavailable grades are marked, excluded from the score and from adaptation, and retried.

## Persistence

| Model | Holds |
| --- | --- |
| `CandidateInterviewProfileVersion` | Resume-derived evidence |
| `PersonalizedInterviewPlanVersion`, `InterviewSessionBlueprint` | The plan and its blueprints |
| `InterviewSession` | State, turns, version, report snapshot |
| `InterviewAnswerRequest` | One row per turn ID |
| `InterviewEvaluationJob` | Queued grading, with retries and dead-lettering |
| `CandidatePerformanceProfileVersion` | What interviews showed; feeds the next plan |

## Key files

- Rounds and entry points: `src/app/api/interview/*/start/route.ts`, `src/app/interview/*/page.tsx`
- Visible rounds: `src/features/interviews/domain/interview-roadmap-sessions.ts`
- Plan contracts: `src/features/interviews/domain/personalized-plan.ts`
- Resume compiler: `src/features/interviews/server/candidate-profile-compiler.ts`
- Technology detector: `src/features/onboarding/server/resume/technology-detector.ts`
- Resume interview kit: `src/features/onboarding/server/resume/interview-kit.ts`
- Relevance: `src/features/interviews/server/relevance-engine.ts`
- Plan generator and service: `src/features/interviews/server/personalized-plan-generator.ts`,
  `personalized-interview-planning.service.ts`
- Round builders: `resume-round.ts`, `technical-projects-round.ts`, `dsa-design-round.ts`,
  `dsa-session-selection.ts`, `hiring-manager-round.ts` in `src/features/interviews/server/`
- Live service and state machine: `interview.service.ts`, `state-machine.ts`, `session-store.ts`
- Grading: `technical-answer-evaluator.ts`, `evaluation-recovery.ts`
- Reports: `report.ts`, `src/features/interviews/domain/report-coverage.ts`,
  `src/features/reports/application/reports-overview.ts`
- Live voice: `src/app/api/interview/gemini-live/token/route.ts`,
  `src/features/interviews/ui/voice/gemini-live-interviewer.tsx`

## Verification

```bash
npx tsc --noEmit -p .
pnpm lint
pnpm test
pnpm build
pnpm interview:quality   # live models; costs quota
```

## Current limitations

- Frontend and Data have no System Design scenarios yet; the fundamentals bank has no
  data-engineering MCQs.
- There is no job-description upload flow.
- DSA uses authored examples as tests; there is no hidden-test suite.
- Personalized code tasks in round 2 have no generated tests; they are graded on the code alone.
- Microphone capture uses `ScriptProcessorNode`; moving to an `AudioWorklet` needs a live audio test.
- Transcription languages are fixed to `en-IN` and `hi-IN`.
