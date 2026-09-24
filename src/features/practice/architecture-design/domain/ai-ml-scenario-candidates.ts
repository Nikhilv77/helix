import { reviewedArchitectureDesignArtifact } from "./reviewed-scenario-builder";

/** New AI/ML cases awaiting the product owner's content review before publication. */
export const AI_ML_ARCHITECTURE_SCENARIO_CANDIDATES = Object.freeze([
  reviewedArchitectureDesignArtifact({
    key: "personalized-feed-ranking-platform",
    title: "Personalized feed ranking platform",
    premise:
      "Design a feed ranker that selects relevant items from a changing catalogue while protecting new users, creators, and safety-sensitive slices.",
    candidateRole:
      "You own candidate generation, online features, ranking, exposure logging, evaluation, serving reliability, and rollout.",
    roles: ["ai-ml"],
    reviewStatus: "candidate",
    functionalRequirements: [
      "Return a ranked feed with explainable filtering and a safe fallback when personalization is unavailable.",
      "Support offline evaluation and online experiments without leaking future interactions into training."
    ],
    nonGoals: [
      "The first release does not optimize for unbounded engagement or train a foundation model."
    ],
    constraints: [
      "The serving path must enforce item eligibility and user safety policies after retrieval as well as before display.",
      "A new ranker must not silently change exposure logging or erase a rollback route."
    ],
    scaleProfile: [
      "The feed serves 12,000 requests per second at peak from 30 million active users and 20 million eligible items.",
      "The product targets p95 feed latency below 180 ms and freshness of new eligible items within ten minutes."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "recommendation-serving",
    secondaryTopicKeys: ["ranking-evaluation", "feature-freshness", "experiment-safety"],
    targetKeywords: ["ai-ml", "recommendation", "ranking", "retrieval", "features", "experiments"],
    realismAnchors: [
      "A high-volume creator can dominate exposure despite better aggregate click metrics.",
      "Delayed interaction events can make offline features look fresher than their online counterparts.",
      "Cold-start users and new items need a fallback before a personalized model has evidence."
    ],
    targetFitExplanation:
      "This case tests recommendation retrieval, point-in-time features, ranker evaluation, exposure fairness, and low-latency serving.",
    coverageExplanation:
      "Four decisions cover product contracts, event and feature data, serving failures, and a reversible experiment across all architecture dimensions.",
    questions: [
      {
        format: "written",
        objective: "Define feed outcomes, safety constraints, scale, and latency budgets.",
        dependency:
          "The outcome and latency contracts constrain candidate generation and ranking design.",
        topicKeys: ["recommendation-serving", "ranking-evaluation"],
        prompt:
          "Define the first-release feed behavior for known and cold-start users. Estimate peak requests per minute and set measurable freshness, p95 latency, eligible-item safety, and user-outcome targets. Explain what the system returns when personalization evidence is absent.",
        artifact: {
          key: "feed-demand-brief",
          kind: "metrics",
          title: "Feed demand brief",
          content:
            "Peak 12,000 requests/s; 30M active users; 20M eligible items; p95 latency target 180 ms; new eligible items should appear within ten minutes. A product note asks to maximize clicks without defining long-term value or safety guardrails.",
          caption: "Clicks alone do not define a safe feed outcome."
        },
        hints: [
          "Compute 12,000 × 60 before budgeting candidate generation and ranking.",
          "Separate item eligibility from relevance and engagement.",
          "Specify a safe non-personalized feed for cold-start or degraded requests."
        ],
        referenceAnswer: {
          summary:
            "Serve eligible items under latency and freshness contracts with a safe cold-start route.",
          explanation:
            "The peak is 720,000 requests per minute. Define eligible-item filtering as mandatory, p95 under 180 ms, new-item freshness within ten minutes, and measurable user outcomes beyond raw clicks, such as satisfied sessions or retention with creator and safety guardrails. Use a curated or popularity-based eligible feed for cold-start users and when the ranker is unavailable. Separate the candidate retrieval, feature, rank, and policy budgets within the 180 ms target."
        },
        rubric: [
          {
            criterion: "Defines user value, cold-start behavior, and mandatory eligibility.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion: "Calculates peak demand and gives measurable latency and freshness budgets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: ["Using clicks alone as proof of a useful and safe feed."],
        interviewerFollowUps: ["What would a new user see before any interaction history exists?"],
        transferConnection:
          "Cold-start and eligibility boundaries also matter in search and marketplaces."
      },
      {
        format: "artifact-diagnosis",
        objective:
          "Repair interaction, exposure, item, and feature contracts for measurable learning.",
        dependency:
          "The fixed identities and event times feed both online ranking and point-in-time training.",
        topicKeys: ["recommendation-serving", "feature-freshness"],
        prompt:
          "Repair this proposed logging and feature contract. Specify stable request and item identities, event time, exposure and outcome records, experiment assignment, user consent, replay handling, and point-in-time joins. Explain how an item deletion reaches online caches and training data.",
        artifact: {
          key: "feed-event-draft",
          kind: "config",
          title: "Proposed feed event contract",
          content:
            "Log only clicked items with userEmail, itemTitle, and current feature values. Retries append another click. Offline training joins the latest user profile. Deleted items remain in cached candidate lists until nightly rebuild.",
          caption: "The draft loses non-click exposures and leaks future feature state."
        },
        hints: [
          "A non-click is observable only if the exposure itself is logged.",
          "Separate event time from processing time and use versioned feature snapshots.",
          "Use stable IDs, consent scope, idempotent writes, and deletion tombstones."
        ],
        referenceAnswer: {
          summary:
            "Version exposures, outcomes, features, and policy state with replay-safe identities.",
          explanation:
            "An impression record carries request ID, ranked slot, item ID/version, user pseudonym or consent scope, candidate set, experiment assignment, model version, event time, and exposure policy or propensity when known. Outcomes link back to impressions with event IDs and delayed timestamps. Training joins only feature versions available at decision time. Non-click exposures provide a denominator, but position and selection bias still require randomized evaluation or suitable weighting. Event IDs make retries idempotent; item tombstones invalidate candidate caches and block serving even before asynchronous rebuild. Store minimal personal data under retention controls."
        },
        rubric: [
          {
            criterion: "Defines linked exposure and outcome events with stable identities.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion: "Models point-in-time feature and model versions.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion: "Defines online and offline access paths plus deletion invalidation.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion: "Makes retries and out-of-order outcomes safe.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Training from clicks alone hides non-click exposures; logging them still does not remove position or selection bias."
        ],
        interviewerFollowUps: ["How would you reconstruct exactly what a user saw last Tuesday?"],
        transferConnection:
          "Point-in-time joins and exposure logging transfer to ads and search ranking."
      },
      {
        format: "written",
        objective: "Design a bounded serving path and diagnose a hot-creator failure.",
        dependency:
          "The path uses the exposure and feature identities defined in the previous decision.",
        topicKeys: ["recommendation-serving", "feature-freshness"],
        prompt:
          "Draw the request path from eligible candidate retrieval through feature lookup, ranking, filtering, and logging. A hot creator floods new items while a feature-store shard slows down. Explain backpressure, partitioning, cache invalidation, failure isolation, and the exact fallback shown to users.",
        artifact: {
          key: "feed-serving-trace",
          kind: "trace",
          title: "Serving and ingestion trace",
          content:
            "At 09:00, one creator publishes 500k items. Candidate-index queue age rises to 18 min. At 09:03, one feature shard reaches p95 220 ms while the whole feed has a 180 ms p95 target. Cache hit rate falls from 86% to 42%. Other creators lose exposure.",
          caption: "Bulk ingestion, online features, and fairness are separate failure boundaries."
        },
        hints: [
          "Keep bulk indexing out of the interactive request budget.",
          "Bound per-creator and per-shard work before the ranker.",
          "Degrade to eligible cached or curated candidates with explicit quality telemetry."
        ],
        referenceAnswer: {
          summary:
            "Isolate indexing from serving, bound hot keys, and fall back to policy-safe candidates.",
          explanation:
            "Index workers consume a durable queue with per-creator quotas and freshness lag alarms. Serving retrieves eligible candidates with bounded fan-out, fetches versioned features under a tight deadline, ranks, then rechecks policy before display and logs exposure. Shard or creator hot spots require partition-aware limits and admission control; caches include item and policy versions and invalidate on deletion. If features or ranker exceed budget, serve an eligible curated or last-known-safe candidate set and record fallback rate, freshness, creator exposure, and p95 by slice."
        },
        rubric: [
          {
            criterion: "Separates indexing, retrieval, feature, ranking, and policy owners.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion: "Versions cached candidates and invalidates deleted items.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Bounds queue and request-path work.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Isolates hot creators and feature shards.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion: "Provides a policy-safe fallback under dependency failure.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Waiting for the slow feature shard on every request despite the deadline."
        ],
        interviewerFollowUps: [
          "How do you keep a hot creator from evicting every other candidate?"
        ],
        transferConnection:
          "Bounded fan-out and safe fallback apply to many online ranking systems."
      },
      {
        format: "production-decision",
        objective: "Choose experiment gates, privacy controls, cost limits, and rollback.",
        dependency:
          "The release uses the same identities, safety rules, and latency budget as the current route.",
        topicKeys: ["ranking-evaluation", "experiment-safety"],
        prompt:
          "Decide whether to expand this ranker experiment. Give offline and online gates, user and creator slice checks, privacy and cost controls, stop conditions, and a rollback plan. Explain what evidence would outweigh the aggregate click lift.",
        artifact: {
          key: "feed-experiment-report",
          kind: "metrics",
          title: "Ranker canary report",
          content:
            "Aggregate clicks +4%; satisfied sessions -2%; cold-start retention -5%; new-creator exposure -18%; p95 latency 205 ms against 180 ms; per-request feature cost +35%. Eligibility violations remain zero in the observed sample.",
          caption: "The average click lift masks user and creator regressions and a latency breach."
        },
        hints: [
          "Use an intent-to-treat comparison and examine exposure and user slices.",
          "A latency breach and harmed cold-start users should have explicit stop rules.",
          "Keep the previous ranker, feature set, and policy route available together."
        ],
        referenceAnswer: {
          summary:
            "Do not expand the canary; investigate quality and slice regressions before another gated rollout.",
          explanation:
            "The experiment fails the 180 ms p95 target and reduces satisfied sessions, cold-start retention, and new-creator exposure despite higher clicks. Stop expansion, restore the previous ranker and compatible features, and verify recovery. Re-evaluate on time-split offline data and randomized online cohorts with user, creator, safety, and latency slices. Protect consent and retention for exposure logs; cap feature and inference cost per feed. Release only after predefined guardrails pass and rollback has been rehearsed."
        },
        rubric: [
          {
            criterion: "Defines comparable online and offline quality and SLO gates.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion: "Protects consent and data retention for exposure evidence.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Sets a defensible feature and inference cost budget.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Explains why slice harm outweighs aggregate clicks.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Stops and rolls back compatible model and feature versions.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: ["Promoting the model solely on aggregate click lift."],
        interviewerFollowUps: ["What observation would justify a narrower second canary?"],
        transferConnection:
          "Segment guardrails and reversible experiments also apply to fraud and search models."
      }
    ]
  }),
  reviewedArchitectureDesignArtifact({
    key: "document-vision-intake-platform",
    title: "Document vision intake platform",
    premise:
      "Design a document intake system that extracts fields from uploaded forms, routes uncertain results to human review, and keeps private documents isolated by customer.",
    candidateRole:
      "You own upload and model contracts, asynchronous extraction, review handoff, quality measurement, data protection, and model rollout.",
    roles: ["ai-ml"],
    reviewStatus: "candidate",
    functionalRequirements: [
      "Extract named fields with source evidence and return a reviewed or explicitly uncertain result.",
      "Allow a customer to correct an extraction without losing the original document and model lineage."
    ],
    nonGoals: [
      "The system will not silently approve a regulated decision from an unreviewed extraction."
    ],
    constraints: [
      "Private document pixels and extracted values must remain within the owning customer's access scope and retention policy.",
      "A model version change cannot overwrite an in-progress human review or its evidence."
    ],
    scaleProfile: [
      "The system receives 4 million pages per day with a 20-fold business-hour burst and pages from 500 customers.",
      "Ninety-five percent of standard pages should reach extraction within two minutes; high-risk fields require human review below a calibrated confidence threshold."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "vision-document-processing",
    secondaryTopicKeys: ["human-review", "model-calibration", "private-data"],
    targetKeywords: [
      "ai-ml",
      "computer-vision",
      "ocr",
      "document",
      "human-review",
      "classification"
    ],
    realismAnchors: [
      "Low image quality and unseen layouts can raise confident but wrong field predictions.",
      "A retry after a worker timeout can process the same page twice while a reviewer is editing it.",
      "Customer deletion and retention rules apply to source images, crops, features, review queues, and training exports."
    ],
    targetFitExplanation:
      "This case tests computer vision operations, calibrated uncertainty, asynchronous processing, human review, and private-data handling.",
    coverageExplanation:
      "Four connected decisions cover service contracts, versioned page evidence, worker failure, and safe model rollout across all architecture dimensions.",
    questions: [
      {
        format: "written",
        objective: "Define extraction quality, review behavior, capacity, and latency contracts.",
        dependency: "The quality and review contracts determine data identities and worker sizing.",
        topicKeys: ["vision-document-processing", "human-review"],
        prompt:
          "Define the first release for uploaded forms, uncertain fields, and reviewer correction. Estimate average pages per second and the stated burst. Set measurable time-to-extraction, field quality, human-review, and privacy requirements. What happens when the model cannot read a required field?",
        artifact: {
          key: "document-demand-brief",
          kind: "metrics",
          title: "Intake demand brief",
          content:
            "Four million pages/day; business-hour bursts reach 20 times the daily average. Standard-page p95 extraction target: two minutes. Some fields are high risk, but the proposed requirement says to auto-accept every field above a raw confidence score of 0.8.",
          caption: "Raw confidence is not a calibrated error probability."
        },
        hints: [
          "Divide daily pages by 86,400 seconds, then multiply for the burst.",
          "Separate field-level accuracy from document completion and review backlog.",
          "Treat unreadable or unsupported layouts as explicit review outcomes."
        ],
        referenceAnswer: {
          summary:
            "Use calibrated field thresholds, explicit review, and a burst-capable asynchronous pipeline.",
          explanation:
            "Four million pages/day averages about 46 pages/s; the stated burst is roughly 926 pages/s. The upload endpoint returns a durable job ID, not an invented immediate result. Define standard-page p95 under two minutes, field precision and recall by layout and risk class, review queue age and capacity, and a no-silent-approval rule for high-risk or unreadable fields. A raw score of 0.8 is insufficient without calibration and slice evidence. Privacy requires customer isolation and deletion/retention checks throughout the pipeline."
        },
        rubric: [
          {
            criterion: "Defines safe uncertain-field and reviewer behavior.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion: "Calculates average and burst capacity with measurable latency and quality.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: ["Treating model confidence as guaranteed correctness."],
        interviewerFollowUps: ["How does the behavior change for a high-risk field?"],
        transferConnection:
          "Calibrated abstention also applies to fraud review and medical document triage."
      },
      {
        format: "artifact-diagnosis",
        objective: "Repair document, page, extraction, correction, and deletion contracts.",
        dependency:
          "Stable versions let workers retry and reviewers correct results without rewriting history.",
        topicKeys: ["vision-document-processing", "private-data"],
        prompt:
          "Repair the proposed data contract. Specify upload and page IDs, tenant scope, document/model versions, field evidence, reviewer corrections, idempotency, and deletion. Explain how a retry after a correction avoids overwriting the reviewer.",
        artifact: {
          key: "document-contract-draft",
          kind: "config",
          title: "Proposed extraction record",
          content:
            "{ filename, customerName, fields: { value, confidence } }. Each retry overwrites the record by filename. Reviewer corrections edit the same field values. Page images and crops stay in a shared bucket forever for training.",
          caption: "The draft lacks stable identity, evidence provenance, and deletion controls."
        },
        hints: [
          "A filename is not a document identity or an authorization scope.",
          "Keep model output immutable and layer reviewer corrections with their own version.",
          "Propagate customer deletion to images, crops, queues, and training exports."
        ],
        referenceAnswer: {
          summary:
            "Use tenant-scoped immutable extraction versions and separately versioned corrections.",
          explanation:
            "Assign tenant-derived document ID, upload event ID, source checksum, page ID, model and preprocessing versions, field coordinates, confidence, and source page evidence. Retries with the same event ID are idempotent; a worker writes a new immutable extraction version only if its source/model version still matches. Review corrections have reviewer, timestamp, and version and take precedence over late worker results. Store images and crops under tenant-scoped access and retention, with tombstones that invalidate derived and training copies."
        },
        rubric: [
          {
            criterion: "Defines tenant-scoped upload, page, and correction events.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion: "Versions model output and reviewer edits separately.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion: "Defines access and retention paths for images and derived crops.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion: "Prevents retry or late-worker overwrites.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: ["Allowing a delayed model retry to erase a human correction."],
        interviewerFollowUps: ["Which version wins if a worker completes after review?"],
        transferConnection:
          "Immutable machine output plus human corrections also fits labeling and moderation."
      },
      {
        format: "written",
        objective: "Design ingestion and review capacity under a burst and partial failure.",
        dependency:
          "The queues and stores preserve the version and tenant boundaries defined earlier.",
        topicKeys: ["vision-document-processing", "human-review"],
        prompt:
          "Design upload, page splitting, preprocessing, model inference, field validation, and reviewer routing. A large customer sends a burst while GPU workers fail and review queue age rises. Isolate customers, bound work, protect source data, and describe the user-visible degraded state.",
        artifact: {
          key: "document-worker-trace",
          kind: "trace",
          title: "Worker and review trace",
          content:
            "At 10:00, customer A submits 300k pages. GPU error rate rises to 25%; extraction queue age reaches seven minutes; review queue age reaches three hours. Customer B's normal uploads also miss the two-minute standard-page target.",
          caption: "Bulk admission and review capacity need separate controls."
        },
        hints: [
          "A durable job queue should isolate tenants and record retry state.",
          "Cap GPU retries and route poison pages to diagnosis rather than infinite replay.",
          "Expose pending and review-required states without pretending extraction succeeded."
        ],
        referenceAnswer: {
          summary:
            "Isolate tenant queues and GPU work, bound retries, and expose truthful pending/review states.",
          explanation:
            "Accept uploads durably into tenant-scoped encrypted storage and return job IDs. Page splitting and preprocessing feed bounded inference queues with per-tenant admission, worker budgets, retries, and a dead-letter route for damaged pages. Model output goes through field validation and calibrated review routing. Cache only versioned, access-controlled results and invalidate on correction or deletion. Customer A's burst cannot starve B; GPU failure triggers backpressure and queue-age alerts, while the UI shows pending or review-required status. Review staffing and priority are tracked separately from inference throughput."
        },
        rubric: [
          {
            criterion:
              "Separates upload, preprocessing, inference, validation, and review ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion: "Caches only versioned, tenant-scoped results.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Bounds jobs, retries, and review work.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Isolates the bursty tenant and hot worker partitions.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion: "Provides truthful degraded states and recovery paths.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: ["Retrying failing GPU jobs without a limit while all tenants wait."],
        interviewerFollowUps: ["How would you restore customer B's latency first?"],
        transferConnection:
          "Tenant-aware queues and bounded retries apply to most document pipelines."
      },
      {
        format: "production-decision",
        objective: "Choose calibrated quality gates, privacy controls, cost, and rollback.",
        dependency:
          "The release preserves the previous model and reviewer state while comparing new output.",
        topicKeys: ["model-calibration", "private-data"],
        prompt:
          "Decide whether to expand the new extractor. Set calibration and review gates by layout and risk class, privacy and cost limits, canary stop conditions, and rollback. Explain how to compare model output when human corrections arrive later.",
        artifact: {
          key: "document-model-canary",
          kind: "metrics",
          title: "Extractor canary report",
          content:
            "Average character accuracy +3%; high-risk field false accepts rise from 0.2% to 0.8%; review volume falls 15%; unseen-layout error rate doubles; p95 inference cost per page +40%. A correction sample is available only for the old model.",
          caption: "Average OCR gain cannot justify a high-risk false-accept regression."
        },
        hints: [
          "Compare on the same labeled pages and shadow the candidate on current traffic.",
          "Gate high-risk false accepts and unseen layouts before review-volume gains.",
          "Retain model and preprocessing versions so rollback is one route change."
        ],
        referenceAnswer: {
          summary:
            "Stop expansion until high-risk false accepts and unseen-layout quality recover.",
          explanation:
            "The fourfold increase in high-risk false accepts fails a safety gate despite average character accuracy improving. Build a stratified, versioned labeled set and shadow the new model on current pages without changing review decisions; compare precision, calibration, abstention, correction burden, and latency by layout and field risk. Apply tenant privacy and retention to shadow output. Budget GPU and reviewer cost together. Canary only after gates pass, with stop thresholds for false accepts, review backlog, queue age, and cost. Keep old preprocessing, model, thresholds, and review route available for rollback; delayed corrections should be attributed to the exact model version."
        },
        rubric: [
          {
            criterion: "Defines calibrated quality and review SLOs by risk slice.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion: "Protects private source and shadow output under tenant retention.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Budgets inference and human-review costs together.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Explains why false accepts outweigh average OCR gains.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Canaries and rolls back a compatible processing route.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Promoting on character accuracy without checking high-risk field false accepts."
        ],
        interviewerFollowUps: [
          "Which immediate signal stops the canary before corrections mature?"
        ],
        transferConnection:
          "Risk-sliced calibration and human review also matter in fraud and content moderation."
      }
    ]
  })
]);
