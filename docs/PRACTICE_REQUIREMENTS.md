# Practice Requirements

What each Practice session contains, in what format, and how it binds to the resume.

The six `PRACTICE_SESSION_KEYS` slots stay — they keep Practice mirroring Interviews.
Only the contents change.

## Sessions

| Key | Contains | Formats | Target |
| --- | --- | --- | --- |
| `frontend-dsa` | Unchanged | code + tests | 200 (done) |
| `core-technical` | What the *language* does: event loop, async ordering, closures, memory, references | A, B | 60 |
| `applied-engineering` | What the *system* does: query plans, indexes, N+1, caching, latency, retries, races | B, C, D | 90 |
| `architecture-system-design` | LLD first — interfaces, rate limiter, LRU, thread safety, data modelling. HLD is one closing chapter. | B, D, typed | 50 |
| `resume-behavioral-defense` | Retire. Resume is covered by `resume-round.ts`; behavioral becomes a 4th interview round. Keep the 8 items as seeds. | — | 0 |
| `final-mock` | Unchanged, draws from the above | mixed | — |

## Formats

Every question is one of four. Mechanical verification is required where the format allows it.

**A — `predict-run`.** Show code, candidate commits to the output, then it runs via
`/api/code/run` (already accepts code with no `slug`).
`answerKey: { expectedStdout }` · verified mechanically.

**B — `fix-the-test`.** Broken code + failing tests, candidate makes them pass.
`answerKey: { referenceFix, hiddenTests? }` · verified by Judge0 through `code-test-harness.ts`.

**C — `find-the-flaw`.** Working-looking code with one planted defect, candidate names it.
`answerKey: { flaw, line, category }` · rubric against the known defect.

**D — `diagnose`.** A real artifact (query plan, waterfall, log, latency graph) plus a
symptom. `answerKey: { rootCause, acceptableFixes }` · rubric against the planted cause.

**Legacy.** `mcq` → demoted to a placement quiz, excluded from Practice progress and
volume counts. `typed` → permitted only in `architecture-system-design`.

## Personalization

Three tiers. Tiers 1–2 exist; tier 3 is new.

1. **Eligibility filter.** `roles[]` and `levels[]` must be populated on every template.
   Empty means universal, which is how the bank went generic.
2. **Evidence-gap selection.** `competency` and `whatItTests[]` must be accurate — they
   join to `CandidatePerformanceProfileVersion`.
3. **Resume-bound rendering.** Fill `PrepQuestionTemplate.promptTemplate` (exists, unused):

   ```
   {{primaryLanguage}}  dsaEditorLanguage
   {{framework}}        most frequent skill in resumeAnalysis.experience[].skills
   {{projectName}}      resumeAnalysis.projects[].name
   {{employer}}         resumeAnalysis.experience[].organization
   {{targetCompany}}    CandidateProfile.targetCompany
   {{level}}            CandidateProfile.level
   ```

Rules:

- Optional. No `promptTemplate` → render `prompt` unchanged.
- Any slot unresolved → fall back to `prompt` entirely. Never show a half-filled template.
- **Slots affect framing only, never the answer.** Same `answerKey` regardless of which
  slots filled, or verification breaks.
- Skip personalization below a `resumeConfidence` threshold. A wrong employer name costs
  more trust than a generic prompt.

## Authoring

Agent drafts → mechanical self-check → `DRAFT` → human promotes to `PUBLISHED`.

Self-check before a human sees it:
- A: run it, actual stdout must equal `expectedStdout`.
- B: tests must fail on the broken source and pass on `referenceFix`.
- C, D: no mechanical check — closer human review.

Never publish an unverified A or B item.

## Build Order

No `sessionKey` backfill is needed. `prisma/seed.ts` already derives both keys via
`prepSessionKey(bank, competency)` and `prepChapterKey(...)`, so existing rows are
populated. New content only has to pick a `competency` those functions map correctly, or
set `sessionKey` explicitly in the JSON.

1. **Format A in `core-technical`, 10 questions by hand.** Mechanical verification, no
   rubric to tune — proves whether candidates finish artifact-based sessions.
2. Move the 42 `mcq` items to a `placement` bank.
3. Audit the 25 typed items: convert to C or D where possible, else `ARCHIVED` (not deleted).
4. Format B. → 5. Tier 3 personalization. → 6. C and D in `applied-engineering`.
   → 7. LLD chapters. → 8. Authoring agent.

Ship one format before building four.

## Open

- Format A output is runtime-specific: restrict to `dsaEditorLanguage`, or 4× the authoring.
- HLD has no mechanical verification — accept rubric-only, or leave it to Trailguide.


## Progress

**Goal.** Replace MCQ and essay practice with artifact-based sessions that are graded
mechanically wherever possible, personalized from the resume, at DSA-level depth
(~200 non-DSA items).

### Done

**Format A plumbing — end to end.**

| Change | File |
| --- | --- |
| `predict-run` added to the format union | `lib/practice/prep-practice.ts` |
| `snippet` field on the client question | `lib/practice/prep-practice.ts` |
| `expectedOutput` on the review, revealed only after submit | `lib/practice/prep-practice.ts` |
| Normalisation, comparison, answer-key parsing | `lib/practice/predict-run.ts` (new) |
| 16 tests covering ordering, whitespace, malformed keys, answer leakage | `lib/practice/predict-run.test.ts` (new) |
| Format accepted by the adapter and evidence pipeline | `practice/questions/prep-question-adapter.ts`, `questions/contracts.ts`, `practice-evidence.ts`, `practice-evidence-store.ts` |
| Deterministic grading beside the `mcq` branch | `practice/prep-practice-evaluator.ts` |
| Snippet exposed, `expectedStdout` withheld | `practice/prep-practice.service.ts` |
| `PredictRunPanel` — read-only code, blind prediction, side-by-side reveal | `practice/prep-question-workspace.tsx` |
| Format + answer-key validation in the bank audit | `practice/questions/prep-bank-audit.ts` |

**10 `core-technical` questions — authored and verified.**

`src/data/prep/javascript-runtime-predict.json`, chapter `javascript-runtime`:

| # | Question | Tests |
| --- | --- | --- |
| 01 | Sync, microtask, macrotask | queue ordering |
| 02 | A microtask queued from a microtask | FIFO during drain |
| 03 | `await` is a pause, not a wait | suspension on non-promises |
| 04 | `var`, closures, and the loop that already finished | shared binding |
| 05 | Two loops, two capture rules | `let` vs `var` capture |
| 06 | Hoisted, but not initialised | temporal dead zone |
| 07 | Copies that are not copies | reference vs shallow copy |
| 08 | `map` takes a snapshot | eager evaluation |
| 09 | A rejection is still a microtask | async throw semantics |
| 10 | Concurrent awaits interleave | interleaving vs parallelism |

All 10 expected outputs were verified by executing the snippets under Node.
`practice/questions/predict-run-bank.test.ts` re-runs every snippet on each test run, so a
drifted answer key fails the suite instead of failing a candidate.

Design decisions taken while building:

- **Grading compares against the authored `expectedStdout`, not a live run.** The value is
  verified against a real execution at authoring time, so the result is identical and no
  Judge0 call is paid per submission.
- **The answer never reaches the browser before submission.** `predictRunSnippet()` exists
  as its own function so dropping `expectedStdout` is deliberate and cannot be undone by a
  refactor that spreads the object. Covered by a test.
- **Whitespace-forgiving, order-strict.** Trailing spaces, blank lines and CRLF are
  normalised away; line order is not. Order is the thing being tested.
- **A malformed answer key returns "unverified", never "incorrect".** An authoring fault
  must not cost a candidate mastery.
- Grading and UI share one comparison function, so a candidate cannot see "correct" in the
  workspace and "incorrect" in their report.

**Format C — `find-the-flaw`, plumbing and first batch.**

| Change | File |
| --- | --- |
| Answer-key parsing, snippet extraction, line-range validation | `lib/practice/find-the-flaw.ts` (new) |
| `flaw` on the review, revealed only after submit | `lib/practice/prep-practice.ts` |
| Flaw-aware grading prompt — the grader is told the planted defect | `practice/prep-practice-evaluator.ts` |
| Format accepted across adapter, contracts, evidence, seed, audit | 6 files |
| `FindTheFlawPanel` — numbered code gutter, reveal highlights the line | `practice/prep-question-workspace.tsx` |
| 10 questions, 4 chapters | `data/prep/applied-engineering-flaws.json` (new) |
| 52 bank checks — key validity, line in range, audit thresholds, answer leakage | `questions/find-the-flaw-bank.test.ts` (new) |

Questions: N+1, unbounded cache, floating promise, lost-update race, non-idempotent
retry, sequential awaits, unstable pagination sort, missing effect cleanup, `Promise.all`
masking partial failure, filtering after a full scan.

Design decisions:

- **The grader is handed the planted defect.** The question becomes "did they identify
  this specific thing", not "is this a good essay" — a far more reliable judgment for a
  model. Wording is explicitly not graded; the mechanism described is.
- **Format C has no mechanical grader**, so the bank test checks what it can: the line
  points at a real non-blank row, the key parses, every audit threshold is cleared, and
  the prompt does not name the defect it is asking about.
- **Line numbers render in a gutter column**, not baked into the text, so a copied
  snippet stays runnable.

**Tier 3 personalization — resume-bound prompts.**

| Change | File |
| --- | --- |
| Slot resolution, confidence gate, all-or-nothing fallback | `lib/practice/prompt-personalization.ts` (new) |
| 11 tests — tie stability, partial fallback, unknown slots, threshold | `lib/practice/prompt-personalization.test.ts` (new) |
| Prompt rendered per candidate at read time | `practice/prep-practice.service.ts` |
| `promptTemplate` on 6 find-the-flaw questions | `data/prep/applied-engineering-flaws.json` |

Slots live: `{{framework}}`, `{{projectName}}`, `{{targetCompany}}`. `{{primaryLanguage}}`,
`{{employer}}` and `{{level}}` resolve but are unused so far.

Two things worth keeping:

- **Ties resolve alphabetically.** A resume with equally frequent skills would otherwise
  render a different prompt between views, making a question look edited.
- **A `promptTemplate` is a reframing of `prompt`, never an independent sentence.** Writing
  them separately let three templates drift onto entirely different questions — the code
  showed an N+1 while the prose described a regex. Templates are now derived from the
  question's own prompt, and a word-overlap test in `find-the-flaw-bank.test.ts` fails if
  one drifts. That test was confirmed to catch a deliberately mismatched template.

**Format D — `diagnose`, plumbing and first batch.**

| Change | File |
| --- | --- |
| Answer-key parsing, artifact extraction, kind validation | `lib/practice/diagnose.ts` (new) |
| `artifact` on the question, `diagnosis` on the review | `lib/practice/prep-practice.ts` |
| Cause-aware grading prompt, any accepted fix counts | `practice/prep-practice-evaluator.ts` |
| `DiagnosePanel` — symptom, evidence, root-cause reveal with all fixes | `practice/prep-question-workspace.tsx` |
| 12 questions across 4 artifact kinds | `data/prep/applied-engineering-diagnose.json` (new) |
| 63 bank checks including a root-cause leak test | `questions/diagnose-bank.test.ts` (new) |

Artifacts: 5 metrics series, 4 log excerpts, 2 query plans, 1 waterfall.

Notes:

- **Several questions are answerable only by rejecting the obvious reading.** "Deployed at
  14:20" hands over a plausible traffic explanation that the series disproves; "Waiting on
  the pool" looks like a database problem while query duration sits at 11ms.
- **Any accepted fix counts.** An index or a query rewrite can both be right, and grading
  one specific remedy would test familiarity with our phrasing.
- **The leak test is stricter than Format C's.** The answer here is a sentence of prose,
  so it is easy to write a symptom that already contains it. Root-cause words must not
  overlap the visible symptom or prompt by more than 40%.

**LLD chapters for `architecture-system-design`.**

12 questions in `data/prep/architecture-lld.json`, using formats that already work rather
than waiting on Format B:

| Chapter | Questions | Examples |
| --- | --- | --- |
| `classic-objects` | 4 | fixed-window burst in a rate limiter, an LRU that never reorders on read |
| `interfaces` | 2 | emitter with no unsubscribe, retry wrapper with no retryable predicate |
| `thread-safety` | 2 | await between claim and persist, id scheme assuming a monotonic clock |
| `data-modelling` | 4 | index mistaken for a constraint, denormalized counter maintained on one write path |

**Bank tests now scan every bank rather than one named file** (`load-prep-templates.ts`),
so a new bank is validated the moment it is added instead of when someone remembers to
widen a test.

**Flaky test fixed.** `ask-someone.test.tsx` failed roughly one run in three. `helperCount`
is null until the availability response reaches state, and `waitFor` on the fetch call
only proves the call was made — clicking on the null branch took the "helpers available"
path and sent the request. An `act` flush before the click fixed it; five consecutive runs
of the file and three full suite runs are green.

### Blocked — read before planning removals

Measured from the database, every session sits at or barely above its
`PREP_BANK_MINIMUMS` floor:

| Session | Published | Minimum | Headroom |
| --- | --- | --- | --- |
| `applied-engineering` | 42 (4 ch) | 40 (4 ch) | 2 |
| `architecture-system-design` | 12 (5 ch) | 12 (3 ch) | 0 |
| `core-technical` | 12 (3 ch) | 12 (3 ch) | 0 |
| `resume-behavioral-defense` | 9 (2 ch) | 8 (2 ch) | 1 |

**`applied-engineering` is entirely the 42 fundamentals MCQs.** Moving them to a
placement bank takes the session to zero against a floor of 40, and
`assertPrepQuestionBankPublishable` throws — the seed stops. Archiving typed items has
the same effect on the two sessions already at zero headroom.

This inverts the original order: **replacement content must land before any incumbent
content is retired.** Removal steps stay blocked until the session they empty has enough
non-legacy items to clear its floor on its own.

### Left

| Step | Status |
| --- | --- |
| Format B — `fix-the-test` plumbing | unblocked, additive |
| `mcq` → placement bank | **done** — 42 moved, floors verified |
| Typed audit (convert or archive) | **blocked** until `core-technical` and `architecture-system-design` have headroom |
| Typed audit (convert or archive) | not started |
| Authoring agent | not started |

The 10 predict-run questions are additive, so `core-technical` goes from 12 to 22 once
seeded — the first session with real headroom.

### Suite

Lint clean. Vitest 669 passed, Jest 485 passed (68 suites).

Every session now has headroom above its floor:

| Session | Questions / floor | Chapters / floor | Headroom |
| --- | --- | --- | --- |
| `core-technical` | 22 / 12 | 4 / 3 | +10 |
| `applied-engineering` | 52 / 40 | 4 / 4 | +12 |
| `architecture-system-design` | 24 / 12 | 9 / 3 | +12 |
| `resume-behavioral-defense` | 9 / 8 | 3 / 2 | +1 |

`tsc` currently reports one error in `mentors-view.tsx` from in-progress work outside this
scope: `guide.note` is read but the object defines `bio` / `bestFor` and no `note`.

`src/app/practice/page.test.tsx` was failing before this work — it mocked the container
with only `practiceRoadmapService` while `page.tsx` also reads `interviewService.insights`
and `practiceRoadmapService.activity`. Mock corrected.
