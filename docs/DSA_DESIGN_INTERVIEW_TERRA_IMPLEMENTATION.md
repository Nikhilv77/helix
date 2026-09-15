# DSA & Design Interview — Terra implementation handoff

Status: implementation specification  
Prepared: 16 September 2026  
Implementer: Terra  
Target round: permanent roadmap round 3, `/interview/dsa`

This document is the source of truth for implementing the permanent DSA &
Design interview. Follow it in order. Do not copy an entire Resume or Hiring
Manager implementation and do not create a second interview engine.

The repository already contains the difficult infrastructure. This work joins
the existing permanent DSA round, the reviewed Architecture & Design content,
the shared Gemini Live conversation loop, Claire's reserved interviewer
persona, and the existing interview report pipeline.

## 1. Fixed product decisions

Do not make new product decisions while implementing.

1. The candidate-facing round remains roadmap round 3 and remains reachable at
   `/interview/dsa`.
2. The round is called **DSA & Design**.
3. The live interviewer is always **Claire**.
4. Claire's Gemini Live native-audio voice is **Kore**. Do not route live-room
   speech through Deepgram and do not use the candidate's selected teacher as
   the live interviewer.
5. The candidate's selected everyday teacher gives the launch handoff. The
   handoff must explicitly say that Claire will conduct the interview.
6. The room contains two DSA coding questions followed by three connected
   design prompts from one reviewed Architecture & Design scenario.
7. The hard cap is 40 minutes. Treat it as a maximum, not a target.
8. DSA questions come first. This is deliberate because the existing
   `dsaQuestionSlugs[index]` contract is positional. Do not interleave design
   prompts between the DSA questions in this change.
9. Gemini Live understands candidate intent semantically. Never implement a
   primary `text.includes("I have no idea")` or list-of-phrases decision tree.
10. Gemini proposes conversation actions. `InterviewService` remains the only
    authority allowed to persist, advance, skip, or end a session.
11. Claire stays quiet while the candidate is actively coding. Do not add
    entertainment chatter or timer-generated questions.
12. A spoken thought during coding is not a code submission and must not
    complete the coding question.
13. A real editor submission is authoritative even if the candidate says
    nothing aloud.
14. Saying, in any natural wording, that the candidate cannot or will not
    answer skips the current question immediately.
15. Saying, in any natural wording, that the candidate wants to end the whole
    interview ends it immediately without a confirmation loop.
16. The final screen and `/reports` experience reuse the Resume interview's
    completion/debrief/report flow.
17. No database migration is expected. New optional setup/question/turn fields
    are stored inside the existing JSON interview state. If implementation
    proves this assumption false, stop and document why before adding a schema
    migration.

## 2. Do not trust outdated documentation over current code

`docs/AI_INTERVIEW_IMPLEMENTATION_HANDOFF.md` still contains older statements
such as "James is always the live interviewer." That is no longer true.
Current code in `src/features/interviews/domain/interviewer-persona.ts` is
authoritative: Claire owns DSA and Core Technical, and James owns the other
permanent interview formats.

Do not edit the old handoff as part of this feature unless a test or lint rule
requires it. The feature-specific decisions in this document win for DSA &
Design.

## 3. Existing implementation that must be reused

### 3.1 Permanent DSA round

- Entry page: `src/app/interview/dsa/page.tsx`
- Entry UI: `src/features/interviews/ui/dsa/dsa-interview-entry.tsx`
- Start route: `src/app/api/interview/dsa/start/route.ts`
- Adaptive selection: `src/features/interviews/server/dsa-session-selection.ts`
- DSA bank: `src/features/practice/dsa/domain/dsa.ts`
- Starter-code helpers:
  `src/features/practice/dsa/domain/dsa-code-templates.ts`
- Shared room: `src/features/interviews/ui/voice/voice-interview-client.tsx`
- DSA workspace: the existing `DsaLiveWorkspace` rendered by the shared room
- Code execution: `/api/code/run`

The bank currently contains 200 questions across 11 phases. Continue excluding
operation/design-only DSA slugs in `OPERATION_DSA_SLUGS` from the executable
coding selection. Do not weaken the existing ten-solved-question gate.

### 3.2 Architecture & Design material

- Approved content:
  `src/features/practice/architecture-design/domain/reviewed-scenarios.ts`
- Public catalogue:
  `src/features/practice/architecture-design/domain/scenario-ranking-catalogue.ts`
- Focus derivation:
  `src/features/practice/architecture-design/server/focus.service.ts`
- Deterministic ranking:
  `src/features/practice/architecture-design/server/scenario-ranking.service.ts`
- Existing five-prompt assessment mapping:
  `src/features/practice/architecture-design/server/assessment-blueprint.ts`
- Existing server-only expected-answer/rubric contract:
  `PlannedQuestion.storyPracticeInterviewerGuide`
- Existing design dialogue:
  `src/features/interviews/server/story-practice-assessment-dialogue.ts`

Use only human-approved artifacts exported through
`ARCHITECTURE_DESIGN_REVIEW_CANDIDATES`. Never ask a text model to invent the
design scenario at interview-start time.

### 3.3 Shared interview machinery

Reuse, do not duplicate:

- `InterviewService`
- `state-machine.ts`
- `session-store.ts`
- `/api/interview/decide`
- `gemini-live-interviewer.tsx`
- the Gemini ephemeral-token route
- technical evaluation and recovery jobs
- completion debrief
- report snapshots and `/reports`
- quota, creation lease, owner cookie, auth, retry and resume behavior

The Resume/Hiring Manager implementations are references for the Gemini-led
tool boundary, not templates to paste into new files.

## 4. Final candidate journey

### 4.1 Interviews roadmap

The card must say:

- Title: `DSA & Design`
- Purpose: `Solve coding problems and defend a system design calibrated to your experience.`
- Covers:
  - `Two DSA coding problems`
  - `Correctness, complexity, and edge cases`
  - `Requirements, architecture, reliability, and trade-offs`
- Duration: `40 min`

The card resumes an unfinished legacy `templateId: "dsa"` session or a new
combined session. Do not strand existing sessions because their old title is
`DSA practice interview`.

### 4.2 Launch page

The selected workspace teacher remains on the launch stage. The teacher says a
short scripted handoff while the session is created:

> Hey {firstName}. Claire will take your DSA and design interview. You'll solve
> two coding problems first, then defend one system design through requirements,
> architecture, trade-offs, and reliability. Think out loud when it helps, but
> Claire will give you quiet space while you code.

Requirements:

- Reuse `InterviewLaunchStage`.
- Set `waitForVoiceBeforeNavigate` to `true` so the handoff completes before
  entering the room.
- Preserve the visible `Continue to interview` and `Skip intro` controls.
- The selected teacher's avatar and configured teacher voice give the handoff.
- Every reference to the live interviewer must say Claire, never the selected
  teacher and never James.
- The loading label should be `Claire is preparing your round…`.
- If fewer than ten executable DSA questions have been solved, retain the
  readiness message and do not call the start endpoint.
- If daily quota is exhausted, retain the quota message and do not call the
  start endpoint.
- On failure, retain retry behavior and the creation-lease polling behavior in
  `startInterviewWhenReady`.

Refactor `dsa-interview-entry.tsx` rather than maintaining its duplicate launch
implementation. Its current `MayaStage`, voice effects, auth request, and retry
logic duplicate the shared launch stage and currently imply that the selected
teacher conducts the interview.

### 4.3 Media gate

After the handoff:

1. Navigate using hard replacement to
   `/interview/voice?session={sessionId}`.
2. Show the existing microphone/camera gate.
3. Camera remains optional and local-preview only.
4. Once media setup completes, connect to Gemini Live.
5. The avatar, name badge, identity response, and streamed voice must all be
   Claire.

### 4.4 Claire's opening

The first live-room utterance is server-owned and must be spoken once:

> Hi, I'm Claire. Welcome to your DSA and design interview. We'll start with
> two coding problems, then use one design scenario to discuss requirements,
> architecture, trade-offs, and reliability. Explain your approach when it
> helps, and take quiet time when you need to code. Let's begin with the first
> problem. {first question}

Do not let Gemini prepend a second greeting or append an invented question.

### 4.5 Coding questions

For each DSA problem:

1. Show the existing DSA statement, examples, constraints, editor, language
   picker, Run control, reasoning/complexity notes, and Submit control.
2. Load starter code for the selected language.
3. Keep language changes local to the active problem and reset output when the
   language changes.
4. `Run` calls `/api/code/run` with the owned `sessionId`, current
   `questionIndex`, slug, language, code, and stdin.
5. Persist execution evidence through the existing code-run path.
6. A failed run does not submit, skip, or advance the interview.
7. Claire does not automatically comment on every run result. The candidate
   gets the first opportunity to debug.
8. `Submit to Claire` sends fenced code plus the optional reasoning and
   complexity notes through the Gemini typed-submission bridge.
9. Only this trusted workspace submission can satisfy the code-submission gate.
10. The evaluator receives cumulative spoken reasoning, submitted code, and
    the latest execution evidence.
11. After the answer is complete, Claire may ask at most one targeted follow-up
    about correctness, an invariant, complexity, or an edge case.
12. After that response, the server advances to the next frozen question.

### 4.6 Coding focus behavior

Do not build an "entertain the candidate" timer.

- Claire is silent while the candidate types.
- Silence alone is not a candidate turn.
- Typing activity does not trigger a Gemini prompt.
- Claire must not produce a periodic "how is it going?" message.
- If the candidate thinks aloud, Gemini may understand and persist the words,
  but the server holds the coding question until a trusted workspace code
  submission, decline, or whole-interview end.
- If the candidate asks a direct clarification, Claire answers briefly without
  revealing a solution and returns to the same problem.
- If the candidate explicitly asks for help, Claire can ask one interviewer
  question about approach/invariant/edge case. Do not reveal a hidden answer or
  paste solution code.
- If the candidate asks for time, Claire says a short acknowledgement and then
  remains silent.
- Candidate barge-in remains enabled for Gemini-led conversation.

### 4.7 Transition into design

After coding question two is complete, the server supplies a transition. Use a
natural fixed line such as:

> That finishes the coding section. Let's move into design. I'll give you one
> scenario, and we'll develop it in three steps. Start by clarifying the scope
> and the scale assumptions you need.

The first design prompt must follow in the same approved response. Gemini must
not choose a new scenario.

### 4.8 Design section

The three prompts all refer to the same frozen reviewed scenario:

1. **Frame** — users, functional boundary, non-goals, scale assumptions, and
   measurable success/reliability goals.
2. **Design** — API/event contracts, stable identities, data model, access
   paths, consistency boundary, components, request/data flow, partitioning,
   asynchronous work, caching/backpressure, and the main trade-off.
3. **Defend** — failure isolation, recovery, SLOs, observability, security and
   privacy boundaries, overload/cost controls, rejected alternative, reversal
   evidence, and reversible evolution.

Use the generic conversation/review workspace, not the code editor. Display:

- the current prompt;
- `evidenceAnchor` containing the safe public scenario/artifact context;
- Claire and the candidate camera;
- completed transcript;
- live candidate caption;
- microphone state;
- an optional typed-answer field using the existing typed bridge.

Do not send reference answers, rubric criteria, common mistakes, private
evaluation guides, or unreached prompts to the browser.

### 4.9 Completion and report handoff

When prompt five (the third design prompt) completes:

1. `InterviewService` sets the phase to `done` immediately.
2. Claire speaks exactly one server-approved closing.
3. Gemini sends no more audio after the closing.
4. The room renders the existing `SessionStateScreen kind="complete"`.
5. The selected everyday teacher appears in the debrief.
6. The debrief says that Claire reported back.
7. The primary action links to `/reports`.
8. `/reports` loads the completed interview through the existing report store.
9. The report is classified as the existing `dsa-design` family.
10. The six displayed parameters are:
    - Problem understanding
    - Approach & reasoning
    - Correctness
    - Complexity & scalability
    - Edge cases & reliability
    - Communication
11. Evidence and quotes must come from the candidate's persisted answers, not
    hidden expected answers or generated filler.
12. The PDF continues using the same family, scores, ordering, and evidence as
    the dashboard.

## 5. Frozen round contract

Keep `templateId: "dsa"` for compatibility with active-session lookup,
roadmap/history matching, performance aggregation, and existing reports. Change
the new session title to `DSA & Design interview`.

Add a small canonical predicate rather than scattering title checks:

```ts
export function isDsaDesignRound(
  setup: Pick<InterviewSetup, "templateId" | "templateTitle" | "dsaQuestionSlugs">
): boolean {
  return (
    setup.templateId === "dsa" ||
    Boolean(setup.dsaQuestionSlugs?.length) ||
    setup.templateTitle === "DSA practice interview" ||
    setup.templateTitle === "DSA & Design interview"
  );
}
```

Place it in a neutral interview-domain module; `prompt-context.ts` is
acceptable if importing it does not cause a server/client boundary problem.
Replace exact DSA title/template comparisons in:

- `interviewer-persona.ts`
- `technical-answer-evaluator.ts`
- `interview.service.ts`
- `performance-profile-aggregator.ts`
- `interview-roadmap-sessions.ts`
- `voice-interview-client.tsx`
- relevant tests

Do not remove legacy title support.

Extend `InterviewSetup` additively:

```ts
dsaDesignRound?: {
  kind: "dsa-design-round";
  version: 1;
  designScenarioKey: string;
  designScenarioVersion: number;
  designScenarioTitle: string;
  designDifficulty: "guided" | "standard" | "stretch";
};
```

This field is public metadata only. Do not put expected answers or private
rubrics inside setup because the entire setup is serialized to the browser.

Extend `PlannedQuestion` additively:

```ts
interviewSection?: "dsa" | "design";
```

For the two DSA questions use `interviewSection: "dsa"`, `kind: "code"`,
`stage: "code"`, and `answerFormat: "typed"`.

For the three design prompts use `interviewSection: "design"`,
`kind: "conversation"`, `answerFormat: "spoken"`, and stages `rapid`,
`explain`, and `scenario` respectively. The stage names are internal reuse;
candidate-facing labels must be Frame, Design, and Defend.

## 6. Build the mixed plan deterministically

Create:

`src/features/interviews/server/dsa-design-round.ts`

Export one pure builder and small pure helpers. Suggested contract:

```ts
export function buildDsaDesignPlan(input: {
  dsaQuestions: DsaQuestion[];
  designArtifact: ArchitectureDesignReviewArtifact;
}): PlannedQuestion[];
```

The function must return exactly five questions in this order:

```text
index 0: DSA code question 1
index 1: DSA code question 2
index 2: design Frame prompt
index 3: design Design prompt
index 4: design Defend prompt
```

### 6.1 DSA mapping

Each DSA planned question includes:

- spoken prompt derived from the problem title;
- title as `evidenceAnchor`;
- `kind: "code"`;
- empty language so the candidate can choose;
- full safe problem statement in `codeTask`;
- `competency: "Algorithmic reasoning"` for question one and a more specific
  pattern label when available for question two;
- `mustHit`: approach/data structure, correctness, time complexity, space
  complexity, and important edge cases;
- one problem-specific `probeIfMissing`;
- `maxFollowUps: 1`;
- `requiredForPacing: true` for question one and false for question two;
- a realistic `estimatedDurationMs`;
- `dsaInterviewerGuide` copied from the reviewed DSA question's concepts,
  interview signals, common mistakes, follow-ups, and edge cases.

Do not put the full optimal solution or approach code in the public fields.

### 6.2 Design compression

Do not mutate or weaken the practice assessment builder. Add a separate pure
helper for the permanent round that compresses its five-stage reasoning into
three prompts:

- Frame uses the requirements/capacity source question.
- Design combines contract/data evidence with architecture/data-flow evidence.
- Defend combines reliability/security/operability with evolution/alternative
  evidence.

Every design question includes:

- safe candidate-facing text;
- safe scenario/artifact context in `evidenceAnchor`;
- a precise competency;
- public `mustHit` topics;
- one fallback probe;
- `maxFollowUps: 1`;
- `requiredForPacing: true`;
- `storyPracticeInterviewerGuide` with `practice: "architecture-design"`,
  label, server-only expected answer, and server-only rubric.

When combining two source rubrics, preserve all criteria. The decider currently
formats each rubric item as `{points}/10`; change that copy to neutral
`{points} points` or normalize the combined points. Do not falsely label a
20-point combined rubric as out of ten.

### 6.3 Scenario selection

For Backend and Full-stack candidates, use the existing focus and ranking
services:

```ts
const focus = await app.architectureDesign.focus.confirm(ownerId, {
  path: "role-aligned"
});
const selection = app.architectureDesign.ranking.rankFirstScenario(focus, {
  recentScenarioKeys,
  recentTopicKeys
});
```

Resolve the selected key against `ARCHITECTURE_DESIGN_REVIEW_CANDIDATES` and
fail closed if it is not present or not approved.

Build `recentScenarioKeys` from recent owned completed DSA & Design sessions by
reading `setup.dsaDesignRound?.designScenarioKey`. This avoids immediate
repetition. If all compatible reviewed scenarios are exhausted, retry ranking
without the recency exclusion; do not call an AI to invent a new case.

Current reviewed Architecture & Design content officially supports Backend and
Full-stack roles only. For Frontend, Data, AI/ML, and Product candidates, do not
silently pretend the reviewed backend scenarios are role-compatible. Preserve
the existing three-question DSA-only behavior until approved role-compatible
design content exists. The entry copy and duration must say DSA-only for that
fallback. This restriction is a content constraint, not a runtime limitation.

If product later approves broadening scenario role metadata, do that as a
separate reviewed-content change with content audits and tests.

## 7. Start route changes

Modify `src/app/api/interview/dsa/start/route.ts` in this order:

1. Keep `force-dynamic`.
2. Resolve the interview owner.
3. Enforce the existing creation rate limit.
4. Acquire the existing creation lease.
5. Before consuming quota, call
   `findOwnedActiveByTemplate(ownerId, "dsa")`; return that session if present.
   Match the Resume/Hiring Manager start-route behavior if the DSA route does
   not currently do this.
6. Load candidate profile, completed DSA questions, performance profile, and
   recent interview history in parallel.
7. Filter `OPERATION_DSA_SLUGS` before applying the ten-question readiness gate.
8. Select two DSA questions for a supported combined round. Keep three for the
   unsupported-role DSA-only fallback.
9. Retain solved-first selection and curated fallback behavior.
10. For Backend/Full-stack, derive and rank the design scenario.
11. Build the five-question plan with `buildDsaDesignPlan`.
12. Build setup with:
    - candidate role and level;
    - `roundType: "technical"`;
    - `intensity: "realistic"`;
    - `templateId: "dsa"`;
    - `templateTitle: "DSA & Design interview"`;
    - `durationMinutes: 40`;
    - `questionCount: 5`;
    - exactly two positional `dsaQuestionSlugs`;
    - public `dsaDesignRound` metadata;
    - a short context naming selected problems and scenario without private
      answers.
13. Call `interviewService.start(setup, ownerId, Date.now(), plan)` so the
    explicit trusted plan bypasses model planning.
14. Return `sessionId`, question count, and opening utterance using the existing
    API envelope.
15. Attach the interview-owner cookie.
16. Release the lease in `finally`.
17. Preserve current structured API errors and never expose private design
    content in error details.

Do not ask the general planner to generate mixed questions. The reviewed DSA
and design banks already contain the questions and rubrics.

## 8. Claire identity and voices

### 8.1 Persona assignment

In `interviewer-persona.ts`, keep one authoritative mapping:

```ts
claire: "Kore"
james: "Charon"
```

`interviewerPersonaIdForSetup` must resolve every legacy/new DSA & Design setup
to `claire`, including:

- `templateId: "dsa"`;
- legacy title `DSA practice interview`;
- new title `DSA & Design interview`;
- a non-empty `dsaQuestionSlugs` array;
- `dsaDesignRound.kind === "dsa-design-round"` if added to the setup shape.

Architecture practice block assessments may keep their existing interviewer
unless product explicitly changes them. This task changes the permanent
combined round, not all Architecture practice assessments.

### 8.2 Live voice versus launch/debrief voice

- Live Claire audio: Gemini Live `Kore`.
- Launch handoff: selected teacher through `useMayaVoice` and that teacher's
  configured TTS voice.
- Completion debrief: selected teacher through `useMayaVoice`.

Do not use Claire's `aura-2-athena-en` scripted persona voice inside the live
room. Do not change the user's teacher preference.

### 8.3 Identity response

If asked who she is, Claire says exactly:

> I'm Claire from the recruiting team.

She must never identify herself as Google, Gemini, DeepMind, an AI assistant, a
language model, a bot, or a virtual assistant.

## 9. Make DSA & Design Gemini-led

The current `usesGeminiLedConversation` allow-list covers Hiring Manager and
Resume. Extend the canonical predicate to include `isDsaDesignRound(setup)`.
Do not add the same template checks independently in several callers.

This change makes Gemini Live responsible for:

- semantic candidate-intent classification;
- natural turn boundaries;
- concise acknowledgements;
- clarification responses;
- proposing one focused follow-up;
- proposing move-on when sufficient evidence exists;
- delivering the exact server-approved response.

Gemini still cannot:

- mutate question index;
- decide that code was submitted;
- grade code or design;
- reveal hidden guides;
- invent a question;
- bypass follow-up/time limits;
- persist state directly.

### 9.1 Tool schema

Reuse `complete_interview_turn`. Keep the semantic intents:

```text
answer
decline
end
question-or-clarification
other
```

Rewrite the intent descriptions to be interviewer-name-neutral. The current
text says "when they ask James something." It must say "the interviewer" or
use the selected interviewer name in the system instruction.

Do not add a fixed phrase list as application logic. Prompt examples are
allowed only to demonstrate semantic variety. Gemini must classify by meaning
and conversational context.

### 9.2 DSA/design system instruction

Add an explicit `isDsaDesignRound` branch to `buildSystemInstruction`. Do not
send this round through the old server-led fallback instruction.

The branch must include:

- `You are Claire` identity;
- the exact opening utterance;
- the entire safe frozen plan, with only public question text, kind, must-hit
  topics, follow-up limit, and response mode;
- instruction to call `complete_interview_turn` exactly once after every
  complete candidate utterance;
- semantic distinction between answer, decline, end, clarification, request
  for help, and request for thinking time;
- instruction that the tool response is authoritative;
- instruction to speak `approvedResponse` once without additions;
- code-focus rules;
- design-interview rules;
- no scoring aloud;
- no hidden answers/hints/rubrics;
- no invented questions;
- no employer facts or hiring decisions;
- reconnect behavior using persisted transcript;
- final-closing behavior.

For code questions explicitly instruct Gemini:

- Spoken reasoning is useful context but not a submitted solution.
- Do not claim code is correct or complete.
- Do not move to another frozen question merely because an approach sounds
  plausible.
- A typed editor submission arrives as a user turn and must still be sent
  through the tool.
- Stay silent after ordinary think-aloud unless the candidate asked a question
  or the server returned a spoken follow-up.

For design questions explicitly instruct Gemini:

- Probe the current design boundary only.
- Ask at most one concise question.
- Challenge a concrete contradiction or unsupported guarantee, not speaking
  style.
- Never expose or paraphrase the expected answer.
- Move on when the candidate has supplied technically credible evidence even
  if it differs from the reference design.

### 9.3 Opening builder

Extend `buildOpeningUtterance` or replace its booleans with a small round-kind
argument. Avoid a fourth positional boolean. Tests must cover Claire's exact
name, section order, and first question.

### 9.4 Token route

In the Gemini token route:

1. Derive `geminiLedConversation` from the shared predicate.
2. Derive the interviewer persona/name/voice from setup.
3. For the combined round, attach the same blocking tool declaration used by
   Resume/Hiring Manager.
4. Do not create the parallel transcription token for a Gemini-led DSA & Design
   room.
5. Use Gemini's tool `answerText` as the single saved candidate transcript.
6. Include DSA titles, patterns, languages, design scenario title, technologies,
   and resume/project names in pronunciation vocabulary.
7. Preserve ephemeral token lifetime and session-time limits.
8. Preserve activity detection and barge-in used by Gemini-led rooms.

## 10. Trusted voice versus workspace submission boundary

This is mandatory. Without it, spoken think-aloud can accidentally finish a
coding question before code is submitted.

### 10.1 Add a submission source

Add a narrow internal value:

```ts
type CandidateSubmissionSource = "voice" | "workspace";
```

Carry it from browser to `InterviewService`:

1. Extend the `/api/interview/decide` request schema with optional
   `submissionSource`, defaulting to `voice` for old clients.
2. In `gemini-live-interviewer.tsx`, a normal microphone/tool turn uses
   `voice`.
3. While a `submitTypedAnswer` promise is pending, the matching tool call uses
   `workspace`.
4. Do not infer workspace submission by searching for triple backticks.
5. Include the source in the service answer command, not in Gemini's
   model-controlled `liveProposal`.
6. Optionally persist it on the user `Turn` as an additive field for debugging
   and report evidence. Older turns have it undefined and behave as voice.

### 10.2 Server enforcement for code questions

In `InterviewService`, before applying the proposed action:

- `candidateIntent === "end"` always ends the whole interview.
- `candidateIntent === "decline"` always skips the current problem.
- a legitimate clarification/request can receive `respond` and stay on the
  current question;
- for `question.kind === "code"` and `submissionSource === "voice"`, never
  allow `move_on` solely from an attempted technical answer;
- persist useful reasoning against the current question;
- keep the question index and follow-up budget stable when no spoken reply is
  needed;
- return an empty/no-audio approved response for ordinary think-aloud;
- allow one concise response when the candidate explicitly asked a question or
  requested help;
- only `submissionSource === "workspace"`, decline, or end can finish the code
  question.

If the current response DTO cannot represent a successful silent continuation,
add an explicit boolean such as `speak: false` or allow
`approvedResponse: ""`. Update the Gemini client so an empty approved response
produces no audio and returns to listening. Do not fill it with generic chatter.

### 10.3 Typed submission correlation

The current browser stores one `pendingTypedSubmission`. Preserve that
single-flight guard. The tool call that consumes it must:

- use the pending typed text as authoritative candidate text;
- carry the original start/end timestamps;
- mark `submissionSource: "workspace"`;
- resolve the pending promise only after the server saved the turn;
- reject it after the existing timeout;
- clear it on disconnect/error;
- prevent a duplicate Gemini tool call from saving or speaking twice.

Add a test proving a microphone utterance arriving near a code submission
cannot steal the pending workspace marker.

## 11. Semantic skip, end, help, and clarification

Gemini classifies intent by meaning. The server validates the result.

### 11.1 Decline current question

Examples include, but are not limited to, no knowledge, inability, discomfort,
refusal, or a natural request to move forward. Examples belong in prompt/tests,
not production phrase matching.

Required behavior:

1. Gemini sends the exact words as `answerText`.
2. Gemini proposes `candidateIntent: "decline"` and `action: "move_on"`.
3. Server marks the user turn skipped and assessment-excluded.
4. Server advances once.
5. Claire gives no praise, challenge, hint, or repeated version of the same
   question.
6. Claire asks the next frozen question, or closes if none remains.

Keep the existing phrase detector only as an emergency server fallback for
non-Gemini/failed-classification paths. Do not expand it into the primary
classifier.

### 11.2 End whole interview

1. Gemini proposes `candidateIntent: "end"`.
2. Server marks the turn as ending/excluded.
3. Server finishes immediately.
4. Claire gives the approved closing once.
5. Do not ask for confirmation.
6. Do not ask another interview question.
7. The partial interview still appears in history/report with unanswered
   questions represented honestly.

### 11.3 Asking for help

Do not treat asking for help as a decline.

- Keep the current question.
- Use at most one bounded, question-specific interviewer prompt.
- Prefer an invariant, constraint, example, failure case, or comparison.
- Do not reveal the optimal DSA solution or design reference answer.
- Respect the existing per-question follow-up maximum.

### 11.4 Asking for thinking time

- Keep the current question.
- Acknowledge briefly once if a response is necessary.
- Do not increment technical follow-up count.
- Return to listening and remain silent.
- Do not start a client timer that later causes unsolicited speech.

## 12. Shared room changes

Modify `voice-interview-client.tsx` carefully. Do not duplicate the 2,000-line
component.

### 12.1 Replace whole-session DSA rendering assumptions

The current code renders `DsaLiveWorkspace` for every question when the title
is exactly `DSA practice interview`. That would render an empty editor for the
design prompts.

Derive:

```ts
const isDsaDesignInterview = setup ? isDsaDesignRound(setup) : false;
const isActiveDsaCodeQuestion =
  isDsaDesignInterview &&
  currentQuestion?.interviewSection === "dsa" &&
  currentQuestion.kind === "code" &&
  Boolean(activeDsaQuestion);
const isActiveDesignQuestion =
  isDsaDesignInterview && currentQuestion?.interviewSection === "design";
```

Render order:

1. Fundamentals workspace
2. Story-practice assessment workspace
3. DSA block MCQ workspace
4. Resume workspace
5. Active DSA code workspace
6. Active combined-round design workspace
7. Legacy generic workspace

The combined round itself must not be marked as a practice
`storyPracticeAssessment`; doing so would make every question take the practice
assessment branch and would route completion back to `/practice/...`.

### 12.2 Positional DSA slug rule

For this version, indexes 0 and 1 correspond to
`setup.dsaQuestionSlugs[0]` and `[1]`. Design indexes have no slug. Reset code,
notes, run result, and errors when moving from index 0 to 1. When moving from
index 1 to 2, clear DSA editor state and render the design surface.

Use the canonical round predicate rather than exact-title effects for:

- loading starter code;
- suppressing inappropriate transcript auto-scroll;
- clearing typed state after persistence;
- supported-workspace checks;
- active question selection.

### 12.3 Design workspace

Prefer extracting a small `DsaDesignConversationWorkspace` that composes the
existing `InterviewQuestionPanel` and `MayaAside`, or reuse
`BlockAssessmentReviewWorkspace` with generic props if it requires no fake
practice identity.

Candidate-facing stages:

```ts
[
  { id: "rapid", label: "Frame", caption: "Requirements and scale" },
  { id: "explain", label: "Design", caption: "Contracts and architecture" },
  { id: "scenario", label: "Defend", caption: "Reliability and evolution" }
]
```

Do not call it a block assessment. Do not show teaching feedback between
questions unless it already comes from a server-approved Claire utterance.

## 13. Dialogue and state-machine responses

Add a dedicated DSA & Design dialogue helper. Do not reuse behavioural
acknowledgements that probe ownership or business impact.

Required transitions:

- DSA 1 to DSA 2: short technical transition plus the next frozen problem.
- DSA 2 to Frame: explicit coding-to-design transition.
- Frame to Design: carry constraints forward.
- Design to Defend: pressure-test the chosen architecture.
- Defend to done: one closing stating the report will be ready.

For a declined question, skip teaching feedback because no evaluated answer
exists. For an evaluation failure, move on without pretending a score or
technical conclusion exists.

Pacing configuration:

- DSA 1: required anchor
- DSA 2: optional under severe pacing pressure
- Frame: required anchor
- Design: required anchor
- Defend: required anchor

The state machine may skip only the optional DSA 2 when the remaining budget
would endanger all three design anchors. The 40-minute hard cap remains
absolute.

## 14. Evaluation

### 14.1 Per-question evaluation

Use `TechnicalAnswerEvaluator` for every answered DSA/design question.

DSA evaluation receives:

- problem text and constraints;
- DSA interviewer guide;
- cumulative spoken reasoning;
- submitted code;
- execution evidence;
- the `dsa-design` family parameters.

Design evaluation receives:

- current prompt;
- safe evidence anchor;
- server-only expected answer;
- server-only rubric;
- cumulative spoken/typed answer;
- the same `dsa-design` family parameters.

The reference design is a rubric, not the only acceptable architecture. The
evaluator must accept a different coherent solution when the candidate states
assumptions and defends trade-offs.

### 14.2 Rubric resolution

`rubricFor` currently resolves a story-practice guide only when the setup has a
story-practice assessment identity. The combined permanent round deliberately
does not have that identity. Change rubric resolution so a trusted
`question.storyPracticeInterviewerGuide` is sufficient to build the rubric.
This guide never reaches the client serializer.

Keep DSA-specific guide handling separate from design guide handling.

### 14.3 Family scoring

Reuse `evaluation-profile.ts` family `dsa-design`. Do not create a fifth report
family.

Every semantic evaluation returns rubric scores for:

- `problem-understanding`
- `approach-reasoning`
- `correctness`
- `complexity-scalability`
- `edge-cases-reliability`
- `communication`

All values are 0–100. An unavailable evaluator result is excluded while the
recovery job retries; it is not a real zero.

The existing report aggregation averages the available parameter scores across
answered questions. Preserve that behavior for v1. Do not add separate DSA and
Design headline cards in this implementation unless explicitly requested
later.

### 14.4 Multiple code questions

The report's legacy `codeExercise` field describes only the first code
question. Do not silently claim that it summarizes both. For this feature, the
two DSA questions still appear independently in `report.competencies`, which is
the authoritative detailed evidence.

If UI copy labels the singular code card as the entire coding section, change
that label to make clear it is the first recorded code exercise. A future
additive `codeExercises` contract can be implemented separately; do not expand
this task unless tests demonstrate the report is materially misleading.

## 15. Report and history integration

### 15.1 Report classification

`evaluationProfileForSetup` must classify both legacy and new sessions as
`dsa-design`. Keeping `templateId: "dsa"` should already do this through the
identity regex, but add an explicit test for the new title/setup metadata.

### 15.2 Completion screen

The existing completion debrief already:

- shows the selected teacher;
- accepts `interviewerName`;
- says `{interviewerName} has reported back to me`;
- links to `/reports`;
- lists the family parameters.

Pass Claire from the setup persona mapping. Do not create a separate DSA report
page.

### 15.3 Reports overview

The completed session must be included by `InterviewService.history`, report
snapshots, `reportsOverview`, and the existing reports page. Verify:

- the DSA & Design family card increments by one completed interview;
- latest family is DSA & Design;
- all six parameters render;
- exact candidate evidence can be located by `questionIndex`;
- selected teacher narration names Claire as the interviewer;
- PDF uses the same values.

### 15.4 Performance profile

Update `performance-profile-aggregator.ts` to recognize the canonical DSA &
Design predicate. Preserve DSA observations from both coding problems. Add
design observations using the question's `skillKeys`, `rubricKeys`, or a stable
architecture skill key; do not accidentally discard design answers because the
session was classified only as legacy DSA.

## 16. Security and privacy boundaries

These checks are mandatory:

- Start route uses owner auth and existing quota/rate limits.
- Session reads/answers/runs are owner-scoped.
- Long-lived Gemini keys never reach the browser.
- Only ephemeral constrained credentials reach the browser.
- Hidden DSA guides and design expected answers stay inside persisted server
  state and evaluator/decider inputs.
- `serialiseInterviewState` must not expose `dsaInterviewerGuide`,
  `storyPracticeInterviewerGuide`, answer keys, rubric criteria, common
  mistakes, or unreached questions.
- Candidate text included in prompts is delimited as inert evidence and cannot
  override the system instruction.
- Provider telemetry remains content-free.
- Duplicate tool calls and duplicate typed submissions do not create duplicate
  turns or repeat Claire's response.
- The code runner validates owned session/question alignment.

Add a serializer test for a combined session that explicitly asserts the
private guides are absent from JSON.

## 17. Backward compatibility

Do not break:

- active `DSA practice interview` sessions;
- old `/interview/dsa/[slug]` redirects;
- DSA block assessments;
- Architecture practice assessments;
- Resume/Hiring Manager Gemini-led behavior;
- Core/Applied server-led or assessment behavior;
- report snapshots already stored in the database;
- candidate teacher preferences;
- daily interview quota behavior.

Compatibility rules:

- Read old missing optional fields safely.
- Old DSA sessions without `interviewSection` infer DSA from `kind === "code"`
  and the positional slug.
- New combined sessions use explicit `interviewSection`.
- New request fields default safely for old clients.
- Never rewrite old persisted session JSON in place.

## 18. Exact implementation sequence

Terra must implement and verify in these slices. Do not attempt all edits and
then debug everything at the end.

### Slice 1 — canonical identity and types

1. Add `isDsaDesignRound`.
2. Add optional `dsaDesignRound` setup metadata.
3. Add optional `interviewSection` question metadata.
4. Update Claire persona matching.
5. Update existing exact-title callers.
6. Run persona, evaluation-profile, roadmap, planner, and performance tests.

### Slice 2 — pure plan builder

1. Add `dsa-design-round.ts`.
2. Map two DSA questions.
3. Compress one approved design artifact into three prompts.
4. Attach hidden guides.
5. Test exact order, public fields, hidden guides, follow-up limits, pacing
   anchors, and absence of leaked solution text in public fields.

### Slice 3 — start route and launch

1. Extend the start route to resume an active session.
2. Select two questions and one design scenario for supported roles.
3. Start with the explicit plan.
4. Keep the DSA-only fallback for unsupported design roles.
5. Refactor DSA entry onto `InterviewLaunchStage`.
6. Add selected-teacher-to-Claire handoff copy.
7. Test readiness, quota, lease retry, success, failure, and navigation after
   voice.

### Slice 4 — Gemini-led Claire conversation

1. Extend `usesGeminiLedConversation`.
2. Generalize tool descriptions away from James-only wording.
3. Add the DSA/design system-instruction branch.
4. Add Claire opening/reconnect instructions.
5. Issue only the Gemini conversation token for this round.
6. Test semantic decline/end/help/clarification instructions, Claire identity,
   tool requirement, frozen plan, no hidden guides, and no parallel transcript
   token.

### Slice 5 — trusted code-submission boundary

1. Add `submissionSource` to decide API.
2. Propagate it through client/service.
3. Mark microphone turns as voice.
4. Mark correlated editor submissions as workspace.
5. Hold code questions on voice reasoning.
6. Allow workspace submit, decline, and end to transition.
7. Support a silent approved continuation.
8. Test races, duplicates, retries, and reconnect.

### Slice 6 — mixed workspace

1. Replace exact title checks with canonical identity.
2. Render DSA editor only on active DSA code questions.
3. Add/reuse design conversation workspace for design questions.
4. Reset code state between questions/sections.
5. Verify mobile and desktop layouts.
6. Test question 1 -> 2 -> Frame -> Design -> Defend transitions.

### Slice 7 — evaluator, completion, and reports

1. Resolve trusted design guide rubrics without a practice identity.
2. Verify cumulative DSA reasoning + code + execution evaluation.
3. Verify design evaluation accepts alternatives and uses hidden guides.
4. Verify async evaluation recovery.
5. Verify completion debrief names Claire.
6. Verify `/reports`, overview aggregation, history, parameter evidence, and PDF.
7. Verify performance-profile ingestion of both sections.

### Slice 8 — full regression

1. Run focused tests.
2. Run typecheck.
3. Run lint.
4. Run the full relevant interview/practice/report test groups.
5. Manually test microphone, code run, code submit, semantic skip, semantic end,
   reconnect, completion, report, and mobile layout.

## 19. Required automated tests

### Domain and planning

- New combined setup resolves Claire/Kore.
- Legacy DSA setup still resolves Claire/Kore.
- Resume and Hiring Manager still resolve James/Charon.
- Mixed plan has exactly five questions.
- First two questions are DSA code questions.
- Final three are design conversation questions.
- Slug order matches code-question indexes.
- Design prompts share one scenario.
- Hidden guides exist server-side.
- Public fields contain no reference solution.
- Scenario selection is deterministic for fixed inputs.
- Recent scenario avoidance works.
- Exhausted catalogue fallback is deterministic.

### Start route

- Fewer than ten executable solved questions returns readiness conflict.
- Operation/design DSA slugs do not count toward readiness.
- Active session is resumed without consuming quota.
- Creation lease prevents duplicate sessions.
- Backend/fullstack starts five-question mixed round.
- Unsupported design role retains safe DSA-only behavior.
- Setup has 40-minute combined duration.
- Owner cookie is attached.
- Private design material is absent from response.

### Gemini and API

- DSA & Design requires a live proposal.
- Claire instruction uses `complete_interview_turn` exactly once per complete
  utterance.
- Instruction classifies intent semantically.
- Instruction distinguishes decline from help/thinking time.
- Instruction requires immediate whole-round end without confirmation.
- Instruction requires silence during ordinary code focus.
- Reconnect continues current question instead of restarting.
- Transcription-refresh request is rejected for this Gemini-led round.
- Invalid live proposal remains rejected.
- Tool/server error does not produce speculative Claire speech.

### Submission boundary

- Spoken DSA reasoning is persisted but cannot advance code question.
- Workspace code submission can advance after validation.
- Spoken decline skips code question.
- Spoken end ends whole session.
- Spoken clarification stays on question without consuming a technical probe.
- Help request consumes at most the configured follow-up.
- Failed run does not advance.
- Duplicate submission is idempotent.
- Near-simultaneous voice and workspace events preserve correct sources.

### UI

- Selected teacher says Claire will conduct the interview.
- Navigation waits for handoff or explicit skip.
- Live avatar/name is Claire.
- DSA indexes render editor.
- Design indexes never render editor.
- Design stages read Frame, Design, Defend.
- Changing DSA question resets editor/run output.
- Entering design clears DSA state.
- Completion says Claire reported back.
- Report action links to `/reports`.

### Evaluation and reports

- Both DSA questions receive execution-aware technical evaluations.
- Each design answer receives guide-grounded evaluation.
- Unavailable evaluation is excluded pending recovery.
- Completed session is family `dsa-design`.
- Six parameter values render on dashboard.
- Evidence quotes map to correct question indexes/timestamps.
- Overview family count increments.
- PDF uses dashboard values.
- Partial user-ended session remains honest and does not fabricate zeros for
  unanswered questions.

### Regression

- Resume semantic decline/end remains unchanged.
- Hiring Manager semantic decline/end remains unchanged.
- DSA block assessment skip remains unchanged.
- Architecture practice assessment completion still returns to practice.
- Legacy DSA session loads and completes.
- Server-led interview families still use their existing transcription path.

## 20. Manual QA scripts

Run each scenario with a fresh session unless the scenario explicitly tests
resume/reconnect.

### Happy path

1. Open Interviews.
2. Start DSA & Design.
3. Confirm selected teacher says Claire will conduct it.
4. Confirm navigation waits until voice ends.
5. Confirm Claire/Kore opens once.
6. Explain approach aloud.
7. Confirm Claire does not advance before code submission.
8. Type and run failing code.
9. Confirm no unsolicited speech and no transition.
10. Fix and run passing code.
11. Submit with reasoning.
12. Complete second DSA problem.
13. Confirm editor disappears and design Frame appears.
14. Complete all three design prompts.
15. Confirm Claire closes once.
16. Confirm selected teacher debrief says Claire reported back.
17. Open report and verify family, six parameters, evidence, transcript, and
    PDF.

### Semantic decline

Try materially different natural refusals on code and design questions. Confirm
they skip immediately without a repeated question or guilt/praise. Do not add
the tested sentences to application conditionals.

### Help versus decline

Say that you are stuck but want a nudge. Confirm Claire asks one bounded
interviewer question and keeps the same problem. Then explicitly decline and
confirm it advances.

### Thinking time

Ask for a minute. Type silently for at least two minutes. Confirm Claire does
not generate entertainment chatter.

### End interview

Use an indirect but unambiguous natural request to end the entire interview.
Confirm immediate closing, no confirmation, no next question, and an honest
partial report.

### Reconnect

Disconnect during DSA, reconnect, and verify same problem/editor. Disconnect
during Design and verify same prompt/scenario. Confirm Claire does not repeat
the full introduction.

### Mobile

Verify launch, media gate, editor controls, language picker, design panel,
camera disable, transcript, completion, and report at narrow width without
horizontal page overflow.

## 21. Recommended verification commands

Use the package manager declared by the repository lockfile. First inspect
`package.json` scripts; do not invent command names. At minimum run focused
Vitest files for:

- interviewer persona;
- DSA selection and new mixed-plan builder;
- DSA start route;
- Gemini Live conversation predicate;
- Gemini token instruction;
- Gemini live interviewer client;
- interview service/state machine;
- interview serializer;
- technical evaluator;
- report builder;
- reports overview/dashboard;
- roadmap sessions;
- performance profile aggregator;
- shared launch stage and DSA entry.

Then run the repository typecheck and lint scripts. If the full suite is too
large, report exactly what was and was not run; never write "tests pass" when
only a subset ran.

## 22. Expected implementation size

Approximate changed/new lines, excluding generated snapshots:

| Area | Production | Tests |
| --- | ---: | ---: |
| Identity/types/predicates | 30–60 | 50–90 |
| Mixed plan and scenario selection | 150–230 | 120–180 |
| Start route and launch handoff | 80–140 | 100–160 |
| Gemini-led Claire policy | 80–140 | 100–170 |
| Trusted submission-source boundary | 80–150 | 120–200 |
| Mixed room/design surface | 70–140 | 100–170 |
| Evaluation/report/performance integration | 50–100 | 80–140 |
| Total | **540–960** | **670–1,110** |

Expected total including tests: **1,210–2,070 lines**.

The estimate is higher than a visual-only DSA/design merge because the trusted
voice-versus-code submission boundary and its race/idempotency tests are
required for correct behavior. Do not reduce the estimate by skipping those
tests.

## 23. Definition of done

The feature is done only when all statements below are true:

- The roadmap launches one durable DSA & Design round.
- The selected teacher audibly hands the candidate to Claire.
- Claire/Kore is consistent in the live room.
- The round uses two practiced/adaptive DSA problems and one approved,
  role-compatible design scenario.
- Code and design questions render the correct workspace.
- Gemini interprets natural intent semantically.
- The server—not Gemini—owns skip, advance, end, timing, and persistence.
- Spoken think-aloud cannot complete a code problem.
- Workspace submission can complete it exactly once.
- Claire stays quiet while the candidate codes unless directly engaged.
- Decline skips immediately; whole-round end closes immediately.
- Hidden answers and rubrics never reach the browser.
- Every completed answer is evaluated by the DSA & Design contract.
- Evaluation failures recover asynchronously without becoming fake zeros.
- Completion uses the selected-teacher debrief and names Claire.
- `/reports` and PDF show the same DSA & Design evidence and scores.
- Legacy interviews and all other interview families still pass regression
  tests.
- Typecheck, lint, focused automated tests, and the manual happy path have been
  completed and truthfully reported.

## 24. Terra implementation rules

1. Read every target file before editing it.
2. Preserve unrelated user changes; the worktree may already be dirty.
3. Use small patches grouped by the implementation slices above.
4. Do not duplicate shared interview components or services.
5. Do not make exact display titles the only business identity.
6. Do not use phrase-matching as the semantic intent engine.
7. Do not trust model-controlled fields to identify a workspace code
   submission.
8. Do not expose private guides through API serialization, logs, telemetry, or
   error messages.
9. Do not mark a partial or unavailable evaluation as a real zero.
10. Do not change Claire or James globally outside the stated round ownership.
11. After each slice, run its focused tests before continuing.
12. If an existing invariant conflicts with this document, stop, cite the exact
    file/function/test, and resolve the conflict explicitly rather than guessing.
