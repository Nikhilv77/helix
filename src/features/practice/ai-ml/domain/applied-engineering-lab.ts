import type { AiMlStoryPath, AiMlStoryQuestion } from "./ai-ml-story-catalog";
import type { InteractionCriterion } from "@/features/practice/shared/domain/interactive-response";

const pathKey = "production-lab";

function exercise(
  value: Omit<AiMlStoryQuestion, "pathKey" | "rubric"> & {
    interaction: NonNullable<AiMlStoryQuestion["interaction"]>;
    interactionRubric: InteractionCriterion[];
  }
): AiMlStoryQuestion {
  return {
    ...value,
    pathKey,
    rubric: value.interactionRubric.map(({ label, points }) => ({ criterion: label, points }))
  };
}

/** Authored simulations; numbers are teaching fixtures, not production benchmarks. */
export const appliedEngineeringLab: AiMlStoryPath = {
  key: pathKey,
  title: "The production decision lab",
  description:
    "Take the on-call seat: arrange a recovery, connect traces to causes, and calculate safe operating limits.",
  expectedMinutes: 55,
  questions: [
    exercise({
      id: "ai-ml-lab-release-sequence",
      title: "Contain a regression before chasing the cause",
      format: "production-decision",
      prompt:
        "You own a 10% ranking canary. A pre-agreed guardrail has fired, and the old route is healthy. Order the five remaining actions. The incident snapshot is already preserved. Investigation cannot delay containment; a fix needs replay validation before it reaches another canary.",
      artifact: {
        kind: "metrics",
        title: "Release v42 · first 30 minutes",
        caption:
          "Simulated matched cohorts. Gate: checkout success may fall by no more than 2 percentage points.",
        content:
          "Matched control: checkout success 72%, p95 160 ms. Canary v42: checkout success 63%, p95 165 ms. Previous v41 is healthy. Incident traces and release metadata are already retained.",
        table: {
          columns: ["Cohort", "Checkout success", "p95", "Requests"],
          rows: [
            ["Control · v41", "72%", "160 ms", "10,000"],
            ["Canary · v42", "63%", "165 ms", "10,000"]
          ]
        }
      },
      topicKeys: ["incident-response", "canary-release"],
      interaction: {
        type: "sequence",
        instruction:
          "Add all five actions, then move them earlier or later. Scoring checks safety dependencies, not speed.",
        items: [
          {
            id: "replay",
            label: "Replay the affected slice on a proposed fix and check release gates."
          },
          {
            id: "diagnose",
            label: "Compare frozen model, feature, and request traces to isolate the regression."
          },
          { id: "canary", label: "Reintroduce the validated fix to a small monitored canary." },
          { id: "contain", label: "Pause expansion and route canary traffic back to healthy v41." },
          { id: "verify", label: "Confirm checkout success recovers on the restored route." }
        ]
      },
      interactionRubric: [
        {
          type: "before",
          first: "contain",
          second: "verify",
          label: "Contain before checking recovery",
          points: 3,
          explanation: "Restore the healthy route before measuring recovery."
        },
        {
          type: "before",
          first: "verify",
          second: "diagnose",
          label: "Verify recovery before deep diagnosis",
          points: 3,
          explanation: "Confirm harm has stopped before spending time on the root cause."
        },
        {
          type: "before",
          first: "diagnose",
          second: "replay",
          label: "Diagnose before validating the fix",
          points: 2,
          explanation: "Choose the fix from the incident evidence, then replay the affected slice."
        },
        {
          type: "before",
          first: "replay",
          second: "canary",
          label: "Validate before re-exposure",
          points: 2,
          explanation: "A repaired build must pass offline gates before another canary."
        }
      ],
      hints: [
        "The rollback condition has already been met.",
        "The snapshot is preserved, so diagnosis does not require keeping the bad route live.",
        "Contain, verify recovery, diagnose, validate, then reintroduce."
      ],
      answer: {
        concise:
          "Contain → verify recovery → diagnose → replay the fix → restart a guarded canary.",
        explanation:
          "The 9-point checkout drop breaches the 2-point gate despite healthy latency. Restoring v41 limits harm; checking recovery tests whether that action helped. Then use preserved traces to choose and validate a repair before exposing users again."
      },
      commonMistakes: ["Keeping the canary live while investigating because latency is healthy."],
      interviewerFollowUps: [
        "What would you do if restoring v41 did not recover checkout success?"
      ],
      interviewConnection:
        "Incident response must separate immediate containment from proving the root cause."
    }),
    exercise({
      id: "ai-ml-lab-retrieval-evidence",
      title: "Locate the broken boundary in a RAG trace",
      format: "artifact-diagnosis",
      prompt:
        "Four independent replay experiments each change one boundary. Assign the strongest supported diagnosis to each evidence card. Each replay uses the same query set and access policy. Categories may be reused; judge the evidence rather than assuming every answer must be different.",
      artifact: {
        kind: "trace",
        title: "Controlled replay notebook",
        caption: "Simulated experiments. All unmentioned components are held fixed.",
        content:
          "A: gold passage absent from index v8, present in v7; direct lookup fails only in v8. B: gold passage is rank 2 in retrieved context; only prompt v12 ignores it, prompt v11 answers correctly. C: identical user query on a fresh request retrieves correct content; cache hit returns a deleted document from yesterday. D: identical model request succeeds directly in 600 ms; gateway cuts it off at its configured 300 ms deadline."
      },
      topicKeys: ["retrieval", "observability", "controlled-experiments"],
      interaction: {
        type: "classification",
        instruction:
          "Connect each replay result to the boundary it isolates. You can change any assignment before submitting.",
        items: [
          {
            id: "index",
            label:
              "Gold passage is missing from index v8. Direct document lookup works in v7 but fails in v8."
          },
          {
            id: "prompt",
            label:
              "Gold passage is rank 2 in the supplied context. Only prompt v12 ignores it; v11 answers correctly."
          },
          {
            id: "cache",
            label: "A fresh request is correct. A cache hit returns a document deleted yesterday."
          },
          {
            id: "deadline",
            label:
              "The same model call completes directly in 600 ms. The gateway stops it at 300 ms."
          }
        ],
        categories: [
          { id: "serving", label: "Serving timeout configuration" },
          { id: "generation", label: "Prompt / generation behavior" },
          { id: "freshness", label: "Cache freshness / invalidation" },
          { id: "coverage", label: "Index ingestion / coverage" }
        ]
      },
      interactionRubric: [
        {
          type: "assignment",
          itemId: "index",
          categoryId: "coverage",
          points: 2.5,
          label: "Missing source coverage",
          explanation: "Ranking cannot retrieve a document that is absent from the index."
        },
        {
          type: "assignment",
          itemId: "prompt",
          categoryId: "generation",
          points: 2.5,
          label: "Prompt regression",
          explanation: "Holding retrieved evidence fixed isolates the prompt change."
        },
        {
          type: "assignment",
          itemId: "cache",
          categoryId: "freshness",
          points: 2.5,
          label: "Stale cache",
          explanation: "The fresh path succeeds while a cache hit returns deleted evidence."
        },
        {
          type: "assignment",
          itemId: "deadline",
          categoryId: "serving",
          points: 2.5,
          label: "Deadline mismatch",
          explanation: "The gateway deadline ends a request that the model can complete."
        }
      ],
      hints: [
        "Ask which single component differs in each pair.",
        "Correct context does not guarantee that the prompt uses it.",
        "Index absence, ignored context, stale hits, and early termination belong to different boundaries."
      ],
      answer: {
        concise: "Index → coverage; prompt → generation; cache → freshness; deadline → serving.",
        explanation:
          "These controlled comparisons narrow the failing boundary. They justify the next investigation, not a universal fix: inspect ingestion, compare prompt behavior, check invalidation, or align deadlines with the end-to-end budget."
      },
      commonMistakes: [
        "Increasing top-k for every bad answer, including missing documents and gateway timeouts."
      ],
      interviewerFollowUps: [
        "Which identifiers would you include in a trace so the replay can be reproduced?"
      ],
      interviewConnection:
        "A useful diagnosis isolates retrieval, generation, caching, and serving independently."
    }),
    exercise({
      id: "ai-ml-lab-threshold-budget",
      title: "Choose a fraud threshold that fits the review queue",
      format: "production-decision",
      prompt:
        "This held-out set contains 100 fraud cases and 900 legitimate cases. Every flagged case goes to review. Capacity is 160 reviews per day and required fraud recall is at least 85%. Choose the listed threshold with the highest recall that meets both limits, then calculate its review count, recall, and precision. Do not interpolate between rows.",
      artifact: {
        kind: "metrics",
        title: "Held-out daily cohort · 1,000 transactions",
        caption:
          "Synthetic counts; TP = correctly flagged fraud, FP = legitimate transactions flagged.",
        content:
          "Threshold 0.2: TP 95, FP 105, FN 5. Threshold 0.4: TP 90, FP 60, FN 10. Threshold 0.6: TP 75, FP 25, FN 25. Reviews = TP + FP. Recall = TP / (TP + FN). Precision = TP / (TP + FP).",
        table: {
          columns: ["Threshold", "TP", "FP", "FN"],
          rows: [
            ["0.2", "95", "105", "5"],
            ["0.4", "90", "60", "10"],
            ["0.6", "75", "25", "25"]
          ]
        }
      },
      topicKeys: ["threshold-tuning", "precision-recall", "capacity"],
      interaction: {
        type: "configuration",
        instruction:
          "Set the threshold and its expected operating figures. Use percentages from 0 to 100, not fractions.",
        fields: [
          {
            id: "threshold",
            label: "Decision threshold",
            unit: "score",
            min: 0,
            max: 1,
            step: 0.1
          },
          { id: "reviews", label: "Daily reviews", unit: "cases", min: 0, max: 1000, step: 1 },
          { id: "recall", label: "Fraud recall", unit: "%", min: 0, max: 100, step: 1 },
          { id: "precision", label: "Review precision", unit: "%", min: 0, max: 100, step: 1 }
        ]
      },
      interactionRubric: [
        {
          type: "range",
          fieldId: "threshold",
          min: 0.4,
          max: 0.4,
          points: 2.5,
          label: "Feasible threshold",
          explanation: "0.2 overloads review; 0.6 misses the recall gate. Choose 0.4."
        },
        {
          type: "range",
          fieldId: "reviews",
          min: 150,
          max: 150,
          points: 2.5,
          label: "Review volume",
          explanation: "At 0.4, 90 true positives + 60 false positives = 150 reviews."
        },
        {
          type: "range",
          fieldId: "recall",
          min: 90,
          max: 90,
          points: 2.5,
          label: "Recall denominator",
          explanation: "90 / (90 + 10) = 90% recall across actual fraud cases."
        },
        {
          type: "range",
          fieldId: "precision",
          min: 60,
          max: 60,
          points: 2.5,
          label: "Precision denominator",
          explanation: "90 / (90 + 60) = 60% precision across flagged cases."
        }
      ],
      hints: [
        "Compute reviews as TP + FP for each row.",
        "First eliminate rows that violate capacity or recall.",
        "At 0.4, reviews = 150, recall = 90%, precision = 60%."
      ],
      answer: {
        concise: "Threshold 0.4; 150 reviews/day; 90% recall; 60% precision.",
        explanation:
          "The lowest threshold catches more fraud but creates 200 reviews, above capacity. The highest creates only 100 reviews but catches 75% of fraud. Threshold 0.4 meets both constraints. Validate the chosen policy on later data and monitor queue and cohort drift after release."
      },
      commonMistakes: ["Using total transactions as the denominator for precision or recall."],
      interviewerFollowUps: [
        "How would this queue change if fraud prevalence doubled while conditional error rates stayed fixed?"
      ],
      interviewConnection:
        "An operating threshold is a business and capacity decision, not just a model score."
    }),
    exercise({
      id: "ai-ml-lab-feature-evidence",
      title: "Separate feature leakage from legitimate missing data",
      format: "artifact-diagnosis",
      prompt:
        "The scoring instant is 10:00 UTC. Classify each feature observation. A value is usable only if the event had happened AND the serving system had received it by 10:00. A missing value is allowed when the versioned feature contract specifies the same default in training and serving.",
      artifact: {
        kind: "config",
        title: "Feature contract v6",
        caption: "Synthetic audit. Event time and availability time are separate clocks.",
        content:
          "scoring_time=10:00 UTC; freshness_limit=15 minutes; missing_count_default=0 in both paths. Feature A: event 09:50, ingested 10:05, included in a historical 10:00 training row. Feature B: training converts dollars to cents; serving leaves dollars unchanged. Feature C: latest online value is from 09:20; pipeline heartbeat stopped. Feature D: new account has no prior events; both paths return the specified default 0."
      },
      topicKeys: ["point-in-time-correctness", "training-serving-skew"],
      interaction: {
        type: "classification",
        instruction:
          "Classify by the stated contract. A recent event timestamp alone does not prove a value was available at prediction time.",
        items: [
          {
            id: "late",
            label:
              "The 09:50 event arrived at 10:05, but the historical 10:00 training row includes it."
          },
          {
            id: "units",
            label: "Training uses cents; online serving uses dollars for the same field."
          },
          {
            id: "stale",
            label: "The latest online value is 40 minutes old; freshness limit is 15 minutes."
          },
          {
            id: "default",
            label:
              "A new account has no events; training and serving both use the documented default 0."
          }
        ],
        categories: [
          { id: "valid", label: "Valid contract behavior" },
          { id: "skew", label: "Training / serving transformation mismatch" },
          { id: "leakage", label: "Unavailable-at-scoring data leakage" },
          { id: "freshness", label: "Stale feature pipeline" }
        ]
      },
      interactionRubric: [
        {
          type: "assignment",
          itemId: "late",
          categoryId: "leakage",
          label: "Respect availability time",
          points: 2.5,
          explanation: "The event existed but had not reached serving at 10:00."
        },
        {
          type: "assignment",
          itemId: "units",
          categoryId: "skew",
          label: "Align transformations",
          points: 2.5,
          explanation: "Identical field names hide a 100× unit difference."
        },
        {
          type: "assignment",
          itemId: "stale",
          categoryId: "freshness",
          label: "Check freshness",
          points: 2.5,
          explanation: "A 40-minute-old value violates the 15-minute freshness contract."
        },
        {
          type: "assignment",
          itemId: "default",
          categoryId: "valid",
          label: "Honor documented defaults",
          points: 2.5,
          explanation: "Missing history is legitimate here; both paths follow the same contract."
        }
      ],
      hints: [
        "When could serving actually read the value?",
        "Compare units and freshness independently.",
        "A documented default is not automatically a pipeline bug."
      ],
      answer: {
        concise: "Late arrival → leakage; units → skew; age → freshness; shared default → valid.",
        explanation:
          "Reconstruct historical inputs using both event and availability boundaries. Compare transformations on identical records, track feature age, and distinguish expected missing data from broken ingestion. An event-time join alone does not reconstruct delayed ingestion."
      },
      commonMistakes: [
        "Treating an earlier event timestamp as proof that serving could access it."
      ],
      interviewerFollowUps: [
        "What metadata would you retain to reconstruct what serving knew at 10:00?"
      ],
      interviewConnection:
        "Correct offline evaluation reproduces the information available to the live decision."
    }),
    exercise({
      id: "ai-ml-lab-evaluation-sequence",
      title: "Build an evaluation without tuning on the test set",
      format: "production-decision",
      prompt:
        "You need a credible next-month fraud estimate. Arrange these tasks into a valid evaluation workflow. Dataset auditing and metric agreement can happen in either order, but both must precede fitting. The future holdout must stay untouched until the model and threshold are frozen.",
      artifact: {
        kind: "scenario",
        title: "Evaluation brief",
        caption: "A simulated release review; no live customer data.",
        content:
          "Train: January–June. Validation: July. Untouched test: August. Features reconstructed as of each scoring instant. Product constraint: review capacity 160/day. Objective: maximize fraud recall within capacity. Report both aggregate and regional results."
      },
      topicKeys: ["evaluation-design", "leakage", "release-gates"],
      interaction: {
        type: "sequence",
        instruction:
          "Build the workflow. Independent prerequisites can appear in either order and still earn full credit.",
        items: [
          {
            id: "test",
            label: "Evaluate the frozen candidate once on August and report regional slices."
          },
          { id: "fit", label: "Fit preprocessing and the model using January–June only." },
          {
            id: "objective",
            label:
              "Agree recall, review-capacity constraints, and slice reporting with the product owner."
          },
          {
            id: "tune",
            label: "Choose the threshold on July, then freeze the model and threshold."
          },
          {
            id: "audit",
            label: "Audit as-of-time features and freeze the chronological dataset boundaries."
          }
        ]
      },
      interactionRubric: [
        {
          type: "before",
          first: "audit",
          second: "fit",
          label: "Audit before fitting",
          points: 3,
          explanation: "Establish valid feature and time boundaries before fitting preprocessing."
        },
        {
          type: "before",
          first: "objective",
          second: "fit",
          label: "Define the objective first",
          points: 2,
          explanation: "Agree the decision objective before selecting a model."
        },
        {
          type: "before",
          first: "fit",
          second: "tune",
          label: "Fit before tuning",
          points: 2,
          explanation: "Tune the fitted model's threshold on separate validation data."
        },
        {
          type: "before",
          first: "tune",
          second: "test",
          label: "Freeze before final evaluation",
          points: 3,
          explanation: "Using August to tune would turn the test set into validation data."
        }
      ],
      hints: [
        "Two tasks are independent prerequisites.",
        "Fitting preprocessing is part of training, not a whole-dataset step.",
        "Audit and agree the objective, fit, tune and freeze, then test once."
      ],
      answer: {
        concise: "Audit + agree objective (either order) → fit → tune and freeze → untouched test.",
        explanation:
          "Training learns parameters, validation chooses the decision threshold, and the future test estimates how that frozen choice generalizes. If the test reveals a problem, disclose it and use a new future holdout for another iteration."
      },
      commonMistakes: ["Repeatedly adjusting the threshold until the final test score looks good."],
      interviewerFollowUps: ["How would delayed fraud labels change these time windows?"],
      interviewConnection:
        "Separate learning, model selection, and final measurement to avoid optimistic estimates."
    }),
    exercise({
      id: "ai-ml-lab-serving-budget",
      title: "Fit inference into a deadline and memory budget",
      format: "production-decision",
      prompt:
        "Configure a serial serving route. The hard request deadline is 900 ms. Reserve the stated worst-case retrieval, network, and fallback budgets; assign all remaining time to one primary attempt. Each retry would consume another full primary timeout. Compute the maximum additional retries that fit, and the largest concurrent batch fitting the stated memory model. Assume no overlap and no other memory users.",
      artifact: {
        kind: "metrics",
        title: "Serving envelope · worst-case budgets",
        caption:
          "Synthetic deterministic budget exercise. These are upper bounds, not percentiles to add together.",
        content:
          "Deadline 900 ms. Retrieval 200 ms. Network and serialization 50 ms. Fallback reserve 150 ms. GPU total 16 GiB; model and runtime reserve 4 GiB; peak memory per concurrent request 1.5 GiB. Each retry consumes one additional full primary timeout. No overlap.",
        table: {
          columns: ["Resource", "Budget"],
          rows: [
            ["Request deadline", "900 ms"],
            ["Retrieval", "200 ms"],
            ["Network + serialization", "50 ms"],
            ["Fallback reserve", "150 ms"],
            ["GPU total", "16 GiB"],
            ["Model + runtime", "4 GiB"],
            ["Each concurrent request", "1.5 GiB"]
          ]
        }
      },
      topicKeys: ["latency-budgets", "inference-serving", "resource-limits"],
      interaction: {
        type: "configuration",
        instruction:
          "Calculate hard limits under the stated assumptions. Production rollout would still need measured headroom and load testing.",
        fields: [
          {
            id: "timeout",
            label: "Primary attempt timeout",
            unit: "ms",
            min: 0,
            max: 900,
            step: 1
          },
          {
            id: "retries",
            label: "Additional full-timeout retries",
            unit: "retries",
            min: 0,
            max: 5,
            step: 1
          },
          {
            id: "batch",
            label: "Maximum concurrent batch",
            unit: "requests",
            min: 1,
            max: 16,
            step: 1
          }
        ]
      },
      interactionRubric: [
        {
          type: "range",
          fieldId: "timeout",
          min: 500,
          max: 500,
          label: "Reserve the full critical path",
          points: 4,
          explanation: "900 − 200 − 50 − 150 leaves 500 ms for the primary attempt."
        },
        {
          type: "range",
          fieldId: "retries",
          min: 0,
          max: 0,
          label: "Avoid deadline amplification",
          points: 3,
          explanation: "A second 500 ms attempt would exceed the 900 ms request deadline."
        },
        {
          type: "range",
          fieldId: "batch",
          min: 8,
          max: 8,
          label: "Respect peak memory",
          points: 3,
          explanation: "Floor((16 − 4) / 1.5) = 8 concurrent requests under this model."
        }
      ],
      hints: [
        "Reserve fallback time even when the primary usually succeeds.",
        "A retry adds time; it does not replace the failed attempt's elapsed time.",
        "The remaining primary budget is 500 ms and usable GPU memory is 12 GiB."
      ],
      answer: {
        concise: "Primary timeout 500 ms; zero additional full-timeout retries; batch limit 8.",
        explanation:
          "This route uses the entire 900 ms budget at the limit. Eight requests use 12 GiB plus the 4 GiB reserve. Real deployments should measure concurrency, memory variability, cancellation, and queueing, then add headroom instead of treating this arithmetic bound as a safe benchmark."
      },
      commonMistakes: ["Adding retries without accounting for elapsed time and fallback reserve."],
      interviewerFollowUps: ["What would change if requests wait in a queue before inference?"],
      interviewConnection:
        "Serving controls must fit the end-to-end deadline and the resource envelope."
    })
  ]
};
