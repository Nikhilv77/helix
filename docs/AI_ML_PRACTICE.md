# AI/ML interactive practice

When a confirmed resume includes a project or work summary, Core Technical and Applied Engineering each add a two-question path grounded in that evidence. The prompts match the candidate's level and are frozen with the question snapshots. Replacing the resume or changing level adds a new path without rewriting earlier attempts. Existing path selection prioritizes an uncompleted question using resume topics, baseline review signals, saved drafts, and progress; the authored library remains available. These questions use the existing Practice overview and question workspace without an added panel or route.

Open `/practice/ai-ml/applied-engineering` with an onboarded AI/ML profile. One authored path is **The production decision lab**: six simulations alongside the existing 27 questions. Its numbers are teaching fixtures, not claimed production benchmarks.

| Case                | Response                 | What the learner demonstrates                                                      |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Canary regression   | Arrange incident actions | Containment, recovery verification, diagnosis, validated re-exposure               |
| RAG replay          | Classify evidence cards  | Distinguish ingestion, generation, cache, and serving failures                     |
| Fraud review queue  | Configure numeric values | Balance recall and review capacity; calculate precision                            |
| Feature audit       | Classify evidence cards  | Separate availability leakage, transformation skew, stale data, and valid defaults |
| Evaluation workflow | Arrange dependent steps  | Keep fitting, threshold selection, and final measurement separate                  |
| Serving envelope    | Configure numeric values | Account for serial deadlines, retries, fallback, and peak memory                   |

## Shared implementation

- `shared/domain/interactive-response.ts` defines public controls, structured responses, validation, and scoring primitives. Sequence rubrics express required dependencies, so equivalent valid orders receive the same credit.
- `shared/ui/interactive-answer-input.tsx` provides accessible ordering buttons, evidence assignments, and numeric inputs. It runs inside `StoryPracticeQuestionWorkspace`, using its existing autosave, replay request IDs, submission, learning, and feedback UI.
- `shared/domain/story-practice-contracts.ts` owns the common request and feedback schemas. Core Technical retains compatible exports; the AI/ML API extends work with the interactive response variant.
- `shared/server/written-answer-evaluator.ts` is shared by Core Technical and AI/ML. Interactive questions use a frozen deterministic rubric and do not call a model.
- Public snapshots contain only the controls. Scoring rules live in private snapshots and the API never accepts a client-supplied score. The full answer is available only after submission or explicit Learn.
- Existing JSON draft/attempt columns store structured work. These additions require no migration beyond the two AI/ML migrations already present in the working tree. Existing answers and content are preserved; new questions append.
- AI/ML cohort updates, submissions, and learning acquire a transaction-scoped owner lock. Submissions recheck both the saved attempt and content fingerprint before committing. Path completion is distinct from assessment completion.

## Content references

These original exercises use the concepts below; their scenarios and numerical datasets are authored locally.

- [scikit-learn: decision threshold tuning](https://scikit-learn.org/stable/modules/classification_threshold.html) — choose thresholds for the operating objective and keep threshold tuning separate from model fitting.
- [Google: Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml) — measure production behavior and watch training/serving skew.
- [Feast: point-in-time joins](https://docs.feast.dev/getting-started/concepts/point-in-time-joins) — reconstruct historical feature values. The late-arrival case additionally states an explicit availability-time requirement; event time alone does not establish when serving received a value.

## Remaining boundaries

This change does not turn AI/ML practice into the complete adaptive assessment lifecycle used by the Node.js tracks. AI/ML still has its existing persistence adapter and legacy-cohort compatibility layer. Voice block assessments, adaptive continuation, cross-track analytics, and a Python sandbox require further integration. The shared library no longer pretends an assessment is configured.

The two AI/ML Architecture & Design scenarios are approved in source and published to the verified development database, as recorded in [AI/ML Architecture & Design release review](./AI_ML_ARCHITECTURE_REVIEW.md). The existing Prisma-backed session, question, and assessment flow selects them for AI/ML candidates. Production requires its own protected database publication. AI/ML design interviews follow their separate launch and eligibility flow.

## Verification

Coverage includes complete and alternate valid answers, partial credit, malformed or incomplete responses, response-kind mismatches, private-rubric protection, terminal progress, concurrent replay, content changes during evaluation, and workspace draft save/restore/submit. Browser preview checks exercise the actual shared controls with simulated data; authenticated database integration is a separate deployment check.
