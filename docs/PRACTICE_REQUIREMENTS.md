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

### DSA test coverage

**Goal.** Every DSA question grades on more than the cases the problem shows. A solution
that special-cases the visible examples must fail.

The rule: **nobody hand-writes an expected value.** Each question gets a reference
solution in `scripts/dsa-cases/references/`, which is first replayed against that
question's own authored cases. A reference that disagrees with even one is skipped and
reported — that check catches a wrong reference *and* a wrong original case. Only a
verified reference is trusted to produce expectations for the hidden inputs.

`npx tsx scripts/dsa-cases/generate.mjs` reports; `--write` rewrites the bank in place
and is idempotent.

| Phase | Questions | Hidden cases | State |
| --- | --- | --- | --- |
| 1 — Arrays | 25 | 124 | done |
| 2 — Strings | 20 | 169 | done |
| 3 — Sliding Window | 13 | 102 | done |
| 4 — Binary Search | 15 | 115 | 14 of 15 |
| 5 — Linked List | 20 | 123 | 16 of 20 |
| 6 — Stack & Queue | 17 | 143 | done |
| 7 — Trees | 30 | 198 | 29 of 30 |
| 8 — Heap | 9 | 71 | done |
| 9 — Graphs | 20 | 133 | 19 of 20 |
| 10 — Dynamic Programming | 24 | 193 | done |
| 11 — Tries & Backtracking | 7 | 47 | done |

**200 questions · 1,936 cases · 1,468 hidden · every question has hidden cases.**

### Wrong complexity now runs out of time

Every case used to be inlined, and Java compiles a literal into roughly one bytecode
instruction per element against a 64KB method cap — so inputs were capped near 2,000, and
at 2,000 a quadratic solution finishes in milliseconds. Measured before the fix, by
submitting deliberately quadratic solutions:

| Question | Wanted | Submitted | Result |
| --- | --- | --- | --- |
| `two-sum` | O(n) hash map | O(n²) nested scan | passed 7/7 in 1ms |
| `contains-duplicate` | O(n) set | O(n²) pairwise | passed 9/9 in 2ms |
| `best-time-to-buy-and-sell-stock` | O(n) single pass | O(n²) all pairs | passed 8/8 in 91ms |

A case may now declare `build` instead of a literal, and the generated program constructs
the input itself. No literal means no bytecode ceiling, so 200,000 elements costs nothing
in source size — the `contains-duplicate` harness is still under 10KB.

Picking the generator was the crux. MINSTD (`seed = seed * 48271 % 2147483647`) keeps its
intermediate product under 2^53, so a JavaScript double holds it exactly while Java `long`,
C++ `long long` and Python integers all agree. The generator the reference scripts used
before multiplied by 1103515245, reaching 2.3e18 — past 2^53 — so **JavaScript had already
diverged from exact integer arithmetic** and could never have matched Java. Verified by
summing a built 200,000-element array in all four languages plus the TypeScript reference:
every one returns -406894.

After the fix, on the same questions:

| | Correct solution | Quadratic solution |
| --- | --- | --- |
| `contains-duplicate` | 21ms | **10,002ms** — over the 5s limit |
| `best-time-to-buy-and-sell-stock` | 16ms | **28,093ms** — over the 5s limit |

13 scale cases across 11 questions. Expected values still come from replaying the verified
reference over the same generated array, and the generator refuses a scale case whose
answer is large, since the answer is written into the bank.

**What this catches and what it does not.** It separates quadratic from linear, which is
the mistake candidates actually make. It cannot separate logarithmic from linear — a linear
scan of 200,000 elements is still only 200,000 operations — so binary-search questions
remain unpoliced on complexity.

### Two questions replaced rather than patched

Both remaining problem questions had the same shape: the harness could not express what
they asked for, so neither graded anything, and both ran in only two languages.

| Removed | Replaced by | Why |
| --- | --- | --- |
| `flatten-a-multilevel-doubly-linked-list` | **Partition List** | Its input is a flat array where nulls encode child pointers. Even with an adapter the question would mostly test parsing that format, and it is rarely asked. |
| `serialize-and-deserialize-binary-tree` | **Maximum Width of Binary Tree** | The contract is a *string* round trip, so the harness would have to call the candidate twice. Genuinely fixable, but it needs a codec driver in four languages. |

The replacements were chosen to need **no new machinery**: Partition List uses the existing
`linked-list` adapter, Maximum Width uses `tree-input`, and both have a single unambiguous
answer. Both run in all four languages, where the questions they replaced ran in two — so
the bank gained four language contracts by shrinking nothing.

Partition List teaches the two-dummy-heads technique nothing else in the phase covers, and
its trap is real: forget to terminate the second list and the result is circular. Maximum
Width turns a shape question into index arithmetic, and its trap — indices overflowing on a
deep tree unless you normalise per level — is the reason it is asked.

Serialize/Deserialize is the more famous question and losing it is a real cost. It is worth
bringing back when the codec driver exists; an ungradeable question in the bank was worse
than a gap.

### Deep copies, graded as copies

`copy-list-with-random-pointer` and `clone-graph` were handed their own input as an array
and handed it straight back — `return head` and `return adjList` passed every case. The
new `linked-list-random` and `graph-clone` adapters build real nodes, and the output check
walks the result rejecting any node that came from the input, reporting
`returned the original nodes rather than a copy`. A correct copy still serialises to the
same shape as its input; the identity check is what makes that round trip mean anything.

Verified both ways with solutions that differ from the references — the O(1)-space
interleaving trick rather than a hash map, and breadth-first rather than depth-first.
Real solutions pass every case; the shortcuts now fail all but the empty one, which
legitimately has no nodes to alias.

**`clone-graph` dropped from four languages to two, deliberately.** Only the JavaScript and
Python adapters can tell a real copy from the original nodes; Java and C++ would still see
the old array shape and still pass the shortcut. A question graded correctly in two
languages beats one graded in none, so it waits for the Java and C++ node builders.

### Java and C++ class runners

Eleven class-operation questions used to throw for Java and C++ — the runner said so
outright: *"Java and C++ class runners are next."* They are here now.

The trick is that the call sequence is known when the harness is built, so both runners
**unroll** it into typed statements rather than dispatching by name. Java has no way to
call a method from a string without reflection, and unrolling also keeps the generated
program readable when something fails to compile:

```java
LRUCache instance = new LRUCache(2);
instance.put(1, 1); results.add(null);
results.add(instance.get(1));
```

The only thing a statically-typed runner needs that JavaScript gets for free is knowing
whether an operation returns anything — `VOID_OPERATIONS` records that per question,
mirroring `trailgradOperationValue`.

**The starters had to be rewritten too.** They were bare shells with a no-argument
constructor, so `new BrowserHistory("home")` would not have compiled. Each class now
declares its real signature, which the candidate needed anyway.

| Language | Before | After |
| --- | --- | --- |
| javascript | 200 of 200 | 200 |
| python | 200 of 200 | 200 |
| cpp | 185 of 200 | **196** |
| java | 183 of 200 | **194** |

Verified by writing a real implementation of all eleven in both languages, compiling, and
checking every visible and hidden case through the harness's own parser — 11 for 11 in
each. The opt-in compiler audit passes over the 22 new contracts.

### A wrong expected value in `design-browser-history`

Writing its reference turned up a case a correct implementation could not pass. The runner
reports one null per void call — the constructor and every `visit` — so
`BrowserHistory("a.com"); visit("b.com"); back(1); forward(1)` produces four values. The
authored example and the case copied from it both listed three. Corrected in the question
JSON and the bank.

Left out so far, and why:

- **Two questions are still degenerate** — see below.
- **`flatten-a-multilevel-doubly-linked-list`** has no adapter either, so it asks the
  candidate to parse LeetCode's multilevel serialization rather than flatten a list.
  Testing the wrong skill rather than none.

**Class-operation questions turned out to need no new machinery.** Their `arguments`
already *are* the call sequence, so a reference that simulates the structure and returns
the results array fits `solve(...operations)` unchanged. All five in Phase 6 are covered;
`time-based-key-value-store`, `design-browser-history` and `lru-cache` follow the same
shape and are simply not written yet. Each reference has to match the runner's own
bookkeeping, which differs per question — `min-stack` reports null for `pop` even though a
real `pop` returns a value, while the queue reports what it removed — and the replay
against authored cases is what catches getting that wrong.

### A bug in the case writer

Writing Phase 6 corrupted `test-cases-batch-6.ts`. The writer finds a slug's array by
counting `[` and `]` from the opening bracket, and `valid-parentheses` has `"]"` as an
input — the bracket inside the string literal closed the array early and truncated the
file mid-case. `decode-string` had been passing through the same writer for two phases
only because its brackets happen to be balanced.

The scan now skips string literals. The regenerated cases are pinned by a solution test,
and `tsc` fails loudly if the file is ever truncated again.

### Linked-list adapters

Four questions used to grade nothing. `linked-list-cycle`, `linked-list-cycle-ii`,
`intersection-of-two-linked-lists` and `copy-list-with-random-pointer` had **no adapter**,
so the structure each question is about was never built: the candidate received plain
arrays plus the very value being asked for, and these all passed every case.

```
linkedListCycle(head, pos)                       -> return pos !== -1
linkedListCycleIi(head, pos)                     -> return pos
intersectionOfTwoLinkedLists(a, b, skipA, skipB) -> return a[skipA]
copyListWithRandomPointer(head)                  -> return head
```

Three now have adapters, in all four languages:

| Adapter | Builds | Reports back |
| --- | --- | --- |
| `linked-list-cycle` | A chain with `tail.next` wired to node `pos` | The boolean unchanged |
| `linked-list-cycle-entry` | The same chain | The returned node's **index**, by identity |
| `linked-list-intersection` | Two chains sharing a tail from `skipA`/`skipB` | The returned node's **value**, but only if that node is in list A by identity |

The candidate's function is called with the heads alone, so the consumed parameters are
gone from the starter signature too (`ADAPTER_CONSUMED_PARAMETERS` in
`dsa-code-templates.ts`) — a signature that still took `pos` would be a signature the
harness never calls.

Identity, not value, is what makes the intersection check real: a solution that finds the
first value present in both lists returns a node it did not receive, and fails. Reporting
the value rather than an index keeps the authored expectations and the problem statement
("Intersected at node 8") intact.

Verified by compiling and running the generated program in **Java, C++, Python and
JavaScript** against every case — all four agree on every expected value — and
`dsa-runner-contract.spec.ts` asserts both directions: a real traversal passes everything,
and each former shortcut now fails.

**Three questions are still unfixed**, and an adapter alone would not be enough for any of
them. `copy-list-with-random-pointer` and `clone-graph` need the check to verify the
returned nodes are *new*; `serialize-and-deserialize-binary-tree` needs the candidate to
produce a string and read it back. All three round-trip through an array encoding that
cannot express what matters, so `return head` / `return root` / `return adjList` still
passes. All three are pinned by a test.

### Backtracking: the comparison was already right

Every backtracking question returns a collection whose *outer* order is arbitrary but
whose *inner* order is part of the answer — a permutation is its order, a board's rows are
its rows, a combination is conventionally non-decreasing. That is exactly what
`unordered-nested` compares, so these needed neither a new mode nor the `accepted` hook.

The binding constraint was **answer size**, since the whole collection is written into the
bank: subsets double per element, permutations grow factorially, and eight queens is 92
boards of eight rows. Inputs are capped so one case stays readable.

Two generated inputs were replaced for the same reason as the graph ones: LeetCode
guarantees unique elements for `subsets` and `permutations`, and a repeated value produces
positionally-distinct entries with identical content — a case the problem never promises.

### Dynamic programming: one hazard, and a bank-wide guard

No adapters and no ambiguity — every question takes plain arguments and returns a scalar.
The single hazard is that **Java and C++ return `int`**, and these are exactly the
questions whose answers explode: `climbing-stairs` is Fibonacci, `decode-ways` is
Fibonacci in disguise, `unique-paths` is a binomial coefficient. An expected value past
2,147,483,647 would be one no correct Java solution could produce.

Inputs are sized against that ceiling — `climbing-stairs(45)` is 1,836,311,903 and 46
overflows; `unique-paths(17,17)` is 601,080,390 and 18 overflows. A test in
`dsa-runner-contract.spec.ts` now checks **every numeric expected value in the whole
bank**, not just this phase, so the next phase inherits the guard. Raising
`climbing-stairs` to 46 makes it fail, which is how it was verified.

### Graphs: no new adapter, but two invalid inputs

Every Phase 9 question takes plain arrays — grids, edge lists, adjacency lists — so
nothing new was needed in the harness. Two things did need care.

`course-schedule-ii` and `alien-dictionary` both ask for *a* topological order and most
graphs have several, so both use the `accepted` hook, enumerating every valid order and
skipping any input whose set grows past a cap. `evaluate-division` returns ratios compared
exactly across four languages, so every generated value is a power of two — all products
and quotients are then dyadic and exact, where something like 1/3 would differ in the last
bit between runtimes.

Two inputs I first wrote violated their own problem's guarantees: an itinerary with two
tickets out of JFK and no way back (the problem guarantees a valid itinerary exists), and
merged accounts carrying different names (accounts sharing an email are the same person).
Both produce a defined but meaningless answer, which is exactly the kind of expectation
that fails a correct solution. Replaced rather than recorded.

### `find-median-from-data-stream` was a syntax error

Expanding Phase 8 executed this question for the first time, and its generated JavaScript
did not parse. The operation runner emitted

```js
... for (const value of input[0]) instance.addNum(value); results.push(instance.findMedian()) console.log(...)
```

— no semicolon after the `findMedian()` push, so the statement ran straight into
`console.log`. **Every JavaScript submission to this question has failed with
`SyntaxError` since the runner was written.** Python was unaffected; it takes a different
branch of the same generator. Fixed, and the question now has 8 hidden cases exercised by
a real two-heap implementation in both languages.

This is the argument for executing a question rather than only reading its data: the
question had authored cases, appeared in the bank, and was broken.

### Trees: a third adapter, and a helper that lied

`convert-sorted-array-to-binary-search-tree` and
`construct-binary-tree-from-preorder-and-inorder-traversal` had no adapter, so the starter
returned `int[]` and the candidate had to emit the level-order array by hand — impossible
in Java and C++, whose `int[]` and `vector<int>` cannot hold the nulls the expected arrays
contain. The new **`tree-result`** adapter leaves arguments alone and serializes the
returned node, so both now take a natural `TreeNode` return in all four languages.
Verified by compiling and running each.

The BST-from-sorted-array question also has several correct answers, so it uses the
`accepted` hook: every tree reachable by taking either middle at each step. That is wider
than the two the authored cases allowed, though still not literally every height-balanced
BST. A test proves it is load-bearing — the independent solution takes the *upper* middle
where the reference takes the lower, and fails if `one-of` is removed.

**A generator helper was quietly wrong.** `leftSkew` and `rightSkew` produced the same
array, so every question that asked for a left-leaning tree got a right-leaning one — the
cases verified, they just tested less than their names claimed. Both are correct now, and
`binary-tree-right-side-view` genuinely exercises the case where the rightmost node of a
level is a left child.

### predict-run for every editor language

The editor offers **javascript, python, cpp, java**. Until now every `predict-run`
question was JavaScript, and `predict-run` is language-*bound* by design — the exercise is
predicting what one runtime prints. The language gate therefore withheld all ten from
anyone using another language, and `core-technical` fell back to twelve typed essays: the
exact format the artifact work replaced, reverted silently and only for them.

Measured before and after, through the real selector:

| Candidate | Before | After |
| --- | --- | --- |
| javascript | predict-run 5, typed 7 | unchanged |
| python | **typed 12** | predict-run 3, typed 9 |
| java | **typed 12** | predict-run 4, typed 8 |
| cpp | **typed 12** | predict-run 4, typed 8 |

Thirty new questions — ten each for Python, Java and C++ — in
`src/data/prep/{python,java,cpp}-runtime-predict.json`.

**No expected output is written by hand.** `scripts/prep-predict/` holds the runnable
snippets plus a builder that compiles and executes each one; whatever it prints becomes
`answerKey.expectedStdout`. Run without `--write` it re-executes everything and fails if a
committed bank has drifted, so a snippet edited without a rebuild is caught rather than
grading candidates against a stale answer.

Three questions were rejected during authoring because execution disagreed with intent:
`257 is 257` prints True under constant folding (version-dependent, so unfair), returning
from a `finally` block now raises a SyntaxWarning, and a Java overload example did not
compile at all. A fourth relied on C++17 `<<` sequencing and was rewritten to be
order-independent.

**One chapter per language, deliberately.** Placement round-robins across chapters, so the
number of chapters a language spans decides its share of the session. `prepChapterKey`
already collapses every `javascript-*` competency into one chapter; the three new banks set
`chapterKey` explicitly to match. Splitting them finer would have quietly given the new
languages a larger share than JavaScript.

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

Lint clean. Vitest 689 passed; DSA and Practice suites green.

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
