# Resume & Behavioural Gemini Live implementation blueprint

Status: implemented on 15 September 2026, based on the working Hiring Manager & Final Behavioural round.

## Decision

Do not build a second interview engine and do not copy the Hiring Manager implementation.
Generalize the existing Gemini-led conversation policy so that it supports two interview families:

- `hr-behavioral` using the existing `hiring-manager-final` plan;
- `resume-behavioral` using the existing `resume-behavioral-defense` plan.

Gemini Live should own the natural spoken conversation. Trailgrad must continue to own the frozen
question plan, authentication, idempotency, question index, follow-up limits, timing, deterministic
grading, persistence, evaluation, ending, and reports.

This is the same boundary that made the Hiring Manager round feel natural without surrendering
business control:

```text
Candidate speech / typed answer
            |
            v
Gemini Live listens and proposes one conversational action
            |
            v
complete_interview_turn(answerText, proposal)
            |
            v
Trailgrad validates -> saves -> evaluates -> advances/ends
            |
            v
approvedResponse (the only next interview content)
            |
            v
Gemini Live speaks it naturally
```

## What already exists and must be reused

The Resume & Behavioural product is not starting from zero. Most of it is already implemented.

| Capability                                                         | Existing source                                  | Action                                          |
| ------------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| Resume-derived eight-question plan                                 | `src/features/interviews/server/resume-round.ts` | Reuse; add assessment metadata only             |
| Resume kit creation and caching                                    | `resumeInterviewKitService.ensure(...)`          | Reuse unchanged                                 |
| Start/auth/quota/creation lease                                    | `src/app/api/interview/resume/start/route.ts`    | Reuse unchanged                                 |
| Resume document, question panel, MCQ and code workspace            | `resume-live-workspace.tsx`                      | Reuse unchanged                                 |
| Gemini audio transport, barge-in, tool calls and typed submissions | `gemini-live-interviewer.tsx`                    | Reuse unchanged after policy generalization     |
| Durable state machine and pacing                                   | `state-machine.ts`                               | Reuse unchanged                                 |
| Idempotent answer persistence                                      | `interview.service.ts` and `session-store.ts`    | Reuse unchanged                                 |
| Async evaluation recovery                                          | `evaluation-recovery.ts`                         | Reuse unchanged                                 |
| Candidate-requested and automatic ending                           | `interview.service.ts` and Gemini prompt         | Reuse unchanged                                 |
| Resume report family                                               | `evaluation-profile.ts`                          | Reuse the existing six parameters               |
| Dashboard and PDF evidence presentation                            | reports feature                                  | Reuse unchanged once scores follow the contract |

The large files are shared infrastructure, not code that should be duplicated. In particular,
`gemini-live-interviewer.tsx`, `interview.service.ts`, the report dashboard, and the PDF generator
must remain single implementations.

## Resume interview contract

### Frozen plan

Keep the current plan assembled by `buildResumePlan(...)`. It already provides the right arc:

1. Concise career narrative.
2. Current-role responsibility and hardest problem.
3. Project design, trade-off, ownership, and outcome.
4. Two resume-specific experience questions.
5. One behavioural setback question.
6. One resume skill check when a coding task exists, otherwise two.
7. One short coding task when the resume kit provides one.

The actual count stays bounded by the kit and remains frozen when the session starts. Gemini may
ask a permitted follow-up, but it must never invent, reorder, replace, or skip a planned question.
The server state machine remains the only component that can move the question index.

### Conversation style

Use the shared James identity and conversational rules from the Hiring Manager round:

- James is a warm, perceptive member of the recruiting team.
- If asked who he is, he says exactly: `I'm James from the recruiting team.`
- He never mentions Google, Gemini, an AI model, a bot, or a virtual assistant.
- He listens through natural pauses and supports barge-in.
- He acknowledges one specific detail briefly and asks at most one question.
- He does not praise, coach, score aloud, or mechanically demand metrics.
- He stays on the current resume claim or server-approved question.

Add only this Resume-specific focus:

> Verify the candidate's own resume claims. Ask for concrete context, personal ownership,
> decisions, trade-offs, implementation detail, impact, and learning. Do not invent facts from
> the resume and do not turn every question into a technical quiz.

### Tool loop

Use the existing `complete_interview_turn` declaration without adding another tool.

After every complete spoken utterance Gemini calls it exactly once with:

- the verbatim `answerText`;
- one proposed action: `clarify`, `probe`, `challenge`, `respond`, or `move_on`;
- one missing-evidence category;
- a short grounded acknowledgement;
- at most one follow-up line;
- a candidate-facing response only when the candidate asked a question;
- a short internal reason.

The tool result remains authoritative. Gemini speaks only `approvedResponse`. The server may
override a probe with `move_on` because of follow-up, pacing, question, or time limits.

### Typed, MCQ, and code turns

The existing typed-answer bridge already sends a typed submission into the Gemini session and
waits for `complete_interview_turn`. Keep that path, with these server rules:

- MCQs are graded from the persisted answer key before any model proposal is considered.
- Code execution evidence and the semantic evaluator determine the code result.
- Gemini must never announce that an MCQ or code answer is correct before the server responds.
- A tool proposal may shape the delivery, but it cannot override deterministic grading.
- The same submission fingerprint and `turnId` protections prevent duplicate persistence.

## Exact scoring contract

Resume & Behavioural already has the correct six report parameters:

| Parameter          | Weight | Evidence expected                                             |
| ------------------ | -----: | ------------------------------------------------------------- |
| Claim credibility  |    20% | Verifiable context supporting a resume claim                  |
| Personal ownership |    20% | Clear separation of the candidate's work from the team's work |
| Decision-making    |    15% | Choice, alternatives, constraints, and trade-off              |
| Specificity        |    15% | Concrete implementation, situation, or action detail          |
| Impact & learning  |    20% | Result, measurable change, or durable learning                |
| Communication      |    10% | Direct, coherent claim -> evidence -> result delivery         |

Every persisted numeric score is an integer from 0 through 100. A score such as `6` means six out
of one hundred; it must never silently mean six out of ten. Do not infer a scale independently for
each question.

Use these anchors in the evaluator prompt and tests:

- `0–19`: absent, refusal, unrelated answer, or no assessable evidence;
- `20–39`: very weak evidence with the central claim unsupported;
- `40–59`: developing evidence but important context or result is missing;
- `60–74`: adequate, credible evidence with a meaningful omission;
- `75–89`: strong, concrete, personally owned evidence;
- `90–100`: exceptional specificity, judgement, and demonstrated impact.

### Never score an unassessed parameter as zero

Each `PlannedQuestion` declares `evaluationParameterKeys`. The evaluator persists rubric items
only for those declared keys. An omitted rubric key means the question did not seek that evidence;
it is excluded from the new-report aggregation rather than being treated as zero.

Suggested mappings:

| Question stage          | Assessed parameters                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Career narrative        | Claim credibility, specificity, communication                                                         |
| Current role            | Claim credibility, personal ownership, specificity, impact & learning, communication                  |
| Project deep-dive       | Personal ownership, decision-making, specificity, impact & learning, communication                    |
| Behavioural setback     | Personal ownership, decision-making, impact & learning, communication                                 |
| Resume experience claim | Claim credibility, personal ownership, decision-making, specificity, impact & learning, communication |
| Skill question          | Claim credibility, decision-making, specificity, communication                                        |
| Code task               | Claim credibility, personal ownership, decision-making, specificity, communication                    |

Communication may be assessed on every substantive answer. Other parameters are assessed only
when declared by the frozen question. Missing evidence on a targeted question may correctly score
zero; a parameter that the question never targeted is not zero—it is unassessed.

### Aggregation

For one interview:

1. Combine all attempts/follow-ups belonging to the same planned question.
2. Keep the latest completed semantic evaluation for that question.
3. For each parameter, average only rubric items persisted for questions that targeted it.
4. Apply the weights above only to parameters that were assessed.
5. Renormalize the active weights to 100% when pacing legitimately skips a question.
6. Do not score candidate requests to stop, clarification-only turns, social asides, or excluded
   break/support turns.

For the four top report cards, aggregate the final interview scores within each family. Below
those cards, show the newest scored interview and its six parameter explanations. The PDF must
use the same ordering and the same values.

Every parameter explanation must include:

- its 0–100 score;
- a short evaluator rationale;
- up to two exact server-verified candidate quotes;
- transcript timestamp when available;
- one concrete next action.

## Exact code changes

### 1. Generalize Gemini-led eligibility

In `src/features/interviews/domain/gemini-live-conversation.ts`, add one shared predicate based on
the canonical family/template identity, not a loose `resumeRound` boolean:

```ts
export function usesGeminiLedConversation(setup: InterviewSetup): boolean {
  return (
    setup.templateId === "hiring-manager-final" || setup.templateId === "resume-behavioral-defense"
  );
}
```

All callers must use this function. Do not repeat `roundType === "hiring-manager"` conditions.

### 2. Generalize the Gemini token route

In `src/app/api/interview/gemini-live/token/route.ts`:

- derive `geminiLedConversation` with the shared predicate;
- issue only the voice token for both supported families;
- attach the existing tool declaration for both;
- enable natural interruption for both;
- reject transcription-refresh for both;
- replace `isHiringManagerRound` with a `conversationFamily` or policy object;
- build one shared system prompt with a short family-specific focus block;
- include the entire frozen resume plan, `mustHit` fields, follow-up limits, and pronunciation
  vocabulary exactly as the HR prompt does.

The opening should be Resume-specific but still server-authored:

> Hi, thanks for joining me today. We'll walk through your background and then look more closely
> at the work and skills on your resume. To start, {first planned question}

### 3. Generalize server authorization

In `src/app/api/interview/decide/route.ts` and `interview.service.ts`:

- require `liveProposal` for both Gemini-led templates;
- reject it for every other interview type;
- retain all current validation and sanitization;
- rename the runtime marker from `gemini-live-conversation-v1` to a versioned shared name such as
  `gemini-live-conversation-v2`;
- keep candidate end detection ahead of model decision handling.

No Groq/secondary decider call should execute for a valid Gemini-led Resume turn. Evaluation may
still run asynchronously and must use the existing durable recovery queue when it misses the live
latency budget.

### 4. Add explicit assessment metadata

In `types.ts`, add `evaluationParameterKeys?: string[]` to `PlannedQuestion`.

Annotate every question assembled by `buildResumePlan(...)` with the mappings above. Pass those
keys to `buildResumeAnswerEvaluationPrompt(...)`. Require the evaluator to return exactly the
targeted keys and discard any extra keys returned by a provider.

Existing reports continue through the current legacy compatibility path. The new evaluator prompt
version is unambiguously 0–100.

### 5. Keep the UI shared

No new interview room is needed. `ResumeLiveWorkspace` already switches between the resume
document and code editor and already selects `RESUME_STAGES`. `GeminiLiveInterviewer` already
switches behavior using the token response's `conversationMode`.

Only update comments and any labels that still say the Gemini-led path is Hiring-Manager-only.

### 6. Keep reporting shared

Do not create a Resume report page or PDF implementation. The existing evaluation profile routes
`resume-behavioral-defense` into the `resume-behavioral` family. The dashboard and PDF consume the
same report contract.

## Failure and recovery behavior

- Tool call missing: do not accept an unowned browser decision; show reconnect/retry state.
- Duplicate tool call: return the idempotently saved response for the same `turnId`/fingerprint.
- Gemini disconnects: preserve every committed answer and reconnect with session resumption.
- Evaluation timeout: save the conversational turn immediately and enqueue durable evaluation.
- Typed-answer tool timeout: keep the draft and allow an explicit retry.
- Microphone denied: typed answers remain available.
- Candidate says stop/end/quit: close immediately without confirmation.
- Last planned question completes: close immediately; do not wait for the clock.
- Hard time limit: state-machine closure overrides Gemini.
- Candidate asks employer-specific questions: James states that the real recruiting team must
  confirm them, then returns to the current approved question.

## Test matrix required before rollout

### Domain/unit

- Gemini-led predicate accepts only the two intended templates.
- Resume questions expose correct assessment keys.
- Non-target rubric items do not affect a parameter or overall score.
- Weighted overall score remains 0–100 when pacing skips optional questions.
- Clarification, end, and support turns never enter assessment.

### Token/prompt

- Resume receives tools, barge-in, no second transcription token, full frozen plan, James identity,
  exact end behavior, and Resume-specific focus.
- DSA/Core/Fundamentals remain server-led.
- Prompt injection asking James to ignore the plan or disclose the provider is refused.

### Service/API

- Resume accepts a valid proposal without calling the secondary decider.
- Resume rejects a missing proposal at the HTTP boundary.
- Other rounds reject a proposal.
- State-machine follow-up, pacing, and time guards override Gemini.
- MCQ correctness and code evidence override Gemini's proposal.
- Duplicate `turnId` replays the same persisted response.
- Candidate-requested end and last-question completion close immediately.

### Browser/component

- One spoken answer renders and persists once.
- Typed, MCQ, and code answers resolve through the tool path.
- Reconnection does not replay the opening or duplicate a transcript.
- James speaks the approved response and never provider-identifies.

### Integration

Add `resume-behavioral-flow.integration.spec.ts` covering:

1. resume kit -> frozen plan;
2. start -> exact opening;
3. spoken turn -> tool proposal -> one saved transcript;
4. MCQ/code typed turn -> deterministic server result;
5. pacing across every protected section;
6. last question -> immediate close;
7. report -> six assessed 0–100 parameters with quotes;
8. PDF -> aggregated family overview followed by detailed latest report.

## Rollout sequence

1. Add the shared eligibility predicate and characterization tests without changing behavior.
2. Generalize token, API, and service gates; keep Resume behind a server configuration flag.
3. Add assessment metadata and the new evaluator prompt version.
4. Run golden transcripts through old and new report generation; reject any scale mismatch.
5. Enable Resume Gemini-led mode locally and test speech, interruption, typed MCQ, and code.
6. Enable for internal users, monitor tool failures, duplicate turns, evaluation recovery, latency,
   and score distributions.
7. Enable broadly only after the p50/p95 turn latency and score bands look credible.
8. Remove the Resume server-led compatibility branch after a stable observation window.

## Definition of done

- James handles Resume speech as naturally as the Hiring Manager round.
- The server remains authoritative over every question and transition.
- No second conversational model/decider runs for normal Resume turns.
- Spoken and typed answers persist exactly once.
- MCQ/code results cannot be overridden by Gemini.
- All planned questions finish the interview immediately; explicit end requests also close it.
- Every Resume parameter is either `Not yet` or a genuine 0–100 score.
- Aggregate cards, detailed latest report, and PDF show the same values from the same contract.
- All unit, API, component, integration, lint, and type checks pass.

## Line-count estimate

This should be a focused generalization, not another large rewrite.

| Work                                         |   Estimated changed/new lines |
| -------------------------------------------- | ----------------------------: |
| Shared Gemini-led policy and prompt variants |       70–110 production lines |
| API/service gate generalization              |        20–35 production lines |
| Assessment metadata and 0–100 aggregation    |       80–125 production lines |
| Resume-plan annotations and observability    |        35–60 production lines |
| Unit/API/component/integration coverage      |            240–360 test lines |
| **Total**                                    | **445–690 changed/new lines** |

The net-new production code should be approximately **205–330 lines**. The higher total is mostly
tests. A minimal switch that merely enables Gemini for Resume could be under 100 production lines,
but it would not be production-ready because it would repeat the scoring ambiguity and leave typed
MCQ/code, idempotency, and failure behavior insufficiently characterized.

The implementation should reuse several thousand existing lines at runtime while adding only this
small adapter and scoring contract. If the change starts duplicating the HR prompt, Live client,
state machine, report dashboard, or PDF generator, stop: the abstraction boundary is wrong.
