# Interview Requirements

What each interview round contains, how it is graded, and what separates it from the
Practice question it may share content with.

Companion to `PRACTICE_REQUIREMENTS.md`.

## The distinction that drives everything

Practice and interviews may use the **same artifact** and must not use the same **shape**.

| | Practice | Interview |
| --- | --- | --- |
| Attempts | Retry, hints, explanation | One pass |
| Answer | Typed, at your pace | Spoken, while thinking |
| Assessment | The answer | The answer *and* the follow-ups |
| Ends when | You submit | The interviewer is satisfied |

A find-the-flaw snippet is a decent practice question and an excellent interview question,
because it gives the decider something concrete to probe: *how did you spot that*, *what
would you check first*, *where exactly is the race*. **The artifact is the excuse for the
conversation; the follow-ups are the assessment.**

## Current state

Five blueprint kinds (`INTERVIEW_SESSION_KINDS`) produce six candidate-facing rounds —
`final-mock` emits the resume round ahead of itself.

| Round | Engine | Questions | Source |
| --- | --- | --- | --- |
| DSA | dedicated | 3 | DSA bank |
| core-technical | blueprint runtime | up to 8 | model-planned from blueprint |
| applied-engineering | blueprint runtime | up to 8 | model-planned from blueprint |
| architecture-system-design | blueprint runtime | up to 8 | model-planned from blueprint |
| Resume | dedicated | 4 skill + 3 experience + 1 coding task | `ResumeInterviewKit` |
| Final mock | blueprint runtime | 6 | mixed |
| *Fundamentals* | *dedicated* | *5 mcq + 3 explain + 1 scenario* | *`src/data/fundamentals`* |

`MAX_FOLLOW_UPS = 2`, `QUESTION_COUNT = 4`, `MAX_RUNTIME_QUESTIONS = 8`.
Formats available: `spoken`, `typed`, `code`, `mcq`, `diagram`.
Stages: `warm-up`, `core`, `scenario`, `design`, `reflection`, `mixed`.

### Three roadmap generations coexist

`interviewRoadmapSessions` branches three ways: a personalized plan, a legacy roadmap, or
a static fallback. **The fundamentals round only appears on the legacy path** — anyone
with a personalized plan never sees it. Decide whether it is a round or a relic; keeping
it half-wired is the worst option.

### Interviews and Practice share no content path

The fundamentals round reads `src/data/fundamentals` directly. Practice reads
`PrepQuestionTemplate`. Both seed from the same JSON through independent pipelines, so
retiring the MCQs from Practice left all 26 live in interviews. **Unify or delete one.**

## Rounds

| Round | Anchor | Action |
| --- | --- | --- |
| DSA | Problem + editor | Keep unchanged |
| **Debugging** | A `find-the-flaw` snippet, discussed aloud | **New** — maps to `core-technical` |
| **Incident** | A `diagnose` artifact, discussed aloud | **New** — maps to `applied-engineering` |
| **Design (LLD)** | A requirement + starter interface | **Rebuild** `architecture-system-design` from the LLD bank |
| Resume | The candidate's own claims | Keep — the strongest round already |
| **Behavioral** | The 8 seed prompts + `mayaPushbacks` | **New** |
| Final mock | Mixed | Keep |

Retire: the MCQ rapid stage, and the legacy fundamentals round once Debugging replaces it.

### Why MCQ has to go from interviews

No interviewer offers four options. It exists because it grades without a model call —
a cost optimization visible on the product surface. It is more wrong here than in
Practice, where it is merely weak.

## Round anatomy

Every round follows the same arc. Only the anchor changes.

1. **Anchor** — put the artifact on screen. Code, a query plan, a requirement, a résumé claim.
2. **Open question** — one sentence, spoken, no options.
3. **Follow-ups** — at most 2, chosen by the decider from what the candidate did *not* say.
4. **Close** — move on when the evidence ledger has what the stage needs.

Requirements:

- A round must be answerable without reading anything aloud that is on screen.
- The decider must never restate the artifact; it probes the answer.
- No hints, no retry, no explanation until the report. That is what Practice is for.
- Every question carries a `competency` so the round contributes to the performance profile.

## Grading

Interviews cannot use Practice's mechanical path — a spoken answer has no answer key.

| Round | Graded by |
| --- | --- |
| DSA | Test execution, plus spoken reasoning judged separately |
| Debugging | Rubric **told the planted defect**, as in Practice |
| Incident | Rubric **told the root cause**, as in Practice |
| Design | Open rubric against the blueprint's rubric keys |
| Resume | Open rubric against `expects` from the kit |
| Behavioral | Open rubric against the competency's signals |

The debugging and incident rounds inherit Practice's strongest property: the grader knows
the answer, so it judges whether the candidate reached it rather than whether the prose
was persuasive. **Reuse `buildFindTheFlawPrompt` and `buildDiagnosePrompt` rather than
writing interview variants**, with the spoken transcript as the answer.

## Personalization

Already strong and asymmetric.

- **Resume round** builds every question from the parsed résumé. Keep as the model.
- **Blueprint rounds** are planned from the personalized plan — role, level, weak
  competencies. Keep.
- **Fundamentals round** filters on level only. If it survives, bind it to the résumé the
  way Practice's `promptTemplate` does.

New rounds must select their artifact by competency gap, not at random: a debugging round
should hand over a defect in the area the performance profile says is weakest.

## Cost

A voice round is roughly **$0.68 per 30 minutes**, dominated by streamed STT and per-character
TTS. Two consequences:

- **Fewer, deeper questions.** Replacing 5 MCQs with 2 artifact questions plus follow-ups
  is close to cost-neutral on model calls and better as an interview — but it runs longer,
  and minutes are the real cost.
- **Cap round length in minutes, not questions.** `MAX_RUNTIME_QUESTIONS = 8` bounds the
  wrong axis; eight terse answers and eight discursive ones differ by several dollars.

## Build order

1. **Debugging round** — reuses the `find-the-flaw` bank, the grading prompt, and the
   existing `kind: "code"` / `codeSnippet` fields on `PlannedQuestion`. Mostly wiring.
2. Retire the MCQ rapid stage once Debugging covers the same competencies.
3. **Incident round** — same pattern with `diagnose`.
4. Resolve the three roadmap generations down to one.
5. **Behavioral round** — seeded from the 8 retired Practice prompts.
6. **Design round** rebuilt on the LLD bank.

Ship one round before building three.

## Open

- **Is the fundamentals round a round or a relic?** It is unreachable with a personalized
  plan and duplicates content Practice already serves.
- **Does a spoken transcript grade as reliably as typed prose?** The debugging rubric was
  written against typed answers; transcripts are messier, and that is worth measuring
  before three rounds depend on it.
- **Round length cap** — minutes or questions. Cost says minutes.
