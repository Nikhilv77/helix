# Gemini Live AI Interview Migration Requirements

## 1. Purpose

Replace the real-time AI voice-interview path with Gemini Live API native audio.

This migration is limited to the **live, adaptive interview**. It does not include
pre-generated greetings, introductions, or fixed question audio; those are a
separate future optimisation.

The outcome is a browser-to-Gemini Live connection that provides low-latency
speech-to-speech interaction while Trailgrad remains the authority for interview
state, question progression, scoring, and finalisation.

## 2. Current and Target Architecture

### Current

```text
Browser -> LiveKit room -> persistent Python worker
                           -> Deepgram Flux (STT)
                           -> POST /api/interview/decide
                           -> Groq or Gemini decision
                           -> Deepgram Aura-2 (TTS)
                           -> LiveKit audio track -> Browser
```

### Target

```text
Browser microphone <-> Gemini Live API (native audio)
                         |
                         +-> Trailgrad backend tools / actions
                              -> interview state, progression, scoring, finalisation
                              -> Supabase
```

The browser obtains a short-lived Gemini credential from Trailgrad, then opens
the Live API connection directly. Audio must never traverse the Trailgrad
backend and no long-lived Google API key may be exposed to the browser.

## 3. Scope

### In scope

- Native-audio Gemini Live session for the existing voice interview UI.
- Interviewer persona, turn-taking, barge-in, and adaptive spoken responses.
- Gemini tool/function calls to perform authoritative interview actions.
- Candidate and interviewer transcript persistence.
- Session reconnect/resumption, context management, user-facing recovery states,
  feature flagging, and cost/quality telemetry.
- A safe migration path and rollback to the current LiveKit + Deepgram path.

### Explicitly out of scope

- Pre-generating static greetings, introductions, questions, or hints with
  VoiceStudio or another TTS system.
- Removing LiveKit from peer-help/human-to-human calls.
- Changing question-generation rules, rubric design, session/database schema,
  final assessment logic, or subscription limits.
- Replacing the existing final report / rubric evaluation model.

## 4. Product Requirements

### 4.1 Interview behaviour

1. The candidate can start, pause, resume, and finish an interview from the
   current voice-interview UI.
2. The interviewer speaks naturally and can be interrupted by the candidate.
   On an interruption, queued browser audio is discarded immediately.
3. The interviewer follows the existing interview roadmap and does not invent
   progression. It must call Trailgrad tools for state-changing actions.
4. The interviewer can ask follow-up questions and provide a contextual hint,
   but must remain within the active question and interview stage supplied by
   the backend.
5. A candidate's spoken answer is persisted as a transcript with an idempotency
   identifier and timings where available.
6. The existing completion workflow and asynchronous assessment finalisation
   still run exactly once.
7. The user sees clear states for connecting, listening, thinking/speaking,
   reconnecting, microphone denied, connection failure, and interview complete.

### 4.2 Authoritative backend actions

Gemini may request actions; it must not directly write to the database. The
backend validates the authenticated user, session ownership, active session
state, inputs, rate limits, and idempotency before each action.

The initial tool set should be deliberately small:

| Tool | Backend responsibility | Result returned to Gemini |
| --- | --- | --- |
| `get_interview_context` | Read active stage, active question, constraints, and allowed actions | Compact authoritative context |
| `submit_answer` | Persist one candidate answer and advance/evaluate via existing interview service | Next phase, question, and spoken guidance |
| `request_hint` | Check hint eligibility and obtain the existing contextual hint | Approved hint text only |
| `finish_interview` | Validate completion, mark done, trigger existing finalisation once | Completion acknowledgement |

`submit_answer` must reuse the existing `POST /api/interview/decide` domain
behaviour (or a server-only service extracted from it). Do not duplicate
interview progression logic in a Gemini prompt or a new client-side state
machine.

## 5. Technical Requirements

### 5.1 Connection and credentials

- Add a server-side endpoint that issues a Gemini Live ephemeral token scoped
  to the authenticated user and active interview session.
- Apply rate limiting and prevent a user from opening multiple active live
  sessions for the same interview.
- The frontend connects directly to Gemini Live via WebSocket using the
  ephemeral token. It never receives `GEMINI_API_KEY`.
- Use a feature flag such as `VOICE_INTERVIEW_PROVIDER=livekit|gemini-live`.
  Existing sessions always continue on the provider on which they began.

### 5.2 Audio client

- Capture microphone audio only after explicit user permission.
- Resample mic input to the format required by Gemini Live and send small,
  continuous chunks (target 20–40 ms).
- Play model audio as a streaming buffer; do not wait for a full response.
- On a Gemini interruption signal, stop and clear queued playback immediately.
- Support device changes, mute, page visibility changes, and clean teardown of
  microphone tracks and WebSocket resources.

### 5.3 Long sessions and recovery

- Support the product's current 5–60 minute configured session durations,
  including the common 30-minute case.
- Enable Gemini Live context-window compression for long audio sessions.
- Retain and use session-resumption data so a transient WebSocket reset can
  reconnect without losing the interview context.
- Persist a compact session checkpoint after each authoritative action. If a
  resume fails, show a retry path or fall back to a typed answer rather than
  silently losing the candidate's answer.
- Use a connection timeout and retry budget. After exhaustion, present an
  actionable error and leave the interview session recoverable.

### 5.4 Prompt and guardrails

The Gemini system instruction must include:

- interviewer identity, tone, and concise response style;
- the active role, level, interview type, current stage, and active question;
- explicit instruction to call tools for progression, hints, answer recording,
  or completion;
- rules not to reveal rubrics, fabricate scores, skip stages, or claim an
  answer was saved until the tool succeeds;
- a short response limit to prevent over-talking;
- recovery language for tool failure and candidate audio ambiguity.

The backend should send only the minimum current context. It must not place the
entire historical transcript or internal scoring prompt into every tool result.

### 5.5 Transcript and state

- Capture Gemini-provided input and output transcriptions when available.
- Store utterances against the existing interview session with speaker, text,
  timestamp, provider, and a stable turn identifier.
- Reconcile a final candidate transcript before calling `submit_answer`.
  Partial/live captions are UI-only until a turn is accepted.
- The database-backed Trailgrad interview service remains the source of truth;
  Gemini session memory is only a conversational cache.

### 5.6 Observability and cost controls

For every Gemini Live session record:

- session ID, user ID, provider, model/version, start/end time, disconnects,
  resumption count, and completion status;
- audio input/output duration or token usage supplied by the API;
- estimated cost and actual billed usage when available;
- time to first audio, interruption count, tool-call success/failure, and
  end-to-end answer-processing latency;
- a privacy-safe error reason, never raw API credentials or unnecessary audio.

Set a hard maximum live-session duration equal to the selected product limit.
Warn the user before expiry and finish cleanly rather than allowing unbounded
billable audio.

## 6. Security and Privacy Requirements

- Google API keys remain server-only; browser credentials are short-lived and
  scoped to a single authorised interview.
- Every state-changing tool endpoint authenticates the user and verifies
  ownership through the existing session-access rules.
- Tool endpoints must not trust a session ID, user ID, score, phase, or answer
  state asserted by Gemini or the browser.
- Avoid logging raw microphone audio. Follow the existing transcript retention
  policy and disclose the third-party voice processor in the product privacy
  notice before release.
- Protect against duplicate tool calls using the existing answer lock and a
  stable turn/idempotency key.

## 7. Migration Plan

### Phase 0: Baseline

- Preserve the current LiveKit/Deepgram route unchanged.
- Record baseline latency, completion rate, interruption behaviour, and actual
  cost for at least 20 representative interviews.

### Phase 1: Internal proof of concept

- Implement direct Gemini Live audio in a development-only route.
- Implement read-only `get_interview_context` and one end-to-end answer flow.
- Confirm authentication, ephemeral-token expiry, streaming audio, transcript
  capture, and no server API-key leakage.

### Phase 2: Controlled beta

- Add all required tools, recovery handling, telemetry, and feature flag.
- Run internal and opt-in beta interviews using both providers.
- Compare results against the baseline with the same scenarios.

### Phase 3: Rollout

- Enable Gemini Live for a small percentage of new AI interview sessions.
- Keep the LiveKit route as an immediate rollback option.
- Increase rollout only after acceptance criteria are met.

### Phase 4: Retirement

- After a stable production window, remove AI-interview usage of:
  - `src/app/api/livekit/token/route.ts`;
  - the AI-specific LiveKit code in the voice interview client;
  - the Python `agent/` worker, its deployment, and its Deepgram credentials.
- Do **not** remove LiveKit configuration or dependencies still used by peer
  help calls.
- Remove unused Deepgram configuration only after auditing non-interview voice
  features such as `/api/voice/speak`.

## 8. Acceptance Criteria

The migration is ready for general availability only when all are true:

1. A 30-minute interview can complete with normal browser/network conditions
   without losing a submitted answer or duplicating a state transition.
2. Candidate interruption stops interviewer playback promptly and Gemini
   responds to the new turn rather than continuing stale audio.
3. A transient socket disconnect can resume, or the UI gives the candidate a
   recoverable path without losing the interview session.
4. Existing final reports and assessment finalisation still complete exactly
   once.
5. The Gemini route meets or improves the current route's p95 perceived
   response latency and user-rated interview quality in the beta cohort.
6. Per-session audio usage and cost are visible in telemetry, and duration caps
   are enforced.
7. Security review confirms no browser-exposed long-lived key and no
   unauthorised tool/state mutation.
8. The current provider can be restored for new sessions by configuration
   without a redeploy.

## 9. Open Decisions Before Coding

1. Select the exact Gemini Live model/version after a small quality and cost
   evaluation; the Live API is preview, so this must not be hard-coded into
   business logic.
2. Confirm whether Gemini Live function calls will go browser -> Trailgrad
   backend, or Gemini -> a server-side tool gateway. The former gives lower
   latency; the latter offers stronger tool credential isolation. Either design
   must enforce the security requirements above.
3. Define the beta cohort, success threshold, and maximum session duration.
4. Decide whether the live model may speak the initial question in this phase,
   pending the later static-audio work.

## 10. Reference Documentation

- [Gemini Live API overview](https://ai.google.dev/gemini-api/docs/live-api)
- [Gemini Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices)
