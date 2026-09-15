# AI Interview Implementation Handoff

Last updated: 15 September 2026

This is the short source of context for future AI agents working on Trailgrad's
interview experience. It describes the implementation that exists now, not the
older migration proposal.

For the implementation-ready plan that brings Resume + Behavioural onto the
same Gemini-led architecture as Hiring Manager + Final Behavioural, see
[`RESUME_BEHAVIOURAL_GEMINI_LIVE_BLUEPRINT.md`](./RESUME_BEHAVIOURAL_GEMINI_LIVE_BLUEPRINT.md).

## Product decisions

Trailgrad presents four permanent interview rounds instead of one full mock:

1. Resume + Behavioural
2. Core Technical + Projects
3. DSA + Design
4. Hiring Manager + Final Behavioural

Each interview family has six judgement parameters designed for that kind of
interview. Do not collapse these back into one universal rubric:

| Interview family          | Evaluation parameters                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DSA + Design              | Problem understanding, Approach and reasoning, Correctness, Complexity and scalability, Edge cases and reliability, Communication |
| Core Technical + Projects | Concept depth, Technical reasoning, Trade-offs, Practical execution, Project ownership, Communication                             |
| HR + Behavioural          | Motivation and fit, Judgement, Collaboration, Accountability, Self-awareness, Communication                                       |
| Resume + Behavioural      | Claim credibility, Personal ownership, Decision-making, Specificity, Impact and learning, Communication                           |

James is always the live interviewer. His Gemini voice is locked to the male
`Charon` voice. The candidate's selected workspace coach gives the short
briefing before Resume and Hiring Manager rounds; that coach is not the live
interviewer.

James's candidate-facing identity is always: "I'm James from the recruiting
team." The Hiring Manager system instruction and server response guard both
enforce this. He must never identify himself as Google, Gemini, an AI assistant,
a language model, a bot, or a virtual assistant.

## Provider responsibilities

| Provider          | Current responsibility                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini Live agent | James's native-audio listening context and streamed `Charon` voice output                                                              |
| Gemini Transcribe | Dedicated bilingual verbatim transcription for interview families that remain server-led                                               |
| Groq              | Fast server-side planning, answer decisions for server-led interview families, and answer evaluation when `GROQ_API_KEY` is configured |
| Gemini text API   | Fallback for the server-side AI work when Groq is unavailable; also used by other generation features                                  |
| Deepgram          | Scripted workspace-coach speech outside the Gemini Live interview                                                                      |
| LiveKit           | Human-to-human peer-help calls only                                                                                                    |
| Supabase/Postgres | Durable profiles, interview sessions, answers, evaluations, and reports                                                                |

There is no Python or LiveKit AI-interviewer worker anymore. Do not add LiveKit
back to an AI interview. The LiveKit packages and environment variables remain
because peer help still needs them. Some retired LiveKit interview code remains
inside a block comment in `voice-interview-client.tsx`; it is unreachable and
should not be treated as the active architecture.

## Current launch flow

```text
/interviews
  -> dedicated round entry page
  -> create durable session in the background
  -> the selected workspace coach gives a short scripted handoff
  -> navigate only after her speech finishes
  -> microphone/camera setup (camera is optional and local preview only)
  -> /interview/voice?session=...
  -> James starts the interview through Gemini Live
```

The Resume and Hiring Manager launch pages deliberately wait for the selected
coach to finish. Back navigation must not replay an obsolete introduction
screen.

## Live interview architecture

```text
Browser microphone -----+-> Gemini Live agent -> James audio
                                      |
                                      | required answerText + decision tool call
                                      v
                    Gemini complete_interview_turn tool
                                      |
                                      v
                            POST /api/interview/decide
                           |
                           v
             InterviewService (source of truth)
                  |                    |
                  |                    +-> semantic evaluator
                  +-> validates action     (six family-specific scores)
                      and applies limits
                           |
                           v
               persisted state + approved direction
                           |
                           v
              tool result -> Gemini speaks as James
```

For Hiring Manager and Resume + Behavioural sessions, the browser receives one short-lived credential
constrained to the native-audio agent model. Its required
`complete_interview_turn` call supplies the saved candidate transcript, so the
old parallel transcription token and WebSocket are not created. Server-led
families still receive a second credential constrained to
`gemini-3.5-transcribe-live`. The long-lived Google API key never goes to the
browser, and audio does not pass through the Trailgrad server.

The transcription session uses bilingual Verbatim mode (`en-IN` and `hi-IN`)
and a maximum of 100 vocabulary hints assembled from the active resume, company
names, projects, skills, target role, and frozen interview plan. Interim
hypotheses stay private. This separate transcription path now applies only to
server-led rounds. In Gemini-led rounds, the verbatim `answerText` on
Gemini's `complete_interview_turn` call is the single saved transcript source,
so parallel recognizers cannot concatenate near-duplicate wording. The browser
rotates the separate connection before the provider's ten-minute limit only
when that server-led connection exists.

In Hiring Manager and Resume + Behavioural rounds Gemini owns listening, acknowledgements,
clarifications, and the choice to probe or move on. It submits that bounded
decision through a blocking tool. `InterviewService` validates the action,
enforces the frozen plan, follow-up budgets, pacing and hard cap, persists the
turn, and runs scoring. Gemini cannot advance progress, assign scores, or write
state directly. Other interview families remain on the server-led decider path.
Do not enable `enableAffectiveDialog` while the configured voice model is
Gemini 3.1 Flash Live; that capability is unsupported and rejects session setup.

## Turn-taking rules

- James opens with the exact server-approved greeting and first question.
- After each complete Gemini-led candidate turn, Gemini calls
  `complete_interview_turn` exactly once with the verbatim answer and its bounded
  conversational decision. The call is synchronous: James waits while the
  server saves the answer and validates the transition.
- The configured duration is a maximum, not a target. Advancing beyond the
  final frozen question sets the session to `done` immediately. An explicit
  request to end, stop, finish, quit, or leave also closes immediately without
  asking for confirmation.
- The server writes a durable semantic-evaluation job atomically with the
  answer, then returns James's validated response without waiting for the
  evaluator. Recovery processes the score immediately after the response. It
  does not make a second text-model decider call for Gemini-led
  turns.
- The decide endpoint rejects a Gemini-led turn without Gemini's live
  proposal. The legacy server/Groq decider therefore cannot silently take over.
- The tool result contains the approved response boundary. Gemini resumes in
  its own native conversation and delivers that content naturally and briefly.
- Every probe, challenge, or move-on response begins with a short acknowledgement
  of a specific detail from the candidate's answer. Clarification is the only
  action without one, because James should immediately repair a misheard answer.
  The acknowledgement and question are one server-approved utterance; Gemini
  must not invent a separate processing acknowledgement.
- If the answer has enough evidence, the state machine advances and James asks
  the next frozen question.
- If the most important evidence is missing, James asks one specific follow-up.
- Hiring Manager follow-up depth is section-specific: up to three in the career
  introduction, two for role fit and each how-you-work question, one for the
  first two final-conversation questions, and none for the closing question.
- On the closing question, Gemini may return one concise answer to a candidate
  question through its bounded proposal. James is explicitly a simulated hiring manager: he
  answers general questions about success, teamwork, management, and growth,
  but never invents company facts, compensation, benefits, policies, or hiring
  promises. Employer-specific questions are redirected to the real interviewer.
- James follows the candidate's actual answer: vague claims receive a narrow,
  concrete counter-question, while credible answers can lead to a deeper question
  about judgement, trade-offs, consequences, or reflection.
- Hiring Manager replies are no longer speculatively muted. Gemini speaks only
  after its blocking tool returns the server-approved direction. The existing
  mute-and-replay guard remains for server-led interview families.
- Hiring Manager voice activity supports barge-in so the candidate can interrupt
  naturally. Server-led families retain `NO_INTERRUPTION`. Both use the shared
  900 ms end-of-speech window.

## Pacing-aware section coverage

Hiring Manager and Resume + Behavioural plans mark indispensable section
anchors and attach conservative time reservations to each planned question.
When the candidate is running behind pace, the server state machine may bypass
a supporting prompt before the soft-wrap boundary. It never bypasses a protected
anchor. After soft wrap, protected anchors remain available until they have run
or the hard cap ends the room. Skipped indexes are persisted and returned to the
workspace so its stage rail removes prompts that are no longer part of the live arc.

The hard cap remains absolute. Pacing protects core coverage early; it does not
extend a room beyond its configured maximum duration.

Do not make the server wait for decision and evaluation sequentially. The two
calls are intentionally parallel and capped at roughly four seconds.

Both deadlines actively abort their provider request. A timed-out live call
must not continue generating in the background or produce a late result.

## Transcript behaviour

Gemini supplies both candidate and James transcriptions. Partial captions are
UI-only. A finished utterance becomes a new immutable chat row:

```text
James: ...
You: ...
James: ...
```

Never append a new utterance to an older row. Never mutate an old chat message
when a later transcript arrives. Exact late duplicate packets are discarded.
The right-side transcript shows only completed candidate and James utterances;
the temporary processing state is not persisted as a spoken turn.

Fatigue is not an automatic exit. Phrases such as “I just want to sleep” or “I
don't want to explain anymore” create an unassessed support turn: James suggests
a short break and explains that the candidate can explicitly say “end the
interview” to stop. Only an unambiguous stop command closes the session.

## Follow-ups and scoring

The decider receives the active planned question, intent, expected evidence,
the candidate's answer, recent conversation, evidence already established, and
the question's follow-up count. For Hiring Manager interviews it is explicitly
told to assess motivation, self-awareness, judgement, collaboration,
accountability, personal action, and outcomes—not technical trivia.

If James asks a follow-up, the next evaluation receives both saved answers:

```text
original answer + follow-up answer -> new cumulative question evaluation
```

The cumulative evaluation replaces the earlier partial one. Reports therefore
reflect the complete evidence, while the performance profile can still apply a
small penalty for needing a follow-up. The evaluator must judge only supported
evidence and must not reward confidence, answer length, buzzwords, or invented
metrics.

## Production reliability and traceability

- End-of-speech detection uses a shared 1.2-second silence window in both the
  ephemeral-token constraint and browser connection. The decision deadline is
  1.8 seconds. These values live in `domain/voice-turn-timing.ts`; do not let
  the server and browser copies drift apart.
- A semantic evaluation that fails or misses the live 1-second budget is
  recorded as unavailable, excluded from aggregate scoring, and atomically
  queued in `InterviewEvaluationJob` with the saved answer.
- Recovery runs after live responses, outside the candidate latency path. The
  daily maintenance task is the safety sweep for jobs left behind by a
  serverless shutdown.
- Jobs are content-addressed by session, question, and cumulative-answer hash.
  A later follow-up supersedes the older job, so stale recovery can never
  overwrite a newer evaluation.
- Recovery uses a lease, bounded exponential backoff, five attempts, and an
  explicit `DEAD_LETTER` state. Successful recovery rebuilds the compact report
  snapshot without reviving an expired live room.
- New sessions freeze engine, planner-prompt, decider-prompt, and
  evaluator-prompt versions. Each decision/evaluation records content-free
  provider, model, attempt, latency, fallback, and outcome metadata.
- Provider telemetry never contains prompts, answers, transcripts, responses,
  or credentials, and internal turn telemetry is removed by the public session
  serializer.
- The final conversational guard replaces generic (`tell me more`, `can you
elaborate`) or repeated model follow-ups with the authored grounded probe. It
  also strips meta-interview transitions such as “I want to stay with that
  part”; James should respond to the candidate instead of narrating topic control.

Deploy `20260914190000_interview_evaluation_recovery` before deploying the app
code. Prisma schema generation alone does not apply the database migration.

## Operations: resilience, retention, and production dashboards

Interview operations are implemented as product controls, not as transcript
logging:

- `InterviewOperationsService` enforces separate last-activity retention windows
  for authenticated and anonymous sessions. Deleting a session also deletes its
  answer-request and evaluation-job children through database cascades.
- Terminal idempotency rows (`COMPLETED`, `FAILED`, `CONFLICTED`) and terminal
  evaluation jobs (`COMPLETED`, `SUPERSEDED`, `DEAD_LETTER`) have a shorter
  independently configurable retention window. `PENDING` and `PROCESSING`
  evaluation jobs are never selected by operational cleanup while their parent
  session is retained. Once a session itself reaches its retention cutoff, all
  child rows cascade away because there is no remaining report to repair.
- Cleanup reads and deletes bounded batches and rechecks the owner class and
  cutoff in the delete predicate. A candidate who resumes an old interview
  while cleanup is selecting rows cannot be deleted by a stale selection.
- The authenticated daily maintenance route runs retention alongside evaluation
  recovery. Retention settings are explicit environment variables:

```text
INTERVIEW_AUTHENTICATED_RETENTION_DAYS=365
INTERVIEW_ANONYMOUS_RETENTION_DAYS=30
INTERVIEW_OPERATIONAL_RETENTION_DAYS=30
INTERVIEW_RETENTION_BATCH_SIZE=250
INTERVIEW_METRICS_SAMPLE_LIMIT=5000
```

- `/operations/interviews` is a server-gated, single-admin dashboard. Its
  backing `GET /api/interview/operations?hours=24` endpoint uses the same
  closed-by-default `INTERVIEW_OPERATIONS_ADMIN_USER_ID` check and returns 404
  to everyone else in every environment. The setting is a raw Clerk user id and
  is deliberately separate from the multi-user report-moderator allowlist.
- The dashboard contains only aggregates: session counts by round/phase,
  completion rate, decision and evaluation p50/p95/max latency, fallback and
  forced-decision rates, unavailable/recovered evaluation counts, queue status,
  average attempts, and oldest outstanding job age. It never returns owner or
  session ids, candidate context, answers, transcripts, prompts, evidence,
  summaries, model output, or credentials.
- Built-in alerts cover a decision p95 above the four-second live budget, a
  sustained fallback rate above ten percent, any dead-lettered evaluation, a
  pending evaluation older than fifteen minutes, and a truncated metrics
  sample. The API is suitable for an external uptime check or dashboard
  collector without giving that collector candidate content.
- Resilience tests cover malformed legacy sessions, content-free metric output,
  degraded provider/queue alerts, bounded reads, exact retention policy
  delegation, and fail-closed storage errors. Evaluation recovery tests continue
  to cover retry, dead-letter, and cumulative-answer fingerprint behavior.

Retention is permanent deletion. Production owners must choose the values with
their privacy/legal policy before launch, disclose them to candidates, and make
database backup expiry consistent with the same policy. Application deletion
cannot erase an already-created provider backup.

Deploy `20260914210000_interview_operations` after the evaluation-recovery
migration. It adds the status/time indexes used by bounded retention and queue
health queries; application code does not apply it automatically.

## Golden quality gate

The Hiring Manager engine has a versioned synthetic gold set in
`src/features/interviews/quality/golden-scenarios.ts`. It currently covers:

- vague and credible career introductions;
- first and second role-fit follow-ups;
- team-level claims that hide personal ownership;
- complete how-you-work and final-conversation answers;
- accountability, misheard audio/speech fragments, and clean move-on behavior;
- a useful, transparent response to the candidate's closing question;
- strong evidence, vague evidence, unsupported metrics, and demonstrated change
  across semantic scoring.

The deterministic test suite evaluates the fixtures and scoring logic without
making paid provider calls. The live release gate runs the actual configured
Groq/Gemini fallback path:

```bash
pnpm interview:quality
pnpm interview:quality -- --decisions-only
pnpm interview:quality -- --scoring-only
pnpm interview:quality -- --case=career-vague-needs-concrete-turning-point
pnpm interview:quality -- --write
```

The command exits non-zero unless every case has no adherence violation, every
case scores at least 85, and the suite average is at least 90. `--write` stores
a timestamped, ignored artifact under `output/interview-quality/` with model,
fallback, latency, and prompt-version evidence.

Decision checks enforce the expected action, one concise question, no repeated
planned question, no generic filler/praise/internal rubric language, and
grounding in the candidate's answer thread. Scoring checks enforce calibrated
score/verdict bands, all six keys from the active interview family's profile,
and evidence quotes that occur in the saved answer.

When the first live gold run fails, treat it as a product signal. Fix a prompt,
normalizer, or runtime guard and increment the corresponding prompt version;
do not weaken a justified gold expectation merely to make the gate green.

For HR answers, evaluate realistic motivation, judgement, collaboration,
accountability, self-awareness, and communication. Technical detail is not
required unless the question asks for it.

## Hiring Manager question plan

The current 30-minute round has eight planned questions:

1. Career story and turning points
2. Motivation for moving and next-role fit
3. Proud work, personal ownership, and impact
4. Judgement when priorities change or information is unclear
5. Conflict with a teammate or manager
6. Accountability for a mistake or setback
7. Difficult feedback and demonstrated change
8. Team/manager priorities and candidate questions

For question eight, James may give one short, transparent simulated answer. He
must not claim knowledge of a real employer that was not provided to the system.

New plans are personalized deterministically from the stored candidate profile:
the opening uses the most recent resume role, the role-fit question names the
target role and target company when present, and the ownership question names a
resume project. Missing profile evidence falls back to the authored generic
question. Candidate-authored labels are whitespace-normalized and bounded before
they enter a spoken prompt. Starting this round still makes no planning-model call.

The protected pacing anchors are introduction, role fit, how you work, final
conversation, and the candidate close. The other questions deepen those sections
when time allows.

The plan is frozen when a session is created. Code changes affect new sessions;
an existing in-progress session keeps its old plan.

## Resume + Behavioural plan

This round starts broadly, then becomes resume-specific. A full plan is capped
at eight questions:

1. Background and current work
2. Current responsibility and hardest recent problem
3. One project deep-dive
4. First resume experience claim
5. Second resume experience claim
6. One behavioural setback example
7. One selected skill from the stored resume interview kit
8. A small coding task when the kit contains one

When no coding task exists, a second skill question fills the eighth slot. This
keeps the behavioural conversation and practical check inside the 21-minute
soft-wrap window instead of attempting the previous twelve-question plan.

Its protected pacing anchors cover About you, Your work, How you work, and
Technical. When a coding task exists it is the Technical anchor; otherwise the
first selected skill question is the anchor.

The resume kit is generated earlier and reused. Starting the round assembles a
plan from stored data rather than paying for a fresh planning call.

## Reports

Every answer is stored against its question index. `createInterviewReport`
builds per-question competency results, overall evidence score, strongest area,
recommended focus, interaction counts, code results when relevant, and the
full transcript. The report UI consumes this persisted report; Gemini Live
memory is never the reporting source of truth.

The completion screen does not show duration or answer-count statistics. The
selected workspace teacher returns, says that James reported the candidate's
performance, previews the active family's evaluation parameters, motivates the
candidate, and sends them to `/reports`.

`/reports` always shows four overall family scorecards: DSA + Design, Core
Technical + Projects, HR + Behavioural, and Resume + Behavioural. Each family
card aggregates all scored interviews in that family, and the newest scored
interview is shown in detail below. The detailed headline uses the same 0–100
scale as its six family-specific parameters.
Empty families and parameters say `Not yet` instead of showing an unexplained
dash. New evaluations persist the exact family-specific rubric
keys. Every new rubric score also persists up to two exact, server-grounded
candidate quotes. The latest report ties a representative quote and transcript
timestamp to each parameter explanation (for example, `At 1:21, you said …`),
followed by the evaluator's short rationale. Compact complete conversation
rubrics are normalized once at report level so HR and resume scores use the same
0–100 presentation scale as technical and DSA scores. Low-score cards show this evidence
before the recommended next step. Older reports that predate those fields fall
back to their saved rationale or evidence-based derived parameter values so
historical sessions remain useful.

The downloaded PDF first shows the aggregate score for all four interview families,
then a detailed latest-report section with all six parameter scores, grounded
explanations, and next actions.

## Important files

- `src/features/interviews/ui/voice/gemini-live-interviewer.tsx` — Gemini audio,
  VAD, transcript events, authoritative tool responses, and response queue.
- `src/app/api/interview/gemini-live/token/route.ts` — authorised ephemeral
  token, fixed voice, initial question, and Gemini guardrails.
- `src/app/api/interview/decide/route.ts` — authenticated answer endpoint,
  rate limit, lease, and finalisation trigger.
- `src/features/interviews/server/interview.service.ts` — durable interview
  state, parallel decision/evaluation, progression, and persistence.
- `src/features/interviews/server/decider.ts` — server-side conversational
  decision for interview families that are not yet Gemini-led.
- `src/features/interviews/server/technical-answer-evaluator.ts` — semantic
  evaluation against the active interview family's six parameters.
- `src/features/interviews/domain/evaluation-profile.ts` — the four report
  families, their parameter definitions, and setup-to-family classification.
- `src/features/interviews/server/evaluation-recovery.ts` — durable evaluation
  leases, retries, stale-result protection, and report repair.
- `src/features/interviews/server/runtime-version.ts` — frozen engine and prompt
  versions used for historical traceability.
- `src/features/interviews/server/interview-operations.ts` — bounded retention,
  aggregate metrics, SLO alerts, and the production operations read model.
- `src/app/operations/interviews/page.tsx` — operator-only production dashboard.
- `src/app/api/interview/operations/route.ts` — aggregate-only dashboard API.
- `src/features/interviews/quality/golden-scenarios.ts` — versioned synthetic
  interview inputs and expected decision/scoring bands.
- `src/features/interviews/quality/interview-quality.ts` — deterministic
  adherence scorer, calibration scorer, thresholds, and live runner.
- `scripts/interview-quality-eval.ts` — opt-in real-provider release gate and
  artifact writer.
- `src/features/interviews/server/resume-round.ts` — Resume + Behavioural plan.
- `src/features/interviews/server/hiring-manager-round.ts` — final HR plan and
  targeted fallback probes, resume/job personalization, and section anchors.
- `src/features/interviews/server/hiring-manager-flow.integration.spec.ts` —
  complete start, voice-transcript, candidate-close, pacing, and report journeys.
- `src/features/interviews/ui/voice/components/conversation-transcript.tsx` —
  immutable chat transcript presentation.
- `src/features/interviews/ui/voice/components/interview-question-panel.tsx` —
  candidate-facing stages and current question.
- `src/features/interviews/server/report.ts` — report construction.
- `src/features/interviews/domain/interview-roadmap-sessions.ts` — permanent
  four-round roadmap and resume links.

## Guardrails for future changes

1. Keep James's `Charon` voice identical in both token constraints and browser
   connection config; changing only one can cause inconsistent voices.
2. Gemini may author a bounded follow-up, but the server state machine owns the
   next planned question and all follow-up/time limits. Never allow an arbitrary
   topic change through the tool result.
3. Do not send both a tool response and a second direct reply containing the
   same approved utterance; that previously caused duplicate James messages.
4. Preserve immutable transcript rows and cumulative follow-up evaluation.
5. Keep the shared 1.2-second VAD window paired with low end-of-speech
   sensitivity. The one-second browser commit grace applies to server-led rooms;
   Hiring Manager uses the blocking tool call as its boundary. If either changes,
   test candidates who pause mid-answer and update the shared timing contract.
6. Do not expose scores, evaluator reasoning, or the Gemini API key to the live
   model transcript or browser. Candidate-facing parameter names and completed
   report scores belong only in the post-interview teacher/report experience.
7. Always test a newly created session after editing a plan.
8. The workspace-coach handoff must never strand an already-created session.
   Audio failure navigates automatically, and the candidate can always skip the
   briefing or continue manually.
9. Do not remove required pacing anchors or make the hard cap elastic. Supporting
   prompts may be skipped; core section coverage is protected only until hard time.

## Verification baseline

At the time of this handoff:

- The interview/API/report suite passes 330 tests across 53 files,
  including the four evaluation profiles, family aggregation, teacher handback,
  and two complete Hiring Manager start-to-report journeys.
- The live `hr-gold-v2` gate passes all 14 cases with an average score of 100
  against a run that exercised both the configured Groq path and Gemini
  fallback. That provider run predates `evaluator-v4-round-profiles`; rerun the
  paid live gate before release if current provider evidence is required.
- A current `decider-v9-contextual-ack` live spot check passed at 100 with a
  1,223 ms Groq decision, confirming that the remaining voice delay was outside
  the server decision model before direct transcript submission was added.
- Scoped ESLint passes for the changed interview files.
- The Hiring Manager entry page responds successfully from the local Next.js
  development server.
- Repository-wide TypeScript checking still has two unrelated existing errors
  in `src/app/api/help/[...path]/route.test.ts` line 49.
- The repository-wide Vitest run passes 1,498 tests and has nine unrelated
  failures in notification HTML formatting and existing practice-roadmap/DSA UI
  expectations. The scoped interview/report/dashboard suite is green.

The older `GEMINI_LIVE_AI_INTERVIEW_REQUIREMENTS.md` is useful as migration
history, but its “current/target” and rollout sections are no longer the current
state. This handoff takes precedence for the implemented architecture.
