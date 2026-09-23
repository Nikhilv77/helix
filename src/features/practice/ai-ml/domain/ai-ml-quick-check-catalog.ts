import type { PersistedAiMlPracticeTrack } from "./ai-ml-practice";
import type { AiMlStoryPath, AiMlStoryQuestion } from "./ai-ml-story-catalog";

type WrittenQuestion = Omit<AiMlStoryQuestion, "rubric"> & {
  rubric: [string, string, string];
};

function written(question: WrittenQuestion): AiMlStoryQuestion {
  return {
    ...question,
    rubric: question.rubric.map((criterion, index) => ({
      criterion,
      points: index === 0 ? 4 : 3
    }))
  };
}

function choice(
  question: Omit<AiMlStoryQuestion, "rubric"> & {
    choices: [string, string, string];
    correctChoiceIndex: number;
  }
): AiMlStoryQuestion {
  return {
    ...question,
    rubric: [{ criterion: "Choose the action justified by the supplied evidence.", points: 10 }]
  };
}

const coreQuestions: AiMlStoryQuestion[] = [
  choice({
    id: "ai-ml-core-1",
    pathKey: "quick-check",
    title: "Check the outcome, not only the AUC",
    format: "mcq",
    prompt:
      "A ranking model improves offline AUC, but the support team says urgent tickets are being missed. Which investigation should lead?",
    artifact: {
      kind: "metrics",
      title: "Two-week ranking comparison",
      content:
        "offline AUC: 0.81 → 0.88\nurgent-ticket recall: 0.92 → 0.73\nmedian resolution time: 14 h → 19 h\ntraffic mix: unchanged",
      caption: "The release was enabled for all ticket queues."
    },
    topicKeys: ["evaluation", "product-outcomes"],
    hints: [
      "AUC averages across thresholds and classes.",
      "Urgent-ticket recall fell even as AUC rose.",
      "Compare high-priority misses and resolution time against the previous model."
    ],
    answer: {
      concise:
        "Investigate urgent-ticket misses and their operational impact against the old model.",
      explanation:
        "Slice urgent tickets, inspect false negatives and threshold behavior, and compare resolution outcomes with a control. Roll back or adjust the release if the high-priority guardrail is breached."
    },
    choices: [
      "Inspect urgent-ticket false negatives and resolution outcomes against the old model.",
      "Ship because the AUC improved by seven points.",
      "Increase the model size before checking any live outcomes."
    ],
    correctChoiceIndex: 0,
    commonMistakes: ["Treating aggregate AUC as a substitute for the decision's real cost."],
    interviewerFollowUps: ["Which urgent-ticket guardrail would you set before a second canary?"],
    interviewConnection: "Model evaluation must reflect the decision the product actually makes."
  }),
  written({
    id: "ai-ml-core-2",
    pathKey: "quick-check",
    title: "Locate the slice behind the failure",
    format: "artifact-diagnosis",
    prompt:
      "A classifier degrades only for one new input type. Use the distribution report to identify the likely failure boundary and propose two checks before retraining.",
    artifact: {
      kind: "metrics",
      title: "Input and error slices",
      content:
        "new mobile receipts: traffic share 4% → 31%; error rate 8% → 39%\nscanned PDFs: traffic share 22% → 20%; error rate 11% → 12%\nimage preprocessing: unchanged\nnew mobile app version: released Monday",
      caption: "Overall error rose from 12% to 21% in the same week."
    },
    topicKeys: ["distribution-shift", "slicing"],
    hints: [
      "The new receipts changed both frequency and error rate.",
      "Compare raw images and extracted features before assuming weights are the problem.",
      "Replay the new app's examples through preprocessing and compare them with training coverage."
    ],
    answer: {
      concise:
        "The new mobile-receipt slice likely shifted beyond training coverage or changed upstream capture quality.",
      explanation:
        "Inspect sampled raw receipts and preprocessing outputs by app version; compare feature distributions and labels with training and the old app. Mitigate the slice before choosing a targeted data or model update."
    },
    rubric: [
      "Identify the mobile-receipt slice using both traffic and error changes.",
      "Check raw inputs and preprocessing or feature parity by app version.",
      "Choose a slice-specific mitigation or data update rather than blind retraining."
    ],
    commonMistakes: ["Retraining globally without inspecting changed inputs."],
    interviewerFollowUps: ["How would you protect affected users while collecting labels?"],
    interviewConnection:
      "A production metric is actionable only after the failing cohort is located."
  }),
  written({
    id: "ai-ml-core-3",
    pathKey: "quick-check",
    title: "Make the rollback reproducible",
    format: "production-decision",
    prompt:
      "The canary fails its quality gate. Specify what must be rolled back together and how you would prove the previous behavior is restored.",
    artifact: {
      kind: "config",
      title: "Release manifest",
      content:
        "previous: model=ranker-v17, feature_set=fs-42, prompt=p-9, index=idx-2024-06\ncanary: model=ranker-v18, feature_set=fs-43, prompt=p-10, index=idx-2024-07\ncanary urgent recall: 0.70 (gate ≥ 0.88)\nrollback button currently changes model only",
      caption: "The model consumes retrieved features and a versioned prompt."
    },
    topicKeys: ["rollback", "versioning"],
    hints: [
      "Changing only model weights leaves other version changes in place.",
      "Restore the full known-good serving bundle.",
      "Replay a fixed request set and watch the urgent-recall guardrail."
    ],
    answer: {
      concise:
        "Restore the previous model, feature set, prompt, and index as one versioned bundle.",
      explanation:
        "Pin all four dependencies to the prior manifest, replay representative urgent requests, compare outputs and feature lineage with the known-good release, and monitor live guardrails before expanding traffic again."
    },
    rubric: [
      "Name all versioned serving dependencies, not just model weights.",
      "Choose an atomic or explicitly coordinated rollback.",
      "Verify behavior with replay and live high-priority metrics."
    ],
    commonMistakes: ["Assuming the model version alone reproduces a release."],
    interviewerFollowUps: ["How would you prevent a mixed-version request during rollback?"],
    interviewConnection:
      "A rollback is reliable only when the whole inference path is reproducible."
  }),
  written({
    id: "ai-ml-core-4",
    pathKey: "quick-check",
    title: "Trace the missing policy clause",
    format: "artifact-diagnosis",
    prompt:
      "The assistant answers an employee's leave question incorrectly. Trace the retrieval chain, identify where the relevant evidence disappeared, and propose a verification test.",
    artifact: {
      kind: "trace",
      title: "Retrieval trace, request 7f32",
      content:
        "query: 'How many caregiver leave days can I take?'\nsource v3: policy/leave.pdf §4 caregiver leave = 10 days\nindex: leave-v2, built before source v3\nretrieved top-1: policy/leave.pdf §2 annual leave = 20 days\nanswer citation: policy/leave.pdf §2",
      caption: "The generator received only the retrieved top-1 chunk."
    },
    topicKeys: ["retrieval", "index-freshness"],
    hints: [
      "The correct section exists in the source but not in the index version.",
      "The generator cannot cite a clause it never received.",
      "Check ingestion/index freshness and retrieval recall with the known question."
    ],
    answer: {
      concise:
        "The serving index predates the caregiver-leave clause, so retrieval supplied the wrong section.",
      explanation:
        "Confirm the source-to-index version gap, rebuild or refresh the index, and run a labeled query set checking that §4 enters top-k and is cited. Do not tune the generator before repairing evidence availability."
    },
    rubric: [
      "Locate the stale index as the loss boundary.",
      "Explain how the wrong retrieved chunk led to the wrong citation.",
      "Propose a source-version and top-k recall regression test."
    ],
    commonMistakes: ["Changing generation temperature when the needed clause was absent."],
    interviewerFollowUps: ["How would you detect stale documents before users ask about them?"],
    interviewConnection:
      "RAG failures need request-to-source lineage, not a generic prompt adjustment."
  }),
  written({
    id: "ai-ml-core-5",
    pathKey: "quick-check",
    title: "Find the safety regression's blind spot",
    format: "written",
    prompt:
      "Offline safety pass rate looks stable, but live unsafe completions increased. Explain how the report hides the regression and design a focused re-evaluation.",
    artifact: {
      kind: "metrics",
      title: "Safety evaluation by request type",
      content:
        "offline set: 96% English general, 4% multilingual financial advice\noffline pass: 98.1% → 98.0%\nlive multilingual financial traffic: 3% → 24%\nlive unsafe rate for that slice: 2% → 17%",
      caption: "The offline set was not refreshed after a new market launch."
    },
    topicKeys: ["safety", "evaluation-slices"],
    hints: [
      "The aggregate offline set underweights the growing live slice.",
      "Compare examples, labels, and policy coverage for multilingual financial requests.",
      "Set slice-specific launch gates and monitor live violations."
    ],
    answer: {
      concise:
        "The stale offline mix masks a severe failure in a rapidly growing multilingual financial slice.",
      explanation:
        "Sample and label live failures, rebuild a representative adversarial eval for the slice, inspect refusal and policy behavior by language, and gate rollout on the slice-specific unsafe rate rather than the aggregate."
    },
    rubric: [
      "Explain the mismatch between offline mix and live traffic.",
      "Design a labeled slice-specific evaluation with representative examples.",
      "Specify a live safety guardrail and reversible mitigation."
    ],
    commonMistakes: ["Trusting a stable global pass rate without examining coverage."],
    interviewerFollowUps: [
      "What temporary mitigation would you use before the new evaluation is ready?"
    ],
    interviewConnection: "Safety evaluation must follow the traffic and harms that actually occur."
  }),
  choice({
    id: "ai-ml-core-6",
    pathKey: "quick-check",
    title: "Pick a threshold under real constraints",
    format: "mcq",
    prompt:
      "A fraud-review team can inspect 400 alerts daily. Which threshold should be tested first, and what trade-off should you report?",
    artifact: {
      kind: "metrics",
      title: "Threshold pilot, 100,000 daily transactions",
      content:
        "threshold 0.20: alerts 1,400/day; fraud caught 82%; false-positive alerts 1,318\nthreshold 0.55: alerts 390/day; fraud caught 68%; false-positive alerts 322\nthreshold 0.85: alerts 95/day; fraud caught 29%; false-positive alerts 66\nreview capacity: 400/day",
      caption: "Fraud labels arrive after seven days."
    },
    topicKeys: ["thresholds", "precision-recall"],
    hints: [
      "The lowest threshold exceeds review capacity.",
      "The highest threshold misses most fraud.",
      "Choose a feasible point, then quantify misses and false alerts."
    ],
    answer: {
      concise:
        "Test 0.55 first; it fits review capacity while retaining more fraud coverage than 0.85.",
      explanation:
        "At 0.55 the queue is 390/day. Report fraud recall, missed fraud, false-positive burden, and label delay; then validate costs and slices before locking the threshold."
    },
    choices: [
      "Test 0.55 and report missed fraud, false alerts, and capacity by slice.",
      "Test 0.20 because maximum recall always outweighs queue capacity.",
      "Test 0.85 because the smallest queue is automatically safest."
    ],
    correctChoiceIndex: 0,
    commonMistakes: ["Optimizing one metric without operational capacity."],
    interviewerFollowUps: ["What would you do while fraud labels are delayed?"],
    interviewConnection: "A threshold is an operating decision, not just a model statistic."
  }),
  written({
    id: "ai-ml-core-7",
    pathKey: "quick-check",
    title: "Catch a reversed risk score",
    format: "predict-explain",
    prompt:
      "The live service flags low-risk accounts and misses high-risk ones, while offline classification looks good. Use the Python scoring code to predict which accounts get flagged, explain the bug, and propose a regression test.",
    artifact: {
      kind: "code",
      language: "python",
      title: "model_score.py",
      content:
        "# model.classes_ -> ['high_risk', 'low_risk']\n# predicted probabilities: high-risk case [0.91, 0.09]\n# predicted probabilities: low-risk case  [0.04, 0.96]\n\ndef should_flag(model, features) -> bool:\n    risk_score = model.predict_proba([features])[0, 1]\n    return risk_score >= 0.80",
      caption:
        "The service assumes probability column 1 means high risk; the fitted model's class order says otherwise."
    },
    topicKeys: ["model-serving", "class-mapping", "python"],
    hints: [
      "The class order determines the meaning of each probability column.",
      "Column 1 is low_risk, not high_risk.",
      "Look up the desired class index from model.classes_ and test both example rows."
    ],
    answer: {
      concise:
        "The code thresholds low-risk probability, so the low-risk example is flagged and the high-risk example is missed.",
      explanation:
        "Resolve the high_risk column using model.classes_ rather than a hard-coded index. Test known high- and low-risk records against the deployed model artifact and verify that the score-to-label mapping travels with the model version."
    },
    rubric: [
      "Identify that column 1 represents low_risk, not high_risk.",
      "Predict that the supplied low-risk example is flagged while the high-risk example is missed.",
      "Use the model's class mapping and a two-class serving regression test."
    ],
    commonMistakes: ["Assuming predict_proba column 1 is always the positive class."],
    interviewerFollowUps: ["How would you package the class mapping with the model artifact?"],
    interviewConnection: "A model score is meaningful only with its class-label contract."
  }),
  written({
    id: "ai-ml-core-8",
    pathKey: "quick-check",
    title: "Debug a weak citation",
    format: "artifact-diagnosis",
    prompt:
      "A generated answer cites an irrelevant return-policy paragraph. Use the trace to separate retrieval from citation assembly, and give the next check you would run.",
    artifact: {
      kind: "trace",
      title: "Answer provenance, request b82e",
      content:
        "question: 'Can I return a repaired laptop within 30 days?'\nretrieved #1: returns/general §2, score 0.91, 'unopened products may be returned'\nretrieved #2: repairs/warranty §7, score 0.62, 'repaired devices have a 14-day service appeal'\nanswer claim: '30-day return applies'\ncited chunk: returns/general §2",
      caption: "The cited passage is real but does not cover repaired devices."
    },
    topicKeys: ["retrieval", "citations"],
    hints: [
      "The correct policy may be present but ranked below an overbroad general rule.",
      "The claim is not entailed by its cited chunk.",
      "Inspect query formulation, ranking, and claim-to-source support separately."
    ],
    answer: {
      concise:
        "The general return chunk outranked the repair-specific policy, and the answer cited a passage that does not support its claim.",
      explanation:
        "Check retrieval ranking and filters for repair intent, then run a claim-to-citation entailment check on the selected chunk. A test query should rank §7 above the general rule and reject unsupported 30-day claims."
    },
    rubric: [
      "Identify the ranking/intent mismatch in the supplied chunks.",
      "Explain why the cited text fails to support the claim.",
      "Propose a targeted retrieval and citation-support regression test."
    ],
    commonMistakes: ["Treating any valid-looking citation as evidence for the specific claim."],
    interviewerFollowUps: [
      "How would you prevent unsupported claims when no retrieved chunk answers the question?"
    ],
    interviewConnection: "Citations need claim-level support, not just a document link."
  })
];

const appliedQuestions: AiMlStoryQuestion[] = [
  choice({
    id: "ai-ml-applied-1",
    pathKey: "quick-check",
    title: "Separate release regression from traffic change",
    format: "mcq",
    prompt:
      "Only Android users in one region report worse recommendations after launch. Which comparison most directly tests whether the release caused it?",
    artifact: {
      kind: "metrics",
      title: "Canary by platform and region",
      content:
        "Android / west canary: click-through 8.4% → 5.1%\nAndroid / west control: click-through 8.3% → 8.2%\niOS / west canary: click-through 8.6% → 8.5%\nAndroid / east canary: click-through 8.1% → 8.0%",
      caption: "The canary and control ran simultaneously."
    },
    topicKeys: ["canary", "segmentation"],
    hints: [
      "Use the simultaneous control, not only last week's average.",
      "The loss is limited to one platform-region slice.",
      "Compare feature and model versions for that slice."
    ],
    answer: {
      concise:
        "Compare Android/west canary with its simultaneous control and inspect its request/feature path.",
      explanation:
        "The control stayed steady while the canary fell in one slice, pointing to a release interaction. Investigate Android/west feature payloads and routing, and halt that slice of the canary while diagnosing."
    },
    choices: [
      "Compare Android/west canary to Android/west control and inspect the slice's features.",
      "Retrain on all users immediately because global traffic changed.",
      "Ignore the issue because iOS and east-region averages stayed stable."
    ],
    correctChoiceIndex: 0,
    commonMistakes: ["Using a global average to dismiss a localized regression."],
    interviewerFollowUps: ["What release switch would let you protect just that slice?"],
    interviewConnection: "A good canary needs a matched control and slice-level guardrails."
  }),
  written({
    id: "ai-ml-applied-2",
    pathKey: "quick-check",
    title: "Locate the latency boundary",
    format: "artifact-diagnosis",
    prompt:
      "The assistant's p95 latency doubled after longer documents were enabled. Use the timing trace to identify the dominant boundary, then propose a measurement-led mitigation.",
    artifact: {
      kind: "trace",
      title: "Request waterfall by context length",
      content:
        "short context (2k tokens): retrieve 95 ms | rerank 120 ms | generate 780 ms\nlong context (22k tokens): retrieve 110 ms | rerank 125 ms | generate 2,840 ms\nlong-context request share: 9% → 38%\nmodel version and hardware: unchanged",
      caption: "Timings are p95 per stage for the same route."
    },
    topicKeys: ["latency", "context-window"],
    hints: [
      "Retrieval and reranking are nearly flat.",
      "Generation time grows with input length.",
      "Measure token counts and answer quality before pruning context."
    ],
    answer: {
      concise: "Long-context generation dominates the latency increase.",
      explanation:
        "Trace prompt tokens and time-to-first-token by request cohort, then test targeted retrieval/context pruning or summarization against answer quality. Keep a fallback and watch p95 and citation coverage."
    },
    rubric: [
      "Use stage timings to locate generation as the dominant cost.",
      "Connect the regression to the increased long-context share.",
      "Propose a quality-checked context reduction or routing experiment."
    ],
    commonMistakes: ["Optimizing retrieval despite nearly unchanged retrieval time."],
    interviewerFollowUps: ["What metric would tell you the shorter context harmed answer quality?"],
    interviewConnection: "Performance work begins by locating the stage that changed."
  }),
  written({
    id: "ai-ml-applied-3",
    pathKey: "quick-check",
    title: "Trace a changed source field",
    format: "artifact-diagnosis",
    prompt:
      "Predictions shifted after an upstream data release, but model weights did not. Diagnose the field boundary and explain a safe immediate mitigation.",
    artifact: {
      kind: "logs",
      title: "Feature-ingestion audit",
      content:
        "09:00 model_revision=model-31 (unchanged)\n09:04 billing_api release v6: monthly_spend field now cents\n09:08 feature median monthly_spend: 49.00 → 4900.00\n09:12 high-value propensity score median: 0.42 → 0.91",
      caption: "The feature schema still labels monthly_spend as currency units."
    },
    topicKeys: ["data-contracts", "feature-drift"],
    hints: [
      "The feature jumped by roughly a factor of 100.",
      "Upstream changed units without changing the contract.",
      "Restore unit parity before considering retraining."
    ],
    answer: {
      concise:
        "The billing API switched dollars to cents while the feature pipeline kept interpreting the value as dollars.",
      explanation:
        "Rollback or normalize the source field behind a versioned contract, replay representative records against the prior model, and monitor feature and prediction distributions before restoring traffic."
    },
    rubric: [
      "Identify the unit mismatch from the audit.",
      "Explain why unchanged weights can still yield changed predictions.",
      "Choose a reversible source/transform mitigation and replay test."
    ],
    commonMistakes: ["Blaming model weights for an upstream schema change."],
    interviewerFollowUps: ["Which data-contract test would have caught this before release?"],
    interviewConnection: "Model reliability depends on upstream unit and schema contracts."
  }),
  written({
    id: "ai-ml-applied-4",
    pathKey: "quick-check",
    title: "Make a response trace useful",
    format: "written",
    prompt:
      "This trace cannot explain why the assistant hallucinated a policy. Name the missing provenance fields and how you would use them to distinguish retrieval failure from generation failure.",
    artifact: {
      kind: "config",
      title: "Current production trace",
      content:
        '{\n  "request_id": "req-8a7",\n  "status": 200,\n  "latency_ms": 1380,\n  "answer": "All repairs are covered for 12 months."\n}',
      caption: "No prompt, retrieval, or model versions are recorded."
    },
    topicKeys: ["observability", "provenance"],
    hints: [
      "A status code does not show what evidence the model saw.",
      "Record retrieved document/chunk IDs and versions, prompt/model versions, and citation mapping.",
      "Replay one request to see whether the correct policy was retrieved but ignored."
    ],
    answer: {
      concise:
        "Add request-linked retrieved chunks, source/index versions, prompt and model versions, and claim-to-citation mapping.",
      explanation:
        "If the correct policy is missing from the retrieved set, fix retrieval or index freshness. If it is present but the answer contradicts it, inspect prompt, model behavior, and citation validation using a privacy-safe replay."
    },
    rubric: [
      "Name enough provenance to reconstruct evidence and serving versions.",
      "Explain the retrieval-versus-generation diagnostic split.",
      "Account for safe replay or privacy-limited logging."
    ],
    commonMistakes: ["Logging only the final text and latency."],
    interviewerFollowUps: ["What user data would you avoid storing in raw traces?"],
    interviewConnection: "Operational traces must make the failure boundary observable."
  }),
  choice({
    id: "ai-ml-applied-5",
    pathKey: "quick-check",
    title: "Choose a fraud-review threshold",
    format: "mcq",
    prompt:
      "A payment team can manually review 300 alerts per day. Which threshold gives the most defensible first pilot?",
    artifact: {
      kind: "metrics",
      title: "Daily threshold simulation",
      content:
        "0.25: 900 alerts, 88% fraud recall, 812 legitimate reviews\n0.60: 290 alerts, 72% fraud recall, 218 legitimate reviews\n0.90: 70 alerts, 30% fraud recall, 40 legitimate reviews\ncapacity: 300 reviews/day; labels delayed 48 h",
      caption: "False blocks and missed fraud have different costs."
    },
    topicKeys: ["fraud", "thresholds"],
    hints: [
      "A 900-alert queue cannot be fully reviewed.",
      "A 70-alert queue misses most known fraud.",
      "Use a feasible threshold and report both kinds of harm."
    ],
    answer: {
      concise: "Pilot 0.60 with recall, false-review burden, and delayed-label monitoring.",
      explanation:
        "The 290-alert queue fits capacity while preserving much more recall than 0.90. Validate expected costs and high-risk slices before expanding."
    },
    choices: [
      "Pilot 0.60 with capacity, recall, and false-review guardrails.",
      "Pilot 0.25 because recall is the only relevant cost.",
      "Pilot 0.90 because minimizing review volume is the only goal."
    ],
    correctChoiceIndex: 0,
    commonMistakes: ["Ignoring finite review capacity."],
    interviewerFollowUps: ["What leading signal would you watch while labels are delayed?"],
    interviewConnection: "Model thresholds are product and operations decisions."
  }),
  written({
    id: "ai-ml-applied-6",
    pathKey: "quick-check",
    title: "Unmask a delayed quality dashboard",
    format: "predict-explain",
    prompt:
      "A fraud model was replaced this morning. The quality dashboard remains green while analysts report many suspicious approvals. Explain the mismatch and decide what to monitor before labels catch up.",
    artifact: {
      kind: "metrics",
      title: "Quality dashboard and label pipeline",
      content:
        "model-v12 deployed: 09:00 today\nconfirmed fraud labels: arrive 5–7 days after transaction\ndashboard fraud recall: 84% (latest labeled cohort ended last week)\nanalyst escalations for risky approvals: 12/day → 63/day\nscore distribution above 0.8: 7% → 1%",
      caption: "The displayed recall does not include any model-v12 decisions."
    },
    topicKeys: ["delayed-labels", "monitoring"],
    hints: [
      "The dashboard's labeled cohort predates today's release.",
      "Analyst escalations and score distribution are earlier, imperfect signals.",
      "Compare model-v12 against a simultaneous control and hold rollout while confirming a labeled sample."
    ],
    answer: {
      concise: "The recall chart is stale because labels lag the new model by nearly a week.",
      explanation:
        "Pause expansion and compare score distribution, analyst escalations, and a reviewed sample against a simultaneous model-v11 control. Mark delayed recall as provisional until v12 labels arrive; keep a rollback trigger for the leading signals."
    },
    rubric: [
      "Identify that the displayed labeled recall excludes the new model.",
      "Use leading signals with their limitations and a matched control.",
      "Choose a reversible rollout decision until labels mature."
    ],
    commonMistakes: ["Treating a pre-release recall chart as evidence for the new release."],
    interviewerFollowUps: ["How would you quantify uncertainty in the early reviewed sample?"],
    interviewConnection: "Delayed labels require provisional, version-aware launch signals."
  }),
  written({
    id: "ai-ml-applied-7",
    pathKey: "quick-check",
    title: "Find the missing document after upload",
    format: "artifact-diagnosis",
    prompt:
      "A customer uploaded a revised handbook, but answers still cite the old version. Use the ingestion code and state report to locate the likely gap and propose a safe fix.",
    artifact: {
      kind: "code",
      language: "python",
      title: "ingest_handbook.py",
      content:
        "def upload_handbook(file, tenant_id):\n    blob = object_store.put(file)\n    jobs.enqueue('parse_and_index', blob.id, tenant_id)\n    return {'status': 'complete', 'blob_id': blob.id}\n\n# state report\n# blob version: v5; parse job: queued; serving index: v4\n# answer citation: handbook v4, section 3",
      caption: "The API calls upload complete before the asynchronous indexing job runs."
    },
    topicKeys: ["ingestion", "index-freshness", "python"],
    hints: [
      "Blob storage completion is not search-index completion.",
      "The parse job is still queued and the serving index is v4.",
      "Expose indexing state and route to v5 only after it is queryable."
    ],
    answer: {
      concise:
        "The upload succeeded, but asynchronous parsing/indexing has not published handbook v5.",
      explanation:
        "Track parse and index job state per source version, make the UI distinguish uploaded from searchable, verify a v5 query against the serving index, then switch retrieval atomically. Do not claim the new content is live while v4 is still served."
    },
    rubric: [
      "Separate object upload from search-index publication.",
      "Use the queued job and v4 citation to locate the gap.",
      "Propose version-aware readiness and a queryable-index verification."
    ],
    commonMistakes: ["Assuming an HTTP upload success means the document is searchable."],
    interviewerFollowUps: ["What should the product show while indexing is delayed?"],
    interviewConnection: "Asynchronous ingestion needs explicit version and readiness states."
  }),
  written({
    id: "ai-ml-applied-8",
    pathKey: "quick-check",
    title: "Narrow an overbroad safety rule",
    format: "production-decision",
    prompt:
      "A new safety rule blocks many harmless career-coaching questions in Hindi. Explain what you would inspect and how to reduce false refusals without removing protection for dangerous requests.",
    artifact: {
      kind: "logs",
      title: "Policy rollout slices",
      content:
        "rule: financial-advice-v6, enabled 10:00\nHindi career-coaching refusal: 3% → 28%\nEnglish career-coaching refusal: 2% → 3%\nharmful financial-advice refusal: 91% → 92%\nfalse refusal sample: 'salary negotiate kaise karun?'",
      caption: "The rule's scope changed for Hindi-language intent classification."
    },
    topicKeys: ["safety", "multilingual-evaluation"],
    hints: [
      "The regression is language- and intent-specific.",
      "Inspect false-refusal examples and policy category routing.",
      "Canary a narrower rule against both harmless and harmful examples."
    ],
    answer: {
      concise: "The financial-advice rule appears to overmatch Hindi career/salary questions.",
      explanation:
        "Review labeled false refusals by language and policy category, compare routing before and after v6, narrow the rule or revert that slice, and rerun multilingual benign and harmful evals before restoring traffic."
    },
    rubric: [
      "Identify the Hindi career-coaching slice and likely misclassification.",
      "Propose example-based policy/routing inspection and reversible mitigation.",
      "Protect harmful-request recall while reducing harmless refusals."
    ],
    commonMistakes: ["Disabling safety checks entirely to fix false positives."],
    interviewerFollowUps: ["Which bilingual evaluation set would you keep as a release gate?"],
    interviewConnection: "Safety tuning must measure both false refusals and missed harms."
  })
];

export function aiMlQuickCheckPath(track: PersistedAiMlPracticeTrack): AiMlStoryPath {
  return {
    key: "quick-check",
    title: "Investigate real AI/ML decisions",
    description:
      "Eight short cases with distinct evidence, including traces, metrics, and code. Earlier answers remain saved.",
    expectedMinutes: 40,
    questions: track === "core-technical" ? coreQuestions : appliedQuestions
  };
}

export function aiMlQuickCheckQuestionById(
  track: PersistedAiMlPracticeTrack,
  questionKey: string
): AiMlStoryQuestion | null {
  return (
    aiMlQuickCheckPath(track).questions.find((question) => question.id === questionKey) ?? null
  );
}
