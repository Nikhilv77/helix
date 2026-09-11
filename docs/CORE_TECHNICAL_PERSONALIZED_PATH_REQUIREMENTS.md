# Core Technical Practice Requirements

Status: Active

Scope: `/practice/core-technical`

## Goal

Prepare candidates for practical technical interviews with a small, personalized curriculum. The
product must teach real mechanisms through code, logs, traces, diagnosis, repair, and production
decisions. Candidate-facing copy must say **practice path**, never fictional “story”.

## Lean curriculum

The reviewed Node.js curriculum contains at most five consolidated path families:

1. JavaScript values, identity, copying, and mutation.
2. Scope, closures, and retained state.
3. Modules, asynchronous scheduling, errors, timeouts, and cancellation.
4. Event-loop health, concurrency, worker isolation, and reliability.
5. Streams, resource lifecycle, testing, and runtime diagnostics.

A path contains six focused questions. Candidates complete only the paths supported by their gaps:

- strong evidence: two or three paths;
- broader gaps: three or four paths;
- maximum curriculum: five paths, or 30 questions.

Readiness depends on demonstrated mastery and transfer, not consuming every path.

The active path is always shown first and expanded. Remaining paths retain prerequisite order,
and questions inside every path remain in teaching order. Each question row uses the same animated
disclosure, surface, difficulty, and estimated-time treatment as DSA practice.

Existing immutable eight-question snapshots remain readable. New content should migrate to the
six-question contract without rewriting saved candidate history.

## Personalization and difficulty

Every preparation decision uses:

- selected supported technology;
- candidate level and baseline answers;
- target role and company;
- resume topic and mechanism evidence;
- prior practice and assessment weaknesses.

Resume evidence prioritizes paths and familiar examples but never grants mastery by itself.

Difficulty is bounded by level:

- junior: guided or standard;
- mid-level: guided or standard;
- senior: guided, standard, or stretch.

AI may personalize presentation, evidence, examples, and follow-ups. It must not replace the
source-reviewed mechanism, introduce an unsupported ecosystem, or use obscure trivia merely to
make a question harder.

## Generation and persistence

Selecting a technology starts a live candidate-specific request:

```text
Level + resume + baseline + technology
                  ↓
Select reviewed path and mechanisms
                  ↓
Generate and independently review questions
                  ↓
Validate answers and executable exercises
                  ↓
Persist one immutable candidate snapshot
```

The request must be replay-safe and all-or-nothing. A snapshot stores its generation provenance:

- `live-personalized` for successful live generation;
- `reviewed-fallback` when providers fail and an exact reviewed fallback is used.

Fallbacks must match the selected path, technology, and difficulty. A partial or unrelated path
must never be saved. Existing saved paths remain readable when catalogue entries are retired.

## Six-question path contract

Each path should take approximately 30–40 minutes and cover six distinct interview tasks:

1. identify or explain the mechanism;
2. predict concrete behavior;
3. diagnose code, logs, a trace, or metrics;
4. repair a realistic defect;
5. implement or verify a bounded solution;
6. defend a production decision or unseen transfer.

Every prompt must be direct, independently understandable, and grounded in supplied evidence.
Avoid vague incidents, fake companies, duplicated prompts, and unexplained background.

Every question stores:

- prompt and visible artifact;
- one to three interviewer follow-ups;
- three progressive hints;
- a ten-point rubric;
- common mistakes;
- validated reference answer;
- detailed learning guide;
- deterministic runner contract and tests when executable.

The learning guide contains:

```markdown
## What is happening

## How to reason through it

## A strong interview answer

## What to avoid
```

It also includes an accessible two-to-six-step diagram. Answers, rubrics, hidden tests, critic
output, and provider data remain private until the candidate attempts or explicitly learns.

Executable exercises use the pinned Node.js 22 sandbox without network, filesystem, external
packages, randomness, or wall-clock dependence.

## Path library UI

The overview shows all reviewed path families as expandable cards, following the DSA pattern
library interaction:

- each card summary shows status, difficulty, topic, and progress;
- expanding a card shows its ordered question list;
- every question row is the action; there are no separate **Start path** or **Open saved path**
  controls;
- selecting a question in an unstarted path prepares that path invisibly, opens the chosen
  question, and does not replace the current path;
- questions from a prepared or historical path link directly to their saved workspace;
- progress completed in a non-current path remains attached to those same questions when that
  path later becomes current;
- the current path is expanded by default.

Cards use a restrained premium accent border for the selected state. Do not use an accent gradient,
blur, glow wash, or decorative fade across the card surface. Hover and focus states must remain
clear on desktop, keyboard, and touch layouts.

## Assessment and readiness

After a path, the dedicated Core Technical assessment checks explanation, diagnosis, repair,
implementation evidence, and production judgment. It must not route through the generic interview
setup.

Only the current path can unlock or run a block assessment. Completing questions in another path
saves their progress but does not create assessment eligibility. After the current assessment, the
recommended next path becomes current; if it was prepared early, its existing solved and learned
states are reused. Previous and next navigation keeps every prepared path accessible.

The result either:

- marks the covered mechanisms ready;
- recommends one next material gap; or
- ends preparation when no essential gap remains.

Learned questions receive no solved-mastery credit. Executable claims require accepted runner
evidence.

## Supported scope

The current executable domain is JavaScript on Node.js 22, including TypeScript, NestJS, Express,
Fastify, Koa, and Next.js framing. Unsupported languages or ecosystems must not be offered from
resume inference.

The technology welcome remains inside the authenticated dashboard shell. The teacher avatar stays
visible on mobile, uses bounded alpha feathering, and avoids decorative blur layers.

## Acceptance criteria

1. Technology selection triggers replay-safe live personalization.
2. Ranking uses level, baseline, resume, target role, history, and assessments.
3. New paths follow the six-question progression; old eight-question snapshots remain readable.
4. Every new question has a complete answer, learning guide, and accessible diagram.
5. Executable questions pass the pinned Node.js 22 audit before persistence.
6. Provider failure uses only an exact reviewed fallback with truthful provenance.
7. The library uses expandable cards, makes question rows the only action, and exposes saved
   questions as direct links without path-management buttons.
8. The selected card uses a premium accent border without an accent surface fade.
9. Only the current path unlocks assessment; promotion preserves progress completed in loose paths
   and can stop preparation when mastery is sufficient.
10. No private answer material or candidate-specific generated path is globally published.

## Implementation steps

Work is delivered and verified in this order so each later layer depends on a stable earlier one:

1. **Curriculum and compatibility** — keep the reviewed path catalogue lean, preserve immutable
   legacy snapshots, and define the six-question progression for newly generated paths.
2. **Personalized selection** — apply technology, level, baseline, resume, role, company, history,
   and assessment evidence while enforcing the supported runtime and difficulty bounds.
3. **Safe generation and persistence** — generate, review, audit, and atomically persist a complete
   path with truthful provenance and replay-safe request IDs.
4. **Loose path library** — make every question row directly actionable, lazily prepare an
   unstarted path behind the selected row, keep that work non-current, and never expose separate
   path-starting or path-opening controls.
5. **Question workspace and learning** — support the required answer modes, progressive hints,
   deterministic execution, private-answer boundaries, complete learning guides, and accessible
   diagrams.
6. **Current-only assessment and progression** — unlock assessment only for the current path,
   distinguish solved from learned, choose one material next gap, promote an already prepared next
   path without losing question progress, and retain previous/next access to history.
7. **Experience and release verification** — match the DSA library interaction, retain the premium
   border treatment, verify mobile and keyboard behavior, run contract/security/sandbox tests, and
   confirm legacy snapshots still open.

Implementation status is tracked in code and tests rather than duplicating a volatile checklist in
this requirement. Steps may be marked complete only after their acceptance tests pass.
