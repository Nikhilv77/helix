# Core Technical & Projects Interview — Terra implementation handoff

Status: implementation specification  
Prepared: 16 September 2026  
Implementer: Terra  
Target round: permanent roadmap round 2, `Core Technical & Projects`

This document is the source of truth for turning the existing Technical Deep
Dive into a realistic Claire-led **Core Technical & Projects** interview.
Follow it in order. Do not build a second interview engine, copy the Resume
room, or let a live model invent answer keys and project facts.

The repository already contains the difficult infrastructure: immutable
personalized Core and Applied blueprints, grounded resume/project evidence,
reviewed Core Technical MCQs, the Resume/Hiring Manager Gemini Live tool loop,
Claire's reserved persona, deterministic MCQ grading, durable sessions,
evaluation recovery, reports, and the shared live room. This work joins those
pieces into one permanent interview.

## 1. Fixed product decisions

Do not make new product decisions while implementing.

1. The candidate-facing round remains roadmap round 2.
2. The round is called **Core Technical & Projects**.
3. The durable template identity remains `technical-deep-dive` for backward
   compatibility. Do not use a display title as the primary identity.
4. The live interviewer is always **Claire**.
5. Claire's Gemini Live native-audio voice is **Kore**.
6. The selected everyday teacher gives the launch handoff and explicitly says
   that Claire will conduct the interview.
7. The standard round contains exactly seven planned questions:
   - three rapid, scenario-based Core Technical MCQs;
   - four connected project deep-dive prompts about one grounded project.
8. The hard cap is 40 minutes. It is a maximum, not a target.
9. The technical calibration comes first. The project deep dive follows as one
   continuous investigation rather than four unrelated questions.
10. MCQs test mechanisms and engineering consequences, not definitions,
    syntax trivia, framework release trivia, or trick wording.
11. MCQ answers are graded deterministically on the server. Claire does not
    reveal correctness or the answer explanation during the interview.
12. Project questions are grounded in saved resume/profile evidence. Claire may
    challenge a candidate's answer, but she must not invent project facts.
13. Gemini Live understands intent and manages natural turn-taking. Do not
    implement phrase lists as the primary conversation engine.
14. `InterviewService` remains the only authority allowed to persist, advance,
    skip, pace, or end a session.
15. Claire asks one question at a time, listens through natural pauses, and may
    use at most two focused follow-ups on each project prompt.
16. Candidate questions, requests for clarification, requests for thinking
    time, declines, and requests to end have the same semantic behavior as the
    Resume & Behavioural round.
17. The existing completion/debrief, `/reports`, report overview, and PDF flow
    are reused.
18. The report family remains `core-technical-projects`.
19. No database migration is expected. New optional setup/question metadata is
    stored in the existing JSON session state. Stop and document the conflict
    before adding a schema migration if this assumption proves false.

## 2. What this round should feel like

This is not a practice quiz followed by a friendly project chat. It should
feel like a strong 40-minute engineering interview:

```text
short technical calibration
  -> candidate commits to three mechanism-level decisions
  -> Claire names the project and establishes its real boundary
  -> candidate traces one important technical path end to end
  -> Claire investigates a failure, bottleneck, or correctness risk
  -> candidate defends trade-offs, verification, rollout, and learning
  -> concise close and evidence-backed report
```

Claire is direct, calm, technically credible, and neutral. She does not shower
the candidate with praise, provide a lesson after every answer, or mechanically
ask for metrics. Her follow-ups respond to what the candidate actually said:

- an unexplained mechanism earns a mechanism probe;
- a vague team claim earns a personal-ownership probe;
- an architecture claim earns an end-to-end trace;
- a reliability claim earns a failure or recovery challenge;
- an asserted result earns a validation or measurement probe;
- a coherent answer with sufficient evidence moves on.

The candidate should experience a conversation. The implementation must still
be a frozen, owner-scoped, replay-safe, server-authoritative assessment.

## 3. Existing implementation that must be reused

### 3.1 Permanent roadmap and Technical Deep Dive

- Roadmap projection:
  `src/features/interviews/domain/interview-roadmap-sessions.ts`
- Stable identity and current card constants:
  `src/features/interviews/domain/technical-deep-dive.ts`
- Current Core + Applied projection:
  `src/features/interviews/server/technical-deep-dive.ts`
- Current generic start route:
  `src/app/api/interview/start/route.ts`
- Personalized plan resolver:
  `personalizedInterviewPlanningService.technicalDeepDiveBlueprints(...)`
- Core/Applied source provenance:
  `InterviewSetup.technicalDeepDive.questionSources`

The current implementation builds four alternating generated slots:

```text
Core -> Applied -> Core -> Applied
```

That is useful compatibility infrastructure, but it is not the finished
candidate experience. Replace the new-session plan with the seven-question
contract in this document while retaining the old four-question sessions for
resume/history compatibility.

### 3.2 Grounded candidate evidence

Reuse:

- `CandidateInterviewProfileVersion` and
  `CandidateInterviewProfile.importantProjects`;
- the structured saved resume and its project entries;
- deterministic technology detection and normalized skill keys;
- active `core-technical` and `applied-engineering` blueprints;
- relevance ranking and demonstrated-performance signals;
- the stored Resume interview kit when it supplies a reviewed, compatible
  technical MCQ.

Resume/project text is evidence, not an answer key. Preserve the exact source
identity and a short excerpt so Claire can ask grounded questions without
pretending an unsupported claim is true.

### 3.3 Reviewed technical content

Prefer human-reviewed Core Technical material:

- Core question contract:
  `src/features/practice/core-technical/domain/question-contracts.ts`
- reviewed story/path catalogue:
  `src/features/practice/core-technical/domain/practice-path-blueprints.ts`
- reviewed artifacts and approved fallback pipeline under
  `src/features/practice/core-technical/`;
- persisted Resume kit skill questions when they have a valid MCQ answer key
  and match the selected Core blueprint.

Do not ask a model at interview-start time to create a multiple-choice answer
key. A model may have helped create content earlier only if the resulting
question, options, answer, explanation, provenance, and version were validated
and frozen before the live session.

### 3.4 Shared interview machinery

Reuse, do not duplicate:

- `InterviewService`;
- `state-machine.ts`;
- `session-store.ts`;
- `/api/interview/decide`;
- `gemini-live-interviewer.tsx`;
- the Gemini ephemeral-token route;
- `complete_interview_turn`;
- `ResumeLiveWorkspace` interaction patterns;
- local MCQ grading;
- semantic technical evaluation and durable recovery;
- candidate-requested end, decline, support, and reconnect behavior;
- completion debrief, reports overview, report detail, and PDF;
- auth, owner cookie, quota, rate limits, creation lease, answer lease, and
  idempotent turn replay.

The Resume & Behavioural implementation is the conversation-policy reference.
It is not a component tree to copy into a second room.

## 4. Final candidate journey

### 4.1 Interviews roadmap

The permanent card must say:

- Title: `Core Technical & Projects`
- Purpose: `Prove the mechanisms you know, then defend how you used them in a real project.`
- Covers:
  - `Three scenario-based technical checks`
  - `One project traced from design to production`
  - `Ownership, trade-offs, failures, testing, and impact`
- Duration: `40 min`

The card must start a new seven-question round or resume any unfinished session
whose durable identity is `technical-deep-dive`, including legacy four-question
sessions. Never strand an active legacy session because its title, plan shape,
or question count differs.

### 4.2 Dedicated entry and launch

Create a dedicated entry route rather than reviving the retired generic setup
wizard:

```text
/interview/technical-projects
```

Create a dedicated start endpoint:

```text
/api/interview/technical-projects/start
```

The route names are candidate-facing adapters over the shared engine. They do
not create a new runtime.

The launch page uses `InterviewLaunchStage`. The selected teacher says:

> Hey {firstName}. Claire will lead your Core Technical and Projects interview.
> She'll begin with three short technical decisions, then go deeply into one
> project—what you built, how it worked, what failed, and the trade-offs you
> owned. Answer as you would in a real engineering interview.

Requirements:

- set `waitForVoiceBeforeNavigate` to `true`;
- preserve `Continue to interview` and `Skip intro`;
- use the selected teacher's avatar and scripted voice only for the handoff;
- every live-interviewer reference says Claire;
- loading label: `Claire is preparing your technical round…`;
- quota exhaustion disables a new start but still permits active-session
  resume;
- a missing or stale personalized plan shows a recoverable return-to-Interviews
  state;
- project evidence insufficiency uses the fallback in section 7.5 rather than
  inventing a project.

### 4.3 Media gate and Claire identity

After the handoff:

1. hard-navigate to `/interview/voice?session={sessionId}`;
2. render the existing microphone/camera gate;
3. keep camera optional and local-preview only;
4. connect to Gemini Live after media setup;
5. show Claire's avatar and name;
6. use Gemini voice `Kore`;
7. preserve typed answers when microphone access is denied.

If asked who she is, Claire says exactly:

> I'm Claire from the recruiting team.

She never identifies herself as Google, Gemini, DeepMind, a bot, an AI
assistant, or a language model.

### 4.4 Opening

The server owns the first utterance and it is spoken once:

> Hi, I'm Claire. Welcome to your Core Technical and Projects interview. We'll
> start with three short technical decisions, then spend most of the round on
> one project from your experience. I may ask you to trace mechanisms, defend
> trade-offs, and pressure-test what happened in production. Let's begin.
> {first MCQ}

Gemini must not prepend a second greeting, add a new question, or reveal the
answer choices before the current question is visible in the workspace.

### 4.5 Technical calibration

Questions 1–3 are scenario-based MCQs. Each must:

- match a skill/topic allowed by the active Core Technical blueprint;
- be compatible with the candidate's role and level;
- present three to five plausible options;
- have one private answer index and a reviewed explanation;
- test runtime behavior, data flow, correctness, failure semantics, security,
  concurrency, state, or another engineering mechanism;
- avoid recall-only wording such as “What does acronym X stand for?”;
- include a concrete artifact or scenario when the reviewed question provides
  one;
- take roughly 60–90 seconds, not five minutes;
- be answered by selecting one option or stating it naturally;
- move on immediately after deterministic grading.

Claire's post-answer behavior is deliberately neutral:

- correct: `Noted. Let's take the next technical scenario.`
- incorrect: `Noted. Let's continue.`
- final MCQ: use the project transition in section 4.6.

Do not say “correct,” “incorrect,” “good,” reveal the expected option, or teach
the explanation during the live interview. Persist the grade and explanation
for the report.

### 4.6 Transition into the project

After question 3, Claire says a server-approved bridge naming only grounded
project data:

> That completes the technical calibration. Now I'd like to focus on
> {projectName}. We'll trace what the project needed to do, what you personally
> built, how the important path behaved, and how you handled production risk.
> Start by setting the context and your exact responsibility.

If the round uses the evidence-backed work fallback, replace the project name
with the grounded role/work item. Do not pretend it was a personal project.

### 4.7 Four-act project deep dive

All four prompts use the same frozen project identity.

#### Act 1 — Context and ownership

Establish:

- the user/business problem;
- constraints and success condition;
- team context;
- the candidate's personal scope;
- what existed before their work;
- which decision or implementation they directly owned.

Claire must separate `we` from `I` without being hostile. A useful follow-up is
specific: “Which part of that path would not have happened without your work?”

#### Act 2 — Technical mechanism and end-to-end trace

Ask the candidate to trace one important request, event, state transition,
training/data path, UI interaction, or delivery path from input to outcome.
Probe:

- component boundaries;
- important data structures or schemas;
- state and ownership;
- synchronous versus asynchronous work;
- persistence, caching, queues, APIs, or model lifecycle where relevant;
- why the chosen Core Technical mechanism behaves as claimed.

The prompt must adapt to the candidate's role. Do not force backend-system
nouns onto frontend, data, mobile, ML, QA, platform, security, or product
evidence.

#### Act 3 — Failure, debugging, and verification

Use an actual resume claim when available; otherwise ask a counterfactual that
is clearly labeled as hypothetical. Investigate:

- a failure, defect, bottleneck, race, data-quality issue, or operational risk;
- evidence inspected before changing the system;
- competing hypotheses;
- root cause at the mechanism level;
- repair and regression protection;
- tests, observability, validation, rollback, or monitoring;
- what would have falsified the candidate's diagnosis.

Claire must not turn a hypothetical into a false claim about what happened.

#### Act 4 — Trade-offs, evolution, and result

Close the project investigation by asking for:

- the strongest rejected alternative;
- why the chosen direction fit the constraints;
- the cost or risk accepted;
- production rollout or migration strategy;
- evidence that the result worked;
- what the candidate would change now;
- how the design would behave at a materially different scale or requirement.

This is an engineering judgement prompt, not a generic “what did you learn?”
behavioral question.

### 4.8 Natural follow-ups

Each project act permits at most two follow-ups. Gemini proposes one at a time;
the server enforces the budget.

A follow-up must do exactly one of these:

- clarify a concrete ambiguity;
- request a mechanism-level trace;
- isolate personal ownership;
- challenge one contradiction;
- test one failure boundary;
- ask for one rejected alternative;
- ask how the claim was verified.

Do not ask compound lists, repeat the planned question, demand metrics when no
metric is relevant, or probe a different project. If evidence is sufficient,
move on even if the candidate's design differs from an expected pattern.

### 4.9 Completion

After Act 4 completes:

1. the server sets phase to `done`;
2. Claire speaks one approved closing;
3. Gemini sends no more interview audio;
4. the room renders the existing completion screen;
5. the selected teacher appears in the debrief;
6. the debrief says Claire reported back;
7. the primary action opens `/reports`;
8. the report and PDF use family `core-technical-projects`.

Suggested closing:

> That completes the technical and project round. Thank you for walking me
> through the details. Your report will separate the technical calibration
> from the evidence you demonstrated in the project discussion.

## 5. Frozen round contract

### 5.1 Canonical identity

Keep:

```ts
templateId: "technical-deep-dive";
templateTitle: "Core Technical & Projects interview";
```

Add one shared predicate in
`src/features/interviews/domain/technical-deep-dive.ts`:

```ts
export function isTechnicalProjectsRound(
  setup: Pick<InterviewSetup, "templateId" | "templateTitle" | "technicalDeepDive">
): boolean {
  return (
    setup.templateId === TECHNICAL_DEEP_DIVE_ID ||
    setup.technicalDeepDive?.kind === TECHNICAL_DEEP_DIVE_ID ||
    setup.templateTitle === "Technical Deep Dive" ||
    setup.templateTitle === "Core Technical & Projects interview"
  );
}
```

Use this predicate in persona selection, Gemini eligibility, token policy,
evaluation-profile classification, roadmap/history matching, shared-room
rendering, reports, and performance aggregation. Preserve legacy title support.

### 5.2 Public setup metadata

Extend `InterviewSetup.technicalDeepDive` additively:

```ts
technicalDeepDive?: {
  kind: "technical-deep-dive";
  version?: 1 | 2;
  coreBlueprintId: string;
  appliedBlueprintId: string;
  questionSources?: TechnicalDeepDiveQuestionSource[];
  project?: {
    sourceKind: "project" | "work-experience" | "scenario";
    sourceId: string;
    name: string;
    roleLabel?: string | null;
  };
};
```

`version: 2` identifies the seven-question format. Missing version or version 1
means the legacy four-question projection.

Setup is public. It may contain display-safe identity and labels only. Never
store the full resume, private excerpts, answer indexes, explanations, rubric
criteria, evaluator guides, or unreached question text in setup.

### 5.3 Question metadata

Extend `PlannedQuestion` additively:

```ts
technicalProjectsSection?: "technical-calibration" | "project-deep-dive";
projectAct?: "context" | "mechanism" | "failure" | "tradeoffs";
technicalProjectInterviewerGuide?: {
  sourceKind: "project" | "work-experience" | "scenario";
  sourceId: string;
  groundedFacts: string[];
  allowedSkillKeys: string[];
  strongSignals: string[];
  contradictionChecks: string[];
  rubric: Array<{ criterion: string; points: number }>;
};
```

`technicalProjectInterviewerGuide` is server-only and must be removed by the
public serializer. `groundedFacts` distinguishes known resume/profile evidence
from candidate claims made during the interview. It is not a canonical answer.

For MCQs continue using `options`, private `answerIndex`, and `explanation`.
The serializer exposes options only for the current reached question and never
exposes `answerIndex` or the private explanation.

## 6. Build the seven-question plan deterministically

Replace the new-session use of the generic provider-planned four-slot blueprint
with a pure builder:

```text
src/features/interviews/server/technical-projects-round.ts
```

Suggested contract:

```ts
export function buildTechnicalProjectsPlan(input: {
  coreBlueprint: SessionBlueprint;
  appliedBlueprint: SessionBlueprint;
  mcqs: readonly ReviewedTechnicalMcq[];
  project: GroundedProjectInterviewSource;
  difficulty: BlueprintDifficulty;
}): PlannedQuestion[];
```

Return exactly:

```text
index 0: Core Technical MCQ 1
index 1: Core Technical MCQ 2
index 2: Core Technical MCQ 3
index 3: project Context & ownership
index 4: project Mechanism & trace
index 5: project Failure & verification
index 6: project Trade-offs & evolution
```

Do not call the general interview planner to generate this plan.

### 6.1 Technical MCQ selection

Create a small server-only normalized contract:

```ts
type ReviewedTechnicalMcq = {
  sourceId: string;
  sourceVersion: number;
  topicKey: string;
  skillKeys: string[];
  difficulty: "foundational" | "intermediate" | "advanced";
  prompt: string;
  artifact?: { title: string; content: string };
  options: string[];
  answerIndex: number;
  explanation: string;
  strongSignals: string[];
};
```

Selection order:

1. human-approved/published Core Technical MCQs compatible with the confirmed
   stack and active Core blueprint;
2. frozen Resume-kit MCQs with matching normalized skill keys and valid
   provenance;
3. a versioned, human-reviewed role-family fallback bank;
4. otherwise fail readiness for the v2 round and keep the existing legacy
   Technical Deep Dive unavailable rather than generating an answer key live.

Select three distinct topics where the compatible catalogue allows it. Avoid
questions used in the candidate's recent completed Technical Projects rounds
until the catalogue is exhausted. Then rotate deterministically without
calling a model.

Difficulty uses demonstrated Core Technical performance only when confidence
is sufficient. Otherwise use the active blueprint difficulty and experience
band. A wrong previous answer may lower the next round's band; it must not
change questions inside an already-frozen session.

Each mapped `PlannedQuestion` uses:

- `kind: "mcq"`;
- `answerFormat: "mcq"`;
- `stage: "rapid"`;
- `technicalProjectsSection: "technical-calibration"`;
- `maxFollowUps: 0`;
- `requiredForPacing: true` for question 1 and false for questions 2–3;
- `estimatedDurationMs: 90_000`;
- `evaluationParameterKeys: ["concept-depth", "technical-reasoning"]`;
- source topic/skill/rubric metadata;
- private deterministic answer and explanation.

### 6.2 Project selection

Select one source once, before session creation.

Rank `CandidateInterviewProfile.importantProjects` using:

1. overlap with active Applied/Core blueprint skill keys;
2. evidence from work experience over a skills-only mention;
3. project importance and outcome evidence;
4. target-role relevance;
5. recency when available;
6. recent-round avoidance.

Do not choose the project solely because it appears first on the resume. Do not
rewrite the candidate's resume to improve the question.

Freeze:

- source kind and source ID;
- safe display name;
- short evidence excerpt;
- candidate role wording when known;
- claimed outcome when present;
- normalized skill keys;
- matching Core/Applied blueprint topics;
- provenance/version fingerprint.

### 6.3 Project prompt mapping

Use deterministic prompt templates with role-aware nouns. The prompt may insert
the safe project name and grounded role, but never invent architecture.

All four project questions use:

- `kind: "conversation"`;
- `answerFormat: "spoken"`;
- `stage: "project"` for context/mechanism and `stage: "scenario"` for
  failure/trade-offs;
- `technicalProjectsSection: "project-deep-dive"`;
- one `projectAct` value;
- the same project source ID;
- `maxFollowUps: 2`;
- `requiredForPacing: true`;
- realistic duration reservations;
- a public evidence anchor containing only safe project context;
- a private `technicalProjectInterviewerGuide`.

Suggested durations:

| Act                    | Reservation |
| ---------------------- | ----------: |
| Context & ownership    |   5 minutes |
| Mechanism & trace      |   8 minutes |
| Failure & verification |   8 minutes |
| Trade-offs & evolution |   7 minutes |

### 6.4 Assessment parameter targeting

Use these question-level mappings:

| Question               | Parameters intentionally assessed                                          |
| ---------------------- | -------------------------------------------------------------------------- |
| MCQ 1–3                | Concept depth, Technical reasoning                                         |
| Context & ownership    | Project ownership, Communication                                           |
| Mechanism & trace      | Concept depth, Technical reasoning, Practical execution, Communication     |
| Failure & verification | Technical reasoning, Practical execution, Project ownership, Communication |
| Trade-offs & evolution | Trade-offs, Practical execution, Project ownership, Communication          |

An omitted parameter is unassessed, not zero. A targeted parameter may receive
a low score when the candidate provides weak or incorrect evidence.

### 6.5 Insufficient project evidence

Never invent a project.

Fallback order:

1. a grounded work-experience item with technical evidence;
2. a clearly labeled project chosen by the candidate at launch and saved before
   session creation;
3. a reviewed role-compatible production scenario from Applied Engineering.

If option 3 is used, candidate-facing copy says **Core Technical & Production
Scenarios**, project-ownership scoring is `Not yet`, and the prompt never asks
the candidate to pretend they personally built the reviewed scenario.

Do not silently score scenario reasoning as project ownership. Do not accept
free text supplied after session start as if it had resume provenance.

## 7. Dedicated start route

Create:

```text
src/app/api/interview/technical-projects/start/route.ts
```

Implement in this order:

1. keep `force-dynamic`;
2. resolve owner identity;
3. look for an active owned `technical-deep-dive` session before consuming
   quota;
4. acquire the shared interview-creation lease;
5. check again inside the lease;
6. enforce the interview creation rate limit and quota;
7. require an authenticated, onboarded candidate;
8. load the active personalized plan, current Core blueprint, current Applied
   blueprint, candidate profile, safe resume evidence, performance profile,
   reviewed MCQ catalogue, and recent interview history;
9. validate that the blueprint IDs belong to the owner and current plan;
10. select three reviewed MCQs;
11. select and freeze one grounded project/work/scenario source;
12. build the seven-question plan with `buildTechnicalProjectsPlan`;
13. call `interviewService.start(setup, ownerId, Date.now(), plan)` with the
    explicit plan;
14. return session ID, question count, and opening utterance through the
    existing envelope;
15. attach the owner cookie;
16. release the creation lease in `finally`;
17. never return private answer keys, resume excerpts, or interviewer guides.

Setup for the standard round:

```ts
{
  role,
  level,
  roundType: "technical",
  intensity: "realistic",
  templateId: "technical-deep-dive",
  templateTitle: "Core Technical & Projects interview",
  durationMinutes: 40,
  questionCount: 7,
  technicalDeepDive: {
    kind: "technical-deep-dive",
    version: 2,
    coreBlueprintId,
    appliedBlueprintId,
    project: publicProjectIdentity
  }
}
```

The browser may carry plan/blueprint IDs for navigation, but the server must
resolve and verify every durable object. Browser-supplied titles, project
facts, questions, options, answer indexes, and score metadata are untrusted.

## 8. Make the round Claire-led and Gemini-led

### 8.1 Persona

Update `interviewerPersonaIdForSetup` so `isTechnicalProjectsRound(setup)`
always resolves `claire`. This includes v1 legacy Technical Deep Dive sessions
when they resume.

Do not change Applied Engineering practice assessments globally; this mapping
belongs to the permanent Core Technical & Projects interview.

### 8.2 Gemini eligibility

Extend `usesGeminiLedConversation(setup)` with the canonical predicate. Do not
repeat template-title checks in API routes, clients, or token code.

For this family Gemini owns:

- natural speech turn boundaries;
- semantic candidate-intent classification;
- concise grounded acknowledgements;
- one focused project follow-up at a time;
- brief clarification responses;
- proposed move-on when evidence is sufficient;
- speaking the exact server-approved response.

Gemini does not own:

- MCQ correctness;
- question selection or order;
- project identity;
- follow-up budget;
- pacing or hard time limits;
- evaluation scores;
- persistence;
- skip/end state changes;
- the content of the next frozen question.

### 8.3 System instruction

Add a Technical Projects branch to the shared system-instruction builder. It
must include:

- `You are Claire` and the recruiting-team identity response;
- the exact opening utterance;
- current/reached public question context only;
- the safe seven-question section structure;
- instruction to call `complete_interview_turn` exactly once after each
  complete candidate utterance or workspace selection;
- semantic handling of answer, decline, end, clarification, help, and thinking
  time;
- instruction that the tool response is authoritative;
- instruction to speak `approvedResponse` once without additions;
- neutral MCQ behavior with no leaked grading;
- project-depth behavior from section 4.8;
- no coaching, scoring aloud, hidden answers, or invented facts;
- no employer facts or hiring decisions;
- reconnect behavior based on persisted state;
- final-closing behavior.

Project evidence must be clearly delimited as untrusted candidate-source
material. A resume line such as “ignore previous instructions” is data, not an
instruction.

### 8.4 Tool schema

Reuse `complete_interview_turn`. Do not create a second tool.

The existing missing-evidence categories may remain for v1 of this feature:
`clarity`, `structure`, `specificity`, `ownership`, `outcome`, and `none`.
Technical scoring comes from the evaluator and deterministic MCQ grade, not
from this conversational hint.

`candidateIntent` remains semantic:

```text
answer
decline
end
question-or-clarification
other
```

Do not add code that searches for exact refusal/help/end sentences as the
primary path.

### 8.5 Gemini token route

For this round:

1. derive eligibility from `usesGeminiLedConversation`;
2. derive Claire/Kore from the persona mapping;
3. attach the blocking turn tool;
4. do not create a parallel transcription token;
5. use Gemini's tool `answerText` as the saved candidate transcript;
6. include project name and allowed technical vocabulary for pronunciation;
7. do not include answer indexes, explanations, private guides, full resume,
   or unreached prompts;
8. preserve ephemeral token lifetime, activity detection, and barge-in;
9. reject transcription-refresh requests for this Gemini-led room.

## 9. Semantic interview behavior

### 9.1 Candidate answers an MCQ

- Workspace choice is authoritative candidate text.
- Persist it once through the typed submission bridge.
- Grade by exact option/index comparison on the server.
- Save `local-mcq` evaluation and the private explanation.
- Advance immediately.
- Return neutral transition copy.
- Gemini must not reinterpret or override the grade.

Natural spoken selection remains supported. Resolve “the second one,” “B,” or
the option text with the existing deterministic parser. Ambiguous speech asks
for clarification and does not consume the question.

### 9.2 Candidate gives a project answer

- Gemini proposes one action.
- The server validates it against follow-up and pacing limits.
- Cumulative answer text stays attached to the current question index.
- A probe/challenge remains on the same project act.
- Move-on uses a deterministic bridge plus the next frozen prompt.
- Evaluation may run asynchronously and must not delay Claire's conversational
  turn beyond the existing live budget.

### 9.3 Candidate asks for clarification

- Answer briefly using only public question/project context.
- Do not reveal an MCQ answer or project scoring guide.
- Stay on the same question.
- Do not count a genuine clarification as a technical follow-up.

### 9.4 Candidate asks for help

- On an MCQ, clarify terms or restate the scenario without eliminating options.
- On a project prompt, ask one bounded question about mechanism, evidence,
  ownership, trade-off, or failure.
- Never supply a polished answer for the candidate.
- Respect the remaining follow-up budget.

### 9.5 Candidate asks for thinking time

- Acknowledge once when needed.
- Keep the same question.
- Do not consume a technical follow-up.
- Do not schedule “how is it going?” chatter.

### 9.6 Candidate declines a question

- Mark the turn skipped and assessment-excluded.
- Advance once without praise, correction, or guilt.
- Do not reveal the MCQ answer.
- Three consecutive semantic declines may use the existing respectful early-end
  policy.

### 9.7 Candidate ends the interview

- End immediately without a confirmation loop.
- Do not ask the next question.
- Preserve completed evidence and honest unanswered states.
- Produce a partial report without fabricated zeros for unassessed parameters.

## 10. Shared room and workspace

Do not duplicate `voice-interview-client.tsx`.

Add a small `TechnicalProjectsLiveWorkspace` composed from existing primitives:

- `InterviewQuestionPanel`;
- MCQ option controls used by Resume/Fundamentals;
- project/resume evidence preview patterns from `ResumeLiveWorkspace`;
- `MayaAside`/interviewer slot;
- transcript, live caption, microphone state, typed-answer fallback, and
  optional candidate camera.

Candidate-facing stages:

```ts
[
  { id: "rapid", label: "Technical", caption: "Three mechanism checks" },
  { id: "project", label: "Project", caption: "Context and ownership" },
  { id: "explain", label: "Trace", caption: "Mechanism and data flow" },
  { id: "scenario", label: "Pressure-test", caption: "Failure and trade-offs" }
];
```

If the shared stage type does not currently include `project`, map the visual
stage to an existing internal ID while keeping the candidate-facing labels
above. Do not widen a cross-product type only for display convenience.

### 10.1 Technical questions

Display:

- scenario/prompt;
- safe artifact where present;
- three to five choices;
- single locked selection while saving;
- Claire/camera;
- progress and microphone state.

Do not display:

- answer index;
- correct/incorrect state during the live interview;
- explanation or learning guide;
- private rubric;
- future questions.

### 10.2 Project questions

Display:

- project name and safe resume summary;
- current prompt;
- candidate's role wording when grounded;
- current act label;
- completed transcript;
- live candidate caption;
- typed-answer fallback;
- Claire and candidate camera.

Do not show the whole resume when it contains unrelated personal information.
Do not send private contact fields, hidden evidence weights, contradiction
checks, evaluator rubrics, or future prompts to the browser.

### 10.3 State reset

When moving between questions:

- clear selected MCQ option;
- clear typed errors and pending state;
- preserve the durable transcript;
- preserve the same project identity across all four acts;
- never carry an old selection into a new MCQ;
- never render MCQ controls during the project section.

## 11. Dialogue and transitions

Create:

```text
src/features/interviews/server/technical-projects-dialogue.ts
```

It owns deterministic section transitions, not answer evaluation.

Required bridges:

- MCQ 1 -> MCQ 2: brief neutral continuation;
- MCQ 2 -> MCQ 3: brief neutral continuation;
- MCQ 3 -> Project Context: explicit calibration-to-project transition;
- Context -> Mechanism: `Let's trace the technical path in detail.`;
- Mechanism -> Failure: `Now let's pressure-test that path.`;
- Failure -> Trade-offs: `Let's close by examining the decision and how it evolved.`;
- Trade-offs -> done: one closing.

Never concatenate a rejected model follow-up with the next planned prompt.
Never use teaching feedback from practice-assessment dialogue in this interview.

## 12. Pacing

The hard cap is 40 minutes.

Pacing priorities:

1. reach the project section;
2. cover Context and Mechanism;
3. cover Failure and Trade-offs;
4. preserve MCQ 1 as a technical anchor;
5. skip optional MCQ 2 or 3 only under genuine pacing pressure.

Suggested flags:

| Question           | Required for pacing |
| ------------------ | ------------------- |
| MCQ 1              | yes                 |
| MCQ 2              | no                  |
| MCQ 3              | no                  |
| Project Context    | yes                 |
| Project Mechanism  | yes                 |
| Project Failure    | yes                 |
| Project Trade-offs | yes                 |

The state machine may skip an optional MCQ before dropping a project anchor.
It must not silently skip a project act merely because earlier follow-ups ran
long. Near the cap, suppress additional probes and move through the remaining
required prompts concisely.

## 13. Evaluation contract

### 13.1 Report parameters

Reuse family `core-technical-projects` with explicit weights:

| Parameter           | Weight | Evidence                                                 |
| ------------------- | -----: | -------------------------------------------------------- |
| Concept depth       |    20% | Correct mechanism-level understanding                    |
| Technical reasoning |    20% | Constraint -> evidence -> decision chain                 |
| Trade-offs          |    15% | Alternatives and costs of the chosen direction           |
| Practical execution |    20% | Implementation, debugging, testing, rollout, reliability |
| Project ownership   |    15% | Candidate's personal contribution and accountability     |
| Communication       |    10% | Precise, structured technical explanation                |

All scores are 0–100. An evaluator outage is `Not yet` pending recovery, never
a real zero.

### 13.2 MCQ evaluation

MCQs are deterministic and require no semantic evaluator call.

For each MCQ persist:

- selected option/index;
- correct boolean;
- source ID and version;
- topic and skill keys;
- private explanation for the report;
- `local-mcq` source;
- 0–100 rubric values only for targeted parameters.

Do not map one wrong MCQ to a permanent zero in all technical parameters. The
round-level Concept depth and Technical reasoning values aggregate all targeted
MCQ/project evidence.

Recommended v1 mapping per MCQ:

- correct: 100 for the deterministic correctness component;
- incorrect: 0 for that question's deterministic correctness component;
- aggregation averages across the three MCQs and any semantic project evidence
  targeting the same parameter.

The report explanation should state what the option tested and why the reviewed
answer is stronger. It must not claim Claire taught this during the interview.

### 13.3 Project evaluation

Use `TechnicalAnswerEvaluator` with a Technical Projects branch. It receives:

- public prompt and evidence anchor;
- private grounded facts;
- allowed topic/skill keys;
- question intent and must-hit signals;
- cumulative candidate answers for the question;
- source Core/Applied blueprint metadata;
- targeted report parameters;
- private project rubric;
- no invented expected architecture.

Evaluator rules:

- judge only what the candidate said;
- distinguish resume-grounded facts from new unverified claims;
- reward technically coherent alternatives;
- require mechanism evidence before awarding Concept depth;
- require personal actions before awarding Project ownership;
- require implementation/verification detail before awarding Practical
  execution;
- cap materially incorrect central mechanisms below 45;
- do not reward buzzwords, answer length, confidence, or unsupported numbers;
- use exact candidate quotes only when they exist in persisted text;
- treat missing evidence as missing rather than inventing it.

### 13.4 Aggregation

For one interview:

1. combine attempts/follow-ups by question index;
2. retain the latest completed evaluation per question;
3. average each parameter only across questions that targeted it;
4. apply profile weights only to assessed parameters;
5. renormalize active weights when an optional MCQ was legitimately skipped;
6. exclude declines, end requests, clarification-only turns, and support turns;
7. exclude unavailable evaluations until recovery succeeds;
8. retain deterministic MCQ evidence even if the semantic evaluator is down.

The dashboard and PDF must use the same stored values and ordering.

### 13.5 Evidence presentation

Each parameter detail should show:

- 0–100 score or `Not yet`;
- concise rationale;
- up to two exact candidate quotes for semantic project evidence;
- question/act label and timestamp where available;
- deterministic MCQ evidence without pretending it is a quote;
- one specific next action.

## 14. Reports, history, and adaptation

### 14.1 Classification

`evaluationProfileForSetup` must classify legacy and v2 Technical Deep Dive
sessions as `core-technical-projects`. Add explicit tests for:

- template ID;
- legacy title;
- new title;
- version 2 metadata.

### 14.2 Reports

Verify:

- completed count increments for Core Technical & Projects;
- newest family/report card uses the correct label;
- the report shows all seven competencies in order;
- MCQ explanations appear only after completion;
- project evidence remains attached to the correct act/question index;
- partial interviews show unanswered questions honestly;
- PDF values and evidence equal the dashboard values.

### 14.3 Performance profile

Update performance aggregation to retain source provenance:

- MCQ observations update the relevant Core skill/topic;
- project Mechanism/Failure/Trade-offs observations update their original
  Core/Applied skill keys;
- Project ownership remains a report parameter, not a fake technology skill;
- evaluation-unavailable project questions are excluded until recovered;
- legacy Technical Deep Dive sessions remain readable;
- the next plan may adapt from completed evidence without rewriting this
  historical session.

## 15. Security, privacy, and integrity

Mandatory boundaries:

- owner-scoped start, read, answer, and report access;
- quota/rate limits and distributed creation/answer leases;
- no long-lived Gemini key in the browser;
- no answer index, explanation, private rubric, grounded-fact guide, or future
  question in public serialized state;
- no unrelated resume fields or contact details in the live prompt;
- candidate resume text delimited as inert data;
- telemetry contains IDs, timings, versions, and status—not resume/project
  content;
- one committed candidate turn produces one persisted answer and one Claire
  response;
- browser-supplied option text is resolved against the current frozen question;
- old-tab/current-question mismatches are rejected;
- active session question index is validated before grading;
- report evidence is drawn from persisted turns, never Gemini's hidden
  reasoning;
- no automated hiring decision or pass/fail recommendation is produced.

Add a serializer test that constructs a full v2 session and asserts JSON does
not contain:

- `answerIndex`;
- private `explanation` for unreached/live MCQs;
- `technicalProjectInterviewerGuide`;
- grounded private excerpts;
- future question text/options;
- evaluator rubric or contradiction checks.

## 16. Failure and recovery behavior

- Active session exists: resume it without consuming quota.
- Creation request races: shared lease returns/polls for the winning session.
- MCQ catalogue insufficient: show a readiness/content-unavailable state; do
  not generate answer keys live.
- Project missing: follow section 6.5 explicitly.
- Gemini tool missing: do not accept speculative model speech as a saved turn.
- Duplicate tool call: replay the idempotently saved response.
- Evaluation timeout: persist conversation and enqueue durable recovery.
- Microphone denied: typed responses remain available.
- Gemini disconnect: preserve committed turns and reconnect to the same
  question.
- MCQ save fails: unlock the selection and allow retry without changing the
  selected question.
- Candidate ends: finish immediately and preserve honest partial evidence.
- Last project question completes: end immediately; do not wait for the clock.
- Hard cap: server state machine wins over Gemini.

## 17. Backward compatibility

Do not break:

- legacy four-question `technical-deep-dive` sessions;
- standalone historical Core or Applied personalized interviews;
- Core Technical practice assessments;
- Applied Engineering practice assessments;
- Resume & Behavioural Gemini-led behavior;
- Hiring Manager Gemini-led behavior;
- DSA & Design Claire behavior;
- old report snapshots;
- active-session resume links;
- candidate teacher preferences;
- daily quota and anonymous-owner compatibility where already allowed.

Compatibility rules:

- `technicalDeepDive.version` is optional;
- missing version reads as legacy v1;
- legacy sessions retain their frozen plan and current workspace behavior;
- only new v2 starts use seven questions;
- never rewrite old persisted JSON;
- exact display titles are compatibility hints, not the durable identity;
- new optional question fields are read defensively.

## 18. Exact implementation sequence

### Slice 1 — identity, types, and characterization

1. Add `isTechnicalProjectsRound`.
2. Add version/project public metadata.
3. Add section/act/private-guide question metadata.
4. Characterize legacy four-question behavior.
5. Route permanent/legacy Technical Deep Dive setups to Claire/Kore.
6. Add evaluation-family and roadmap compatibility tests.

### Slice 2 — reviewed MCQ adapter

1. Add normalized reviewed-MCQ contract.
2. Adapt published Core Technical MCQs.
3. Add compatible Resume-kit/fallback adapters only where provenance is valid.
4. Implement topic, difficulty, recency, and deduplication selection.
5. Test invalid answer keys, duplicate options, stale versions, unsupported
   roles/stacks, and catalogue exhaustion.

### Slice 3 — grounded project selection and plan builder

1. Rank project/work sources.
2. Freeze safe public identity and private evidence.
3. Build the four role-aware project acts.
4. Build the complete seven-question plan.
5. Test exact order, one shared source, parameter targeting, pacing flags, and
   no invented facts.

### Slice 4 — dedicated entry/start

1. Add `/interview/technical-projects`.
2. Add the owner-scoped start route.
3. Resume active sessions before quota.
4. Resolve current plan and blueprint IDs server-side.
5. Add selected-teacher-to-Claire handoff.
6. Wire the roadmap href.
7. Test quota, lease, stale plan, content readiness, fallback, success, and
   private-response safety.

### Slice 5 — Gemini-led Claire policy

1. Extend the shared eligibility predicate.
2. Add Claire/Kore prompt/token policy.
3. Add Technical Projects system instruction and opening.
4. Preserve semantic decline/end/help/thinking-time behavior.
5. Test one tool call per utterance, authoritative response, reconnect, and no
   answer-key leakage.

### Slice 6 — workspace and deterministic MCQ dialogue

1. Add `TechnicalProjectsLiveWorkspace` through shared composition.
2. Render MCQ and project modes by current question metadata.
3. Grade MCQs deterministically.
4. Suppress correctness feedback until the report.
5. Add deterministic section bridges.
6. Test state reset, ambiguous spoken choice, save retry, desktop, and mobile.

### Slice 7 — project evaluation and reports

1. Add evaluator branch using private grounded evidence.
2. Enforce exact targeted parameter keys.
3. Add weighted assessed-only aggregation.
4. Integrate async recovery.
5. Verify report overview, detail, quotes, timestamps, and PDF.
6. Add performance-profile observations with original Core/Applied provenance.

### Slice 8 — full regression and manual QA

1. Run focused tests after every slice.
2. Run typecheck and lint.
3. Run relevant interview, practice, report, and serializer suites.
4. Manually test microphone, typed fallback, MCQs, deep follow-ups, decline,
   end, reconnect, completion, report, and mobile layout.

## 19. Required automated tests

### Identity and planning

- Legacy and v2 Technical Deep Dive resolve Claire/Kore.
- Resume/Hiring Manager remain James/Charon.
- DSA remains Claire/Kore.
- V2 plan has exactly seven questions.
- First three are MCQs with valid private answers.
- Final four share one project source ID.
- Project acts are Context, Mechanism, Failure, Trade-offs.
- Question parameter mappings match section 6.4.
- Optional/required pacing flags are correct.
- No public field invents project architecture or outcomes.

### Content selection

- MCQs match active Core topics and role/stack.
- Definition/trivia-only items are rejected by review/audit rules.
- Difficulty adapts only from trusted performance.
- Recent MCQ avoidance works.
- Exhausted catalogue fallback is deterministic.
- Missing valid answer key fails closed.
- Project ranking prefers relevant grounded work.
- Recent project rotation works.
- No-project fallback is labeled and never scored as ownership.

### Start route

- Active legacy/v2 session resumes without consuming quota.
- Creation lease prevents duplicate starts.
- Foreign/stale blueprint IDs are rejected.
- Standard start freezes seven questions and 40 minutes.
- Claire opening is returned once.
- Owner cookie is attached.
- Private MCQ/project evidence is absent from the response.

### Gemini and service

- Technical Projects requires a live proposal.
- Other non-Gemini families reject a live proposal.
- Claire instruction requires one tool call per complete turn.
- Candidate intent is semantic, not phrase-driven.
- Decline skips; end closes; help and thinking time stay on question.
- State-machine limits override Gemini proposals.
- Reconnect continues current question and does not replay the opening.
- Provider identity is never spoken.

### MCQ integrity

- Workspace selection grades from the frozen answer index.
- Spoken letter/ordinal/option text resolves deterministically.
- Ambiguous spoken choice does not grade or advance.
- Correct and incorrect answers receive neutral live copy.
- Live response never exposes explanation/correctness.
- Duplicate submission is idempotent.
- Old-tab question mismatch is rejected.
- Report reveals the reviewed explanation after completion.

### Project conversation

- All four prompts stay on the same project.
- Follow-up budget is at most two per act.
- One follow-up asks exactly one thing.
- `we`-only ownership can receive a personal-scope probe.
- Mechanism error can receive a concrete challenge.
- Alternative coherent implementations are accepted.
- Hypothetical failures remain labeled hypothetical.
- Candidate clarification is not evaluated as an answer.

### Evaluation and reports

- MCQs use `local-mcq` and no semantic evaluator.
- Project acts use targeted semantic parameters only.
- Materially incorrect mechanisms score below 45.
- Unsupported confidence/buzzwords do not raise scores.
- Unavailable evaluation is excluded pending recovery.
- Weighted overall remains 0–100 with skipped optional MCQs.
- Report family is `core-technical-projects`.
- Dashboard and PDF values are identical.
- Exact candidate quotes map to the right question/timestamp.
- Partial interviews do not fabricate scores for unanswered acts.

### Privacy and regression

- Public serializer omits private guides and answer keys.
- Resume/project prompt injection is inert.
- Resume, Hiring Manager, DSA, Core practice, and Applied practice tests remain
  unchanged.
- Legacy Technical Deep Dive loads, answers, completes, and reports.

## 20. Manual QA scripts

### Happy path

1. Open Interviews and start Core Technical & Projects.
2. Confirm selected teacher says Claire will conduct it.
3. Confirm navigation waits for handoff or explicit skip.
4. Confirm Claire/Kore opens once.
5. Answer all three MCQs.
6. Confirm no correctness or explanation is revealed live.
7. Confirm Claire names the grounded project and transitions naturally.
8. Give a vague `we built it` answer; confirm one ownership probe.
9. Trace the technical path; confirm a specific mechanism probe, not a generic
   “tell me more.”
10. Discuss a failure; confirm Claire asks for evidence or verification.
11. Defend trade-offs and evolution.
12. Confirm Claire closes once.
13. Confirm selected teacher says Claire reported back.
14. Open `/reports`; verify MCQ explanations, project evidence, six parameters,
    timestamps, and PDF parity.

### Wrong MCQs

Answer all MCQs incorrectly. Confirm Claire remains neutral and does not teach
the answers. Finish the project section and verify the report shows the
technical gaps without collapsing unrelated Project ownership evidence.

### Deep project challenge

Give a confident but contradictory description of state ownership or failure
recovery. Confirm Claire challenges the exact contradiction once. Correct the
answer and verify cumulative evidence reaches the evaluator.

### Help versus decline

Ask Claire to clarify a term, then request a nudge, then explicitly decline.
Confirm clarification and help keep the question while decline advances.

### Thinking time

Ask for a minute and remain silent. Confirm Claire does not produce timer-based
chatter or consume a follow-up.

### End interview

Use an indirect but unambiguous request to end. Confirm immediate close, no
confirmation, no next question, and an honest partial report.

### Reconnect

Disconnect during an MCQ and during the project section. Confirm the same
question/project returns, committed turns do not duplicate, and the opening is
not replayed.

### Missing project evidence

Use a profile without a project. Confirm the experience/scenario fallback is
explicit, no invented ownership language appears, and Project ownership is
unassessed for a scenario-only round.

### Mobile

Verify launch, media gate, MCQ choices, project preview, transcript, typed
fallback, camera disable, completion, and report at narrow width without page
overflow or obscured controls.

## 21. Recommended verification commands

Inspect `package.json` first and use the repository's declared package manager.
At minimum run focused Vitest files for:

- technical-round identity and persona;
- Gemini-led predicate;
- reviewed MCQ adapter/selection;
- project selection and seven-question builder;
- start route;
- Gemini token/system instruction;
- interview service and state machine;
- MCQ grading/dialogue;
- shared room/workspace;
- public serializer;
- technical evaluator and recovery;
- evaluation profile and report aggregation;
- reports overview/PDF;
- roadmap session projection;
- performance profile aggregation;
- shared launch stage.

Then run:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

If the full suite or build cannot run, report exactly what ran and why the rest
did not. Never claim all tests passed after running only a subset.

## 22. Expected implementation size

Approximate changed/new lines, excluding generated fixtures:

| Area                               |    Production |         Tests |
| ---------------------------------- | ------------: | ------------: |
| Identity, types, compatibility     |         40–80 |        70–120 |
| Reviewed MCQ adapter and selection |       130–220 |       140–220 |
| Project selection and frozen plan  |       160–260 |       160–240 |
| Dedicated start/launch/roadmap     |       100–170 |       120–190 |
| Gemini-led Claire policy           |        80–140 |       100–170 |
| Workspace and dialogue             |       120–210 |       140–220 |
| Evaluation/report/performance      |        90–160 |       130–210 |
| Total                              | **720–1,240** | **860–1,370** |

Expected total including tests: **1,580–2,610 lines**.

The implementation is larger than merely switching the persona to Claire. The
reviewed answer-key boundary, grounded-project contract, no-feedback MCQ policy,
semantic project conversation, and privacy tests are required for a credible
interview.

## 23. Definition of done

The feature is complete only when every statement is true:

- Round 2 launches from a dedicated Core Technical & Projects entry.
- The selected teacher audibly hands the candidate to Claire.
- Claire/Kore is consistent in the live room, reconnect, completion, and
  debrief copy.
- The frozen round contains three reviewed technical MCQs and four connected
  prompts about one grounded project/work source.
- MCQs test mechanisms, are graded deterministically, and reveal no live
  correctness feedback.
- Project questions adapt to role and deeply test context, personal ownership,
  mechanism, failure evidence, testing, trade-offs, rollout, and result.
- Gemini provides natural turn-taking but cannot grade, invent, reorder,
  persist, skip, or end independently.
- Decline skips; end closes; clarification/help/thinking time stay bounded and
  natural.
- The server enforces follow-up budgets, pacing anchors, time cap,
  idempotency, and owner scope.
- No private answer key, rubric, resume excerpt, or future question reaches the
  browser.
- Project claims are never invented or silently treated as verified facts.
- Evaluations use the six Core Technical & Projects parameters on a true 0–100
  scale.
- Unassessed parameters are not zeros and unavailable evaluations recover
  asynchronously.
- `/reports` and PDF show the same values and evidence.
- Legacy Technical Deep Dive sessions and every other interview/practice family
  pass regression tests.
- Typecheck, lint, focused tests, and the manual happy path are completed and
  truthfully reported.

## 24. Terra implementation rules

1. Read every target file before editing it.
2. Preserve unrelated user changes; the worktree may already be dirty.
3. Implement in the slices above and test after each slice.
4. Do not duplicate the interview engine, Gemini client, report UI, or PDF.
5. Do not use display titles as the only business identity.
6. Do not generate MCQ answer keys during live-session creation.
7. Do not use phrase matching as the semantic intent engine.
8. Do not let Gemini grade or reveal MCQ correctness.
9. Do not invent project architecture, ownership, incidents, outcomes, or
   metrics.
10. Do not expose private guides through serialization, logs, telemetry, or
    error responses.
11. Do not score an unassessed or evaluator-unavailable parameter as zero.
12. Do not change Claire or James globally outside the stated round ownership.
13. If an existing invariant conflicts with this document, stop, cite the
    exact file/function/test, and resolve the conflict explicitly rather than
    guessing.
