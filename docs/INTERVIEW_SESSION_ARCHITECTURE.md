# Interview Session Architecture

**Status:** In progress. Technical Deep Dive consolidation is implemented; System Design and Full
Mock specialization remain.
**Primary decision:** Present five interview session types instead of exposing every internal
practice discipline as a separate interview card.
**Canonical dashboard:** `/interviews`

## 1. Product decision

Trailgrad should present these five interview sessions:

1. **DSA Coding Interview**
2. **Technical Deep Dive**
3. **System Design Interview**
4. **Resume & Behavioral Defense**
5. **Full Mock Interview**

The Interviews dashboard now combines Core Technical and Applied Engineering as one
candidate-facing **Technical Deep Dive** while retaining them as separate internal evidence domains.

Practice and Interviews have different jobs:

- **Practice** teaches and evaluates one discipline at a time.
- **Interviews** combine evidence into realistic, time-bounded rounds.

The Interviews dashboard should therefore not reproduce the entire Practice roadmap one card at a
time.

## 2. What already exists

The repository already contains most of the required infrastructure.

| Target session              | Existing implementation                                                                                         | Current state                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| DSA Coding Interview        | Dedicated `/interview/dsa` entry, solved-question readiness gate, selected DSA problems, code editor and voice  | Complete                          |
| Technical Deep Dive         | One four-question interview derived from the active Core Technical and Applied Engineering blueprints           | Consolidated and launchable       |
| System Design Interview     | Personalized `architecture-system-design` blueprint launched through the generic interview setup and voice room | Functional but not specialized    |
| Resume & Behavioral Defense | Dedicated `/interview/resume` entry backed by the saved resume interview kit                                    | Complete                          |
| Full Mock Interview         | Personalized `final-mock` blueprint launched through the generic interview engine                               | Functional but relatively generic |

Shared capabilities already include:

- the `/interviews` roadmap dashboard;
- personalized immutable interview plans;
- the shared `/interview/voice` room;
- microphone, camera and media-permission setup;
- spoken and typed answers;
- DSA code editing and execution evidence;
- resume-specific and fundamentals-specific live workspaces;
- durable session state, answer replay protection and session resumption;
- daily interview quotas and creation/evaluation leases;
- interview history, reports and performance evidence;
- dedicated DSA, resume and fundamentals start routes;
- generic blueprint-driven session creation for Core, Applied, Architecture and Final Mock rounds.

## 3. Current route model

The present route chain is:

```text
/interviews
  ├─ /interview/dsa
  ├─ /interview/fundamentals
  ├─ /interview/resume
  ├─ /interview?plan=...&coreBlueprint=...&appliedBlueprint=...
  ├─ /interview?plan=...&blueprint=...
  └─ /interview?roadmapSession=...
                    ↓
       /interview/voice?session=...
                    ↓
       session, decision and report APIs
```

Compatibility routes remain in place:

- `/interview/text` redirects an existing session to the voice room;
- `/interview/dsa/[slug]` redirects legacy per-question links to `/interview/dsa`.

The target consolidation does not require replacing the shared voice engine or deleting stable
internal blueprint identities.

## 4. Target session definitions

### 4.1 DSA Coding Interview

Keep the existing dedicated DSA flow.

The round should test:

- problem clarification and approach selection;
- implementation correctness;
- time and space complexity;
- edge cases and verification;
- one small production-oriented follow-up when relevant.

Core Technical and Applied Engineering should not be folded into this round. A coding interview has
a different pace, workspace and evaluation model. Production follow-ups can enrich DSA, but they
cannot replace a technical deep dive.

### 4.2 Technical Deep Dive

Combine Core Technical and Applied Engineering into one candidate-facing session.

A typical four-question round should contain:

1. one runtime, language or computer-fundamentals mechanism question;
2. one debugging or production-incident investigation;
3. one implementation, testing or trade-off question;
4. one operational-safety or delivery follow-up.

The initial implementation keeps a predictable two-Core/two-Applied balance. The active
personalized plan still adapts each question's topic, format and difficulty from the candidate's
saved evidence. A later policy may change the cross-domain ratio once real completion data supports
that decision.

Core and Applied must retain separate internal identifiers, rubrics, snapshots and analytics. The
merge is a presentation and interview-orchestration decision, not a persistence migration.

### 4.3 System Design Interview

Keep System Design separate.

Unlike a technical deep dive, this round should remain on one coherent scenario for approximately
30–40 minutes:

```text
requirements and constraints
  → capacity and API/data model
  → architecture and request/data flow
  → failure, security and operability
  → explicit trade-offs and evolution
```

The stable interview blueprint identity remains `architecture-system-design`. The Practice feature
continues to use `architecture-design`; these persisted identities must not be renamed or merged.

The existing generic blueprint launch is usable, but the finished experience should have
system-design-specific pacing, prompts and evaluation rather than feeling like a generic spoken
round.

### 4.4 Resume & Behavioral Defense

Keep the existing dedicated resume flow.

It should continue to use saved resume evidence to test:

- project and experience claims;
- personal ownership versus team ownership;
- decisions and rejected alternatives;
- measurable impact;
- failures, conflict and leadership;
- consistency between the resume and spoken evidence.

### 4.5 Full Mock Interview

Keep Full Mock as the final synthesis round, not another teaching track.

The round should last approximately 45–60 minutes and sample the candidate's actual target loop. A
software-engineering version can combine coding, technical reasoning, system design and behavioral
evidence. Role-specific plans may alter the mix without changing the stable `final-mock` identity.

The first Full Mock may be allowed as an early diagnostic. Later attempts should use the latest
Practice and interview evidence to emphasize unresolved gaps.

## 5. Candidate-facing dashboard

The target `/interviews` order is:

| Order | Card                        | Typical duration | Launch behavior                                        |
| ----: | --------------------------- | ---------------- | ------------------------------------------------------ |
|     1 | DSA Coding Interview        | 15–25 minutes    | Dedicated DSA entry and live coding room               |
|     2 | Technical Deep Dive         | 20–30 minutes    | Adaptive Core/Applied blueprint                        |
|     3 | System Design Interview     | 30–40 minutes    | One coherent role-aligned design scenario              |
|     4 | Resume & Behavioral Defense | 20–30 minutes    | Dedicated resume entry                                 |
|     5 | Full Mock Interview         | 45–60 minutes    | Mixed blueprint using the candidate's current evidence |

Only candidate-facing cards are consolidated. Internal telemetry should still record which domain,
question source, rubric and blueprint produced every piece of evidence.

## 6. How many attempts a candidate needs

Trailgrad should not claim readiness from a fixed interview count. A useful default path is:

1. one DSA diagnostic;
2. one Technical Deep Dive;
3. one System Design round;
4. one Resume & Behavioral round;
5. one Full Mock;
6. targeted repeats for weak evidence;
7. one final Full Mock.

Most candidates will therefore complete approximately **6–9 interview attempts**, even though the
dashboard contains only five reusable session types.

Readiness should be evidence-based. A practical release rule is:

- at least one completed attempt in each role-relevant focused session;
- no unresolved critical competency gap;
- two consecutive rounds at or above the product's defensible threshold;
- at least one completed Full Mock;
- stable performance without answer leakage or evaluator fallbacks.

The exact score threshold should be calibrated from real usage rather than invented in UI code.

## 7. Gaps in the current `/interviews` implementation

The current routes compile and the existing interview tests pass, but consolidation should address
these issues.

### 7.1 Public session projection

`GET /api/interview/[sessionId]` currently returns the complete saved `setup`. That object can include
all selected DSA question slugs and a personalized blueprint with rubric signals. The public response
should expose only what the active workspace needs, such as:

- role, round type, duration and safe display labels;
- current workspace mode;
- the current DSA question identity when required;
- the minimum block-assessment identity needed for completion routing.

Future question identities, private planning inputs and evaluator/rubric material should remain on
the server.

### 7.2 Complete workspace history

`/interviews` now combines voice-session history with Core Technical and Applied Engineering
assessment rounds. Architecture already provides an owner-scoped `rounds()` projection but is not
included yet.

The dashboard and `/reports` should aggregate:

```text
voice interview rounds
  + Core Technical assessment rounds
  + Applied Engineering assessment rounds
  + Architecture & Design assessment rounds
```

Synthetic Practice assessment IDs are not voice-session UUIDs. Resume links must therefore route
each Practice-backed round to its owning Practice page instead of `/interview/voice`.

### 7.3 Quota behavior

When the daily quota is exhausted, only an already-active quota-consuming interview should remain
resumable. The current dashboard enables every card whenever any active interview exists. New-round
cards should stay disabled while the matching active card remains available.

If quota or history cannot be loaded, the UI must not silently claim that zero sessions were used.
Render an explicit recoverable state while preserving independently loaded plan and history data.

### 7.4 Route boundaries and tests

The interview setup and voice routes currently use empty loading fallbacks and have no local
`error.tsx` boundary. They should provide visible, accessible loading and recovery states.

Add direct coverage for:

- `/interviews` data aggregation and partial service failure;
- all five card destinations and resume behavior;
- quota-exhausted cards with and without an active session;
- generic personalized blueprint start;
- DSA, resume and fundamentals start handlers;
- session GET/DELETE authorization and public serialization;
- decision replay, lease release and completion finalization;
- missing, expired, completed, malformed and foreign session IDs;
- desktop/mobile authenticated navigation through each target session.

## 8. Suggested implementation order

### Step 1 — Protect the session response

Introduce an explicit public session/setup contract and test that upcoming questions, DSA slugs,
answer keys and personalized rubric material cannot cross the API boundary.

### Step 2 — Complete history aggregation

Read Core, Applied and Architecture round projections independently, merge them with voice history,
sort once, and preserve partial results when one service fails. Apply the same aggregation to
`/reports`.

### Step 3 — Consolidate the dashboard

Replace the separate Core and Applied cards with a single Technical Deep Dive card. Keep their
internal evidence sources intact and define a deterministic adaptive mix policy.

**Implemented:** the dashboard presents one Technical Deep Dive card; launch validation resolves
the exact active Core and Applied source IDs; the server derives an immutable, replay-stable
four-question blueprint with two questions from each source.

### Step 4 — Specialize System Design and Full Mock

Reuse the shared voice room while adding round-specific pacing, public workspace copy and evaluation
rules. Do not copy the entire interview runtime.

### Step 5 — Fix resilience and quota UX

Make disabled/resume behavior card-specific, add non-empty loading and error boundaries, and expose
recoverable partial-data states.

### Step 6 — Release verification

Run focused unit and route tests, all interview/service regressions, TypeScript, ESLint and the
production build. Then complete authenticated desktop and mobile browser passes for all five cards,
resume paths, quota states, completion and reports.

## 9. Definition of done

The consolidation is complete when:

- `/interviews` presents exactly five ordered session types;
- DSA and Resume retain their dedicated flows;
- Technical Deep Dive adaptively combines Core and Applied evidence without merging their storage;
- System Design stays on one coherent scenario with design-specific evaluation;
- Full Mock samples the candidate's role-relevant loop;
- current sessions remain resumable and quota-exhausted new starts are disabled;
- Core, Applied and Architecture assessment history appears in Interviews and Reports;
- public session APIs expose no future-question or private-rubric material;
- all five routes have visible loading, error and recovery behavior;
- owner scoping, replay protection, rate limits and leases remain intact;
- authenticated desktop and mobile end-to-end verification passes.

## 10. Non-goals

- Do not merge Practice and Interviews into one product surface.
- Do not place the complete Core or Applied curriculum inside the DSA interview.
- Do not combine System Design into disconnected Technical Deep Dive questions.
- Do not rename `architecture-system-design` or other persisted blueprint identities.
- Do not migrate Core, Applied or Architecture evidence into one shared database model.
- Do not replace the shared voice room with five copied interview runtimes.
- Do not infer readiness from interview count alone.
