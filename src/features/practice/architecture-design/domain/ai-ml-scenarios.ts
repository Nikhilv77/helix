import {
  reviewedArchitectureDesignArtifact,
  type ArchitectureDesignScenarioSeed
} from "./reviewed-scenario-builder";

type StageSeed = ArchitectureDesignScenarioSeed["questions"][number];

function stage(input: StageSeed): StageSeed {
  return input;
}

/** Reviewed scenarios use the same Architecture content and publication path as other roles. */
export const AI_ML_ARCHITECTURE_SCENARIOS = Object.freeze([
  reviewedArchitectureDesignArtifact({
    key: "retrieval-augmented-support-assistant",
    title: "Retrieval-augmented support assistant",
    premise:
      "Design a customer-support assistant that answers from tenant-owned documentation, cites its sources, and safely hands uncertain cases to a human.",
    candidateRole:
      "You own the document-to-answer path, model and index versions, access controls, evaluation, serving reliability, and reversible rollout.",
    roles: ["ai-ml"],
    reviewStatus: "approved",
    reviewerId: "project-owner",
    reviewedAt: "2026-09-23",
    functionalRequirements: [
      "Answer support questions using only documents the requesting agent may access, with citations to the exact source version.",
      "Keep changed and deleted policies out of answers within a declared freshness window, and escalate when evidence is missing."
    ],
    nonGoals: [
      "The first release will not take customer-account actions or train a foundation model on private documents."
    ],
    constraints: [
      "Tenant access and policy deletion must be enforced before retrieval and again before a cited answer is returned.",
      "A model or vector-index upgrade must not mix incompatible embeddings or remove the previous safe route before rollback is tested."
    ],
    scaleProfile: [
      "Eight million documents across 3,000 tenants change at a peak of 2,000 documents per second.",
      "Serving peaks at 400 questions per second; product targets p95 first answer under four seconds and 99 percent index freshness within five minutes."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "rag-serving",
    secondaryTopicKeys: ["retrieval-evaluation", "tenant-safety", "model-operations"],
    targetKeywords: ["ai-ml", "rag", "retrieval", "embeddings", "evaluation", "model-serving"],
    realismAnchors: [
      "A policy document can be deleted while an old embedding remains in a serving index or cache.",
      "A more fluent model can lower grounded answer quality without changing HTTP success rates.",
      "A new embedding model requires a compatible index and a reversible routing boundary."
    ],
    targetFitExplanation:
      "This case tests production AI engineering: authorized retrieval, grounded generation, measurable quality, model and index versions, and operational recovery.",
    coverageExplanation:
      "Four connected decisions cover requirements, data contracts, serving failure, and safe evolution across all sixteen architecture dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Turn answer quality, authorization, freshness, latency, and escalation into measurable product contracts.",
        dependency:
          "The agreed access and freshness boundaries constrain the document contracts and serving architecture that follow.",
        topicKeys: ["rag-serving", "retrieval-evaluation"],
        prompt:
          "Define the first-release answer and escalation behavior. Estimate the minimum sustained chunk-and-embedding throughput from the supplied change rate, then set measurable authorization, citation, freshness, latency, and grounded-answer targets. State what each target measures and when the assistant must abstain.",
        artifact: {
          key: "rag-demand-and-quality-brief",
          kind: "metrics",
          title: "Demand and quality brief",
          content:
            "8M documents, 3,000 tenants, peak 2,000 changed documents/s, average 3 chunks per changed document, peak 400 questions/s. p95 first answer target: 4s. 99% changed-policy freshness target: 5 min. The product says every answer should be correct, even when documents conflict or evidence is missing.",
          caption:
            "Quality and citation claims need a measured evaluation set and a defined abstention boundary."
        },
        hints: [
          "Separate response availability from grounded answer quality and from the permission to cite a document.",
          "Estimate changed-document throughput, embedding work, index headroom, and the request path independently.",
          "Define an explicit abstain or human-escalation condition when retrieved evidence is absent or contradictory."
        ],
        referenceAnswer: {
          summary:
            "Scope authorized, cited answers with a visible abstention path and separate quality, freshness, latency, and availability SLOs.",
          explanation:
            "The first release answers from the caller's authorized tenant corpus and cites stable document versions; missing or conflicting evidence triggers escalation. At 2,000 changes/s and three chunks each, the pipeline must sustain at least 6,000 chunk embeddings/s during peak changes, plus retry and backfill headroom; 600,000 document changes arrive during the five-minute freshness window. Serving 400 questions/s needs a separate retrieval and generation budget. Evaluate groundedness, citation correctness, answer usefulness, and safe abstention on a versioned judged set and guarded online outcomes. Set zero cross-tenant citations, 99% changed-policy freshness within five minutes, p95 first answer below four seconds, and a separate availability target. Authorization revocation and deletion must block citation immediately at request time even while index cleanup is asynchronous."
        },
        rubric: [
          {
            criterion:
              "Defines authorized citation, abstention, and explicit first-release non-goals.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Quantifies ingestion and serving loads with measurable quality and latency targets.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: ["Treating HTTP 200 as proof that an answer is grounded or authorized."],
        interviewerFollowUps: [
          "What would the assistant do when two currently authorized documents disagree?"
        ],
        transferConnection:
          "Explicit evidence and abstention boundaries also matter in search, recommendations, and decision-support systems."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair document, chunk, embedding, citation, and index-generation contracts without losing access or deletion semantics.",
        dependency:
          "The document and index versions become the stable identities consumed by retrieval, traces, canaries, and rollback.",
        topicKeys: ["rag-serving", "tenant-safety"],
        prompt:
          "Diagnose this ingestion and answer contract. Specify stable identities, versioned data, authorization keys, replay handling, and a deletion path that covers live and rebuilding indexes.",
        artifact: {
          key: "rag-contract-draft",
          kind: "config",
          title: "Proposed document and answer contract",
          content:
            "chunk { text, vector, tenantName }; answer { text, sourceUrl }. Ingestion overwrites vectors by arrival time. The client submits tenantName; retrieval trusts it. A deleted policy is removed from the source database, but not the vector index, answer cache, or rebuild. Model and embedding versions are stored in a deployment chat message.",
          caption:
            "The draft lacks stable source versions, authorization scope, model lineage, and deletion evidence."
        },
        hints: [
          "Derive access scope from the authenticated caller; do not trust a tenant name supplied by the model or client.",
          "Give each source version, chunk, embedding model, index generation, and answer citation an explicit identity.",
          "A versioned deletion must dominate delayed upserts and reach caches and every serving or rebuilding index."
        ],
        referenceAnswer: {
          summary:
            "Use server-derived scope and immutable source, chunk, embedding, index, prompt, and model identities with version-conditional writes.",
          explanation:
            "Document records carry tenant ID, authorization policy version, source ID/version, deletion version, and ingestion event ID. Chunk IDs derive from source version and segmentation version; vectors include embedding model/version and index generation so incompatible spaces never mix. A retrieval trace records authorized scope, retrieved chunk versions, ranking configuration, prompt and model versions, and citations. Consumers apply only newer source versions; tombstones dominate delayed replay. Deletion propagates to serving indexes, rebuilds, caches, and retained evidence under policy, with reconciliation records."
        },
        rubric: [
          {
            criterion:
              "Defines authorized request and citation contracts with stable source and event identity.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion: "Models chunk, embedding, model, prompt, and index versions explicitly.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion:
              "Defines access paths for tenant-scoped retrieval, replay, and deletion verification.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion: "Rejects stale events and gives deletion a durable ordering boundary.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Mixing vectors produced by two embedding versions in one unversioned index makes quality and rollback unverifiable."
        ],
        interviewerFollowUps: [
          "How would you prove that a deleted policy cannot be cited by an old cache entry?"
        ],
        transferConnection:
          "Versioned derived data and tombstones transfer to feature stores, search indexes, and materialized views."
      }),
      stage({
        format: "written",
        objective:
          "Design ingestion, retrieval, generation, and failure isolation under hot tenants and dependency outages.",
        dependency:
          "The architecture must preserve the source and access identities defined previously while meeting the quality and latency contracts.",
        topicKeys: ["rag-serving", "model-operations"],
        prompt:
          "Sketch the source-to-answer path, including ingestion, index publication, authorized retrieval, model serving, caches, queues, and fallbacks. The trace shows simultaneous freshness and latency breaches: isolate their causes, protect tenant B, and state exactly what the assistant returns when evidence or the model route is unavailable.",
        artifact: {
          key: "rag-serving-failure-trace",
          kind: "trace",
          title: "Serving and indexing failure trace",
          content:
            "At 11:00, tenant A imports 900k documents. Index queue age rises to 12 minutes. At 11:03, model-provider p95 jumps to 8 seconds. At 11:04, the answer cache still serves citations from the prior index generation. Tenant B sees normal traffic but elevated answer latency.",
          caption:
            "The design must separate bulk indexing, interactive serving, provider failure, and stale-cache behavior."
        },
        hints: [
          "Separate bulk ingestion capacity from the interactive retrieval and generation budget.",
          "Cache keys must include tenant, authorization, source/index generation, and model or prompt policy where relevant.",
          "When evidence or the provider is unavailable, define a safe answer, retry limit, or escalation instead of guessing."
        ],
        referenceAnswer: {
          summary:
            "Use isolated checkpointed ingestion, versioned index publication, authorized retrieval, bounded generation, and observable safe fallbacks.",
          explanation:
            "A durable document-change log feeds partitioned chunking and embedding workers with bounded retries, dead-letter diagnosis, and tenant-aware quotas. Workers publish only into a compatible versioned index; a readiness gate switches the active generation. Serving authenticates the caller, derives tenant and policy scope, retrieves and reranks allowed chunks, applies a context budget, then invokes a pinned prompt/model route. Cache keys include access and source/index versions, with invalidation on policy or deletion changes. Bulk import cannot starve serving; provider timeouts trigger a safe fallback or human handoff. Metrics split queue age, retrieval freshness, citation quality, p95 latency, fallback use, and tenant impact."
        },
        rubric: [
          {
            criterion: "Separates ingestion, retrieval, generation, and publication ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion: "Keys and invalidates caches with authorization and source versions.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Bounds embedding work, retries, and interactive-serving queues.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Isolates hot tenants and skewed indexing partitions.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion: "Defines safe provider and stale-index failure behavior.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Serving a confident uncited answer when retrieval or the model route fails hides a product failure as success."
        ],
        interviewerFollowUps: [
          "Which queue or cache would you inspect first for tenant B's rising latency?"
        ],
        transferConnection:
          "Separating bulk and interactive capacity also applies to search indexing and online feature computation."
      }),
      stage({
        format: "production-decision",
        objective:
          "Choose evaluation, privacy, cost, and reversible model-and-index migration gates for production.",
        dependency:
          "The rollout compares against the frozen contracts and keeps one compatible serving route throughout migration.",
        topicKeys: ["rag-serving", "retrieval-evaluation"],
        prompt:
          "Decide whether this candidate embedding-and-generator pair can be promoted now. Define offline and online quality gates, safety and privacy checks, latency and cost budgets, canary stop rules, rollback, and post-release monitoring.",
        artifact: {
          key: "rag-migration-options",
          kind: "config",
          title: "Proposed AI release plan",
          content:
            "Proposal A overwrites vectors, prompt text, and model alias in place. Proposal B builds a versioned index, shadows comparable traffic, canaries tenants, and retains the old route. On the same judged set, grounded answers rise from 91% to 94%, citation correctness falls from 99.7% to 97.8%, and p95 first answer rises from 3.4s to 4.7s. No tenant or deleted-policy slices have been measured.",
          caption:
            "A safe promotion gate needs comparable quality, privacy, latency, cost, and reversible routing evidence."
        },
        hints: [
          "A new embedding model needs a separate compatible index, not mixed vectors in the live generation.",
          "Compare groundedness, citation correctness, abstention, safety, latency, and cost against a control by important segment.",
          "Give the canary one owner and a tested kill switch that restores the old model-plus-index route together."
        ],
        referenceAnswer: {
          summary:
            "Choose versioned shadow-and-canary migration with one serving authority, quality and safety gates, cost limits, and joint model-index rollback.",
          explanation:
            "Do not promote the measured candidate: citation correctness regresses by 1.9 percentage points and p95 first answer breaches the four-second target by 0.7 seconds, despite improved groundedness. Build a versioned index from versioned sources while the old route serves. Freeze embedding, retriever, prompt, generator, and policy versions, then shadow comparable requests without exposing new answers. Evaluate citation correctness, abstention, harmful-output and deleted-policy slices, protected user outcomes, p95 latency, provider failures, and cost per resolved case. Only after all gates pass, canary by tenant with one routing authority and stop thresholds; preserve old index and model capacity until joint rollback rehearsal passes. Minimize stored prompts and traces, enforce retention and access controls, and record change provenance for audits."
        },
        rubric: [
          {
            criterion: "Defines quality, safety, freshness, and operational SLOs by segment.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion: "Enforces tenant privacy, scoped traces, and deletion obligations.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion:
              "Budgets embedding, inference, storage, and fallback cost per useful outcome.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Explains quality-versus-latency and abstention trade-offs with evidence.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Canaries and rolls back model and index as one compatible route.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Replacing the old index before the new model is evaluated makes a model regression impossible to roll back cleanly."
        ],
        interviewerFollowUps: [
          "Which guardrail would stop expansion even if average answer usefulness improved?"
        ],
        transferConnection:
          "Versioned shadow traffic and reversible routing also apply to classifiers and recommendation models."
      })
    ]
  }),
  reviewedArchitectureDesignArtifact({
    key: "real-time-fraud-model-platform",
    title: "Real-time fraud decision platform",
    premise:
      "Design a low-latency fraud-scoring platform that combines event streams, point-in-time features, a versioned model, and a human-review path before a payment is accepted.",
    candidateRole:
      "You own online feature correctness, model serving, decision traceability, quality monitoring, and safe rollout across merchants and regions.",
    roles: ["ai-ml"],
    reviewStatus: "approved",
    reviewerId: "project-owner",
    reviewedAt: "2026-09-23",
    functionalRequirements: [
      "Score payment attempts quickly enough to support an approve, challenge, or review decision with a traceable policy version.",
      "Train and evaluate on point-in-time features without leaking outcomes unavailable when the original decision was made."
    ],
    nonGoals: [
      "The service does not own payment capture, guarantee zero fraud, or silently auto-decline every request with a missing feature."
    ],
    constraints: [
      "Serving must not read a feature computed after the decision time or reuse another merchant's feature state.",
      "A feature-store outage must produce a documented policy outcome, not an unobserved default score."
    ],
    scaleProfile: [
      "The platform peaks at 40,000 decisions per second across regions and sees bursty merchant-specific traffic.",
      "The decision path targets p99 below 120 milliseconds; confirmed fraud labels arrive days or weeks later."
    ],
    difficulties: ["guided", "standard", "stretch"],
    primaryTopicKey: "online-ml-serving",
    secondaryTopicKeys: ["feature-parity", "fraud-evaluation", "model-rollout"],
    targetKeywords: ["ai-ml", "fraud", "features", "model-serving", "evaluation", "drift"],
    realismAnchors: [
      "Fraud labels arrive late and are biased toward transactions selected for review.",
      "One merchant changes its event schema, causing missing online features without a transport error.",
      "An updated threshold can improve aggregate precision while harming one protected segment."
    ],
    targetFitExplanation:
      "This case tests ML production fundamentals: point-in-time data, online feature parity, delayed labels, segment metrics, low-latency serving, and reversible decisions.",
    coverageExplanation:
      "The four-stage arc connects requirements and scale to feature contracts, failure isolation, and measurable model evolution across all architecture dimensions.",
    questions: [
      stage({
        format: "written",
        objective:
          "Define decision outcomes and latency, quality, review, and delayed-label measurement boundaries.",
        dependency:
          "The accepted decision and feature-time contracts determine the data model and online serving behavior that follow.",
        topicKeys: ["online-ml-serving", "fraud-evaluation"],
        prompt:
          "Frame approve, challenge, and review behavior for a first release. Estimate peak serving and feature traffic, calculate the maximum daily review fraction, then define latency, availability, fraud-loss, false-positive, and review-capacity objectives without pretending delayed labels are immediate truth.",
        artifact: {
          key: "fraud-decision-demand-brief",
          kind: "metrics",
          title: "Fraud decision demand brief",
          content:
            "100M payment attempts/day; peak 40,000 attempts/s across regions. p99 decision target below 120ms. Labels arrive 3–30 days later. Human reviewers can handle 8,000 cases/day. Product asks for zero fraudulent approvals and no legitimate customer challenges.",
          caption:
            "The goals conflict; the candidate must define measurable costs and a finite review budget."
        },
        hints: [
          "Separate transport success, model score, final policy decision, and eventual fraud outcome.",
          "Translate the review team's daily capacity into a bounded share of peak and typical decisions.",
          "Use segment-level false positives, missed fraud, calibration, and business cost rather than one accuracy number."
        ],
        referenceAnswer: {
          summary:
            "Define three explicit decision states, low-latency serving, bounded review, and segment-aware quality measured after label delay.",
          explanation:
            "The first release scores an authorized payment attempt and returns approve, challenge, or review with model, feature, policy, and decision versions. Forty thousand peak decisions/s require region-aware capacity and headroom for feature lookups, inference, policy, and audit. Split the p99 120ms budget across those stages and define a safe outage policy. At 100M daily attempts, 8,000 human reviews permit at most 0.008% of attempts, before re-review or staffing loss; a broad review-on-error fallback is impossible. Measure false-positive cost, confirmed fraud loss, calibration, and segment impact on label-delay-aware cohorts with clear exclusions rather than claiming zero fraud or zero friction."
        },
        rubric: [
          {
            criterion:
              "Defines decision states, ownership, non-goals, delayed labels, and review constraints.",
            points: 5,
            dimensionKeys: ["requirements-framing"]
          },
          {
            criterion:
              "Quantifies peak serving load and a stage-level latency and review-capacity budget.",
            points: 5,
            dimensionKeys: ["capacity-estimation"]
          }
        ],
        commonMistakes: [
          "Claiming 100 percent fraud detection and zero false positives ignores conflicting objectives and delayed labels."
        ],
        interviewerFollowUps: [
          "How would you estimate false-positive cost before all fraud labels have arrived?"
        ],
        transferConnection:
          "Delayed outcomes and constrained human review also appear in abuse detection and high-risk content moderation."
      }),
      stage({
        format: "artifact-diagnosis",
        objective:
          "Repair event-time feature, model, decision, and label lineage without training-serving leakage.",
        dependency:
          "Stable event and model identities must be preserved through every online decision and later offline training join.",
        topicKeys: ["online-ml-serving", "feature-parity"],
        prompt:
          "Diagnose the proposed feature and decision contract. Define event-time joins, missing-feature behavior, versioned decisions, merchant scope, and label lineage that can reproduce a past prediction.",
        artifact: {
          key: "fraud-feature-contract-draft",
          kind: "config",
          title: "Proposed online feature contract",
          content:
            "score(paymentId, merchantName) reads the latest feature row by user ID. Training joins every payment to today's feature table and current chargeback status. Online missing features become zero without a flag. Decision logs keep only paymentId and score; retries create new decisions with no stable identity.",
          caption:
            "The proposal leaks future information and cannot reproduce or audit historical decisions."
        },
        hints: [
          "Offline training must use feature values available at the original prediction timestamp, not today's latest row.",
          "A stable attempt ID, merchant scope, feature snapshot/version, model version, and policy version belong in the decision record.",
          "Missing online data should take a documented fallback or review path with an observable missingness reason."
        ],
        referenceAnswer: {
          summary:
            "Use tenant-scoped stable attempt IDs, point-in-time feature versions, explicit missingness, and reproducible model-policy decision records.",
          explanation:
            "The server derives merchant scope from authorization and uses a stable payment-attempt identity for retries. Stream events carry event time, ingestion time, source version, and idempotency key. Online features are versioned with freshness and missingness status; training joins only values available by the original decision time and applies delayed-label cutoff rules. A decision record retains model, feature-definition, feature-snapshot, threshold/policy versions, score, action, and bounded explanation metadata. Version-conditional writes and an outbox preserve the decision with its dispatch intent while duplicate events cannot rewrite older state."
        },
        rubric: [
          {
            criterion: "Defines authorized scoring and stable retry and decision identities.",
            points: 3,
            dimensionKeys: ["api-event-contracts"]
          },
          {
            criterion:
              "Models point-in-time features, delayed labels, model, policy, and decision lineage.",
            points: 3,
            dimensionKeys: ["data-modeling"]
          },
          {
            criterion: "Defines merchant-leading feature and historical replay access paths.",
            points: 2,
            dimensionKeys: ["storage-access-patterns"]
          },
          {
            criterion: "Prevents stale or duplicate events from rewriting a committed decision.",
            points: 2,
            dimensionKeys: ["consistency-transactions"]
          }
        ],
        commonMistakes: [
          "Joining historical transactions against today's features creates temporal leakage and an unrealistically strong offline evaluation."
        ],
        interviewerFollowUps: [
          "Which exact record would you inspect to reproduce a decision made two weeks ago?"
        ],
        transferConnection:
          "Point-in-time joins and stable lineage matter in recommendations, forecasting, and clinical decision support."
      }),
      stage({
        format: "written",
        objective:
          "Design low-latency scoring and feature pipelines with isolated merchant bursts and safe missing-data behavior.",
        dependency:
          "Serving must honor the event-time contracts and the decision latency budget while preserving auditability.",
        topicKeys: ["online-ml-serving", "feature-parity"],
        prompt:
          "Design the event-to-feature-to-decision path, including online serving, offline training parity, cache strategy, queue isolation, and failure behavior when the feature store or model route degrades.",
        artifact: {
          key: "fraud-feature-outage-trace",
          kind: "trace",
          title: "Merchant-specific scoring failure",
          content:
            "Merchant C doubles traffic after a campaign. Feature-store p99 rises from 18ms to 90ms for that merchant. Another merchant's online feature values become null after a schema change, but scoring still returns HTTP 200. Review queue age passes six hours while fraud labels remain delayed.",
          caption:
            "Transport success hides a feature-quality incident and an overloaded review fallback."
        },
        hints: [
          "Separate event ingestion, online feature materialization, inference, policy, and decision audit boundaries.",
          "Caches need merchant scope, feature-definition version, freshness, and invalidation semantics.",
          "A missing feature or exhausted review queue needs an explicit policy action and alert, not a silent zero value."
        ],
        referenceAnswer: {
          summary:
            "Use versioned streaming features, a bounded low-latency serving path, merchant isolation, and explicit degraded decisions.",
          explanation:
            "A durable event stream feeds checkpointed feature processors with event-time watermarks, idempotent updates, and parity-tested definitions shared with offline joins. Serving loads merchant-scoped fresh features, applies a pinned model, then a separately versioned policy before writing the decision trace. Hot merchant partitions receive quotas or isolation; review requests use bounded queues with age and capacity alerts. Cache keys include merchant, feature version, and freshness limits. Feature or model outages use a documented approve/challenge/review policy based on risk and available evidence, never an invisible default. Monitor missingness, skew, feature age, scoring latency, decision mix, reviewer backlog, and eventual labeled outcomes."
        },
        rubric: [
          {
            criterion: "Separates feature computation, inference, policy, and decision ownership.",
            points: 2,
            dimensionKeys: ["component-boundaries"]
          },
          {
            criterion: "Defines scoped, versioned, freshness-bounded feature caching.",
            points: 2,
            dimensionKeys: ["caching-contention"]
          },
          {
            criterion: "Bounds streaming replay and review-queue backpressure.",
            points: 2,
            dimensionKeys: ["async-work-backpressure"]
          },
          {
            criterion: "Isolates merchant bursts and skewed feature keys.",
            points: 2,
            dimensionKeys: ["partitioning-hotspots"]
          },
          {
            criterion: "Defines visible, safe decisions during feature or model failure.",
            points: 2,
            dimensionKeys: ["reliability-failure-isolation"]
          }
        ],
        commonMistakes: [
          "Converting every feature outage into human review can silently overwhelm the review team and miss the decision deadline."
        ],
        interviewerFollowUps: [
          "Which stage of the 120ms budget would you shed first during a merchant burst?"
        ],
        transferConnection:
          "Versioned online features and bounded degraded behavior also apply to recommendations and real-time personalization."
      }),
      stage({
        format: "production-decision",
        objective:
          "Defend segment-aware evaluation and a reversible model-threshold rollout under delayed feedback.",
        dependency:
          "Promotion must preserve the frozen feature and policy contracts and keep the previous decision route available.",
        topicKeys: ["online-ml-serving", "model-rollout"],
        prompt:
          "Decide whether the candidate fraud model is ready for a canary. Define leakage-safe offline and online gates, segment safety, monitoring before labels mature, privacy and cost controls, one routing owner, and rollback triggers.",
        artifact: {
          key: "fraud-model-rollout-proposal",
          kind: "config",
          title: "Proposed model promotion",
          content:
            "On a time-split holdout, aggregate precision improves by 3 percentage points but recall falls by 8 points for a high-risk merchant segment. The current route sends 7,800 cases/day to human review; shadow scoring projects a 20% increase to 9,360/day against an 8,000/day capacity. Proposal A replaces the alias and threshold globally. Proposal B pins model-feature-policy versions, shadows first, canaries merchants, and retains the old route. Labels will not mature for at least a week.",
          caption:
            "Aggregate precision alone cannot justify rollout when recall, segment harm, and delayed outcomes matter."
        },
        hints: [
          "Use point-in-time offline evaluation, shadow disagreement analysis, and proxy guardrails before mature labels arrive.",
          "Set merchant and protected-segment stop thresholds for false positives, review volume, latency, and feature missingness.",
          "Rollback must restore the compatible model, feature definitions, and policy threshold together."
        ],
        referenceAnswer: {
          summary:
            "Choose a versioned shadow-and-canary rollout with segment-specific harm gates, delayed-label follow-up, and joint model-feature-policy rollback.",
          explanation:
            "Do not canary this candidate yet: the high-risk segment's eight-point recall loss and projected 9,360 daily reviews exceed the 8,000-case capacity by 1,360, despite better aggregate precision. Evaluate on leakage-safe time splits with calibration, fraud loss, false-positive cost, recall, and merchant/protected-segment slices. Shadow comparable live traffic to measure score and action disagreement without changing decisions. Only after segment and capacity gates pass, canary selected merchants with one routing authority and stop thresholds for decision mix, review load, missing features, latency, and early chargeback signals. Retain a holdout/control and re-evaluate cohorts after labels mature before broad promotion. Scope sensitive payment traces and retention; track feature, inference, and reviewer cost per useful decision. Pin model, feature, threshold, and policy versions and rehearse joint rollback."
        },
        rubric: [
          {
            criterion:
              "Measures delayed-label and segment-aware quality alongside operational SLOs.",
            points: 2,
            dimensionKeys: ["observability-slos"]
          },
          {
            criterion: "Scopes sensitive decision and feature evidence with auditable retention.",
            points: 2,
            dimensionKeys: ["security-privacy"]
          },
          {
            criterion: "Budgets inference, feature storage, and human-review costs.",
            points: 2,
            dimensionKeys: ["cost-efficiency"]
          },
          {
            criterion: "Explains precision, recall, latency, and review-capacity trade-offs.",
            points: 2,
            dimensionKeys: ["tradeoff-communication"]
          },
          {
            criterion: "Canaries and rolls back compatible model-feature-policy versions.",
            points: 2,
            dimensionKeys: ["migration-evolution"]
          }
        ],
        commonMistakes: [
          "Promoting on aggregate precision before delayed labels mature can conceal a harmful segment-level recall regression."
        ],
        interviewerFollowUps: [
          "What early signal would stop the canary before enough chargeback labels arrive?"
        ],
        transferConnection:
          "Shadow scoring and delayed-label holdouts also matter in trust, safety, and recommendation ranking."
      })
    ]
  })
]);
