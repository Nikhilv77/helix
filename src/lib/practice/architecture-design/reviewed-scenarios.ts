import {
  ARCHITECTURE_DESIGN_STAGES,
  architectureDesignDimensionSchema,
  type ArchitectureDesignDifficulty,
  type ArchitectureDesignQuestionFormat
} from "./contracts";
import type { ArchitectureDesignQuestion } from "./question-contracts";
import {
  ARCHITECTURE_DESIGN_CONTENT_AUDIT_VERSION,
  ARCHITECTURE_DESIGN_REVIEW_ARTIFACT_VERSION,
  architectureDesignReviewArtifactSchema,
  type ArchitectureDesignReviewArtifact
} from "./review-artifact-contracts";

type QuestionSeed = {
  format: ArchitectureDesignQuestionFormat;
  objective: string;
  dependency: string;
  topicKeys: string[];
  prompt: string;
  artifact: ArchitectureDesignQuestion["artifact"];
  choices?: string[];
  correctChoiceIndex?: number;
  hints: [string, string, string];
  referenceAnswer: ArchitectureDesignQuestion["referenceAnswer"];
  rubric: ArchitectureDesignQuestion["rubric"];
  commonMistakes: string[];
  interviewerFollowUps: string[];
  transferConnection: string;
};

type ScenarioSeed = {
  key: string;
  title: string;
  premise: string;
  candidateRole: string;
  functionalRequirements: string[];
  nonGoals: string[];
  constraints: string[];
  scaleProfile: string[];
  difficulties: ArchitectureDesignDifficulty[];
  primaryTopicKey: string;
  secondaryTopicKeys: string[];
  targetKeywords: string[];
  realismAnchors: string[];
  targetFitExplanation: string;
  coverageExplanation: string;
  questions: [QuestionSeed, QuestionSeed, QuestionSeed, QuestionSeed];
};

function candidateArtifact(seed: ScenarioSeed): ArchitectureDesignReviewArtifact {
  const questions = seed.questions.map((question, index) =>
    questionFrom(seed.key, index, question)
  );
  return architectureDesignReviewArtifactSchema.parse({
    artifactVersion: ARCHITECTURE_DESIGN_REVIEW_ARTIFACT_VERSION,
    auditVersion: ARCHITECTURE_DESIGN_CONTENT_AUDIT_VERSION,
    caseKey: seed.key,
    authoredAt: "2026-09-08T06:30:00.000Z",
    authoring: {
      mode: "ai-assisted",
      provider: "openai",
      model: "codex",
      promptVersion: "architecture-design-reviewed-content-v1"
    },
    scenario: {
      schemaVersion: 1,
      key: seed.key,
      title: seed.title,
      premise: seed.premise,
      candidateRole: seed.candidateRole,
      functionalRequirements: seed.functionalRequirements,
      nonGoals: seed.nonGoals,
      constraints: seed.constraints,
      scaleProfile: seed.scaleProfile,
      roles: ["backend", "fullstack"],
      seniorities: ["junior", "mid", "senior"],
      difficulties: seed.difficulties,
      primaryTopicKey: seed.primaryTopicKey,
      secondaryTopicKeys: seed.secondaryTopicKeys,
      dimensionKeys: [...architectureDesignDimensionSchema.options],
      targetKeywords: seed.targetKeywords,
      expectedMinutes: 45,
      realismAnchors: seed.realismAnchors,
      targetFitExplanation: seed.targetFitExplanation,
      coverageExplanation: seed.coverageExplanation,
      stages: seed.questions.map((question, index) => {
        const stage = ARCHITECTURE_DESIGN_STAGES[index]!;
        return {
          order: stage.order,
          key: stage.key,
          title: stage.title,
          format: question.format,
          objective: question.objective,
          artifactKey: question.artifact.key,
          dimensionKeys: [...stage.dimensionKeys],
          scenarioDependency: question.dependency
        };
      })
    },
    questionBlock: { schemaVersion: 1, scenarioKey: seed.key, questions },
    humanReview: {
      status: "approved",
      reviewerId: "project-owner",
      reviewedAt: "2026-09-08",
      notes: [
        "Project owner approved this AI-assisted scenario after its schema, coherence, coverage, and privacy audits passed."
      ]
    }
  });
}

function questionFrom(
  scenarioKey: string,
  index: number,
  seed: QuestionSeed
): ArchitectureDesignQuestion {
  const stage = ARCHITECTURE_DESIGN_STAGES[index]!;
  return {
    schemaVersion: 1,
    key: `${scenarioKey}-${stage.key}`,
    scenarioKey,
    stageKey: stage.key,
    order: stage.order,
    format: seed.format,
    topicKeys: seed.topicKeys,
    dimensionKeys: [...stage.dimensionKeys],
    prompt: seed.prompt,
    artifact: seed.artifact,
    choices: seed.choices,
    hints: seed.hints,
    referenceAnswer: seed.referenceAnswer,
    correctChoiceIndex: seed.correctChoiceIndex,
    rubric: seed.rubric,
    commonMistakes: seed.commonMistakes,
    interviewerFollowUps: seed.interviewerFollowUps,
    transferConnection: seed.transferConnection
  };
}

export const MULTI_TENANT_WEBHOOK_DELIVERY = candidateArtifact({
  key: "multi-tenant-webhook-delivery",
  title: "Multi-tenant webhook delivery platform",
  premise:
    "Design a platform that accepts product events and reliably delivers signed webhooks to customer-managed endpoints for thousands of tenants.",
  candidateRole:
    "You own the backend design from subscription contracts through durable delivery, tenant isolation, operability, and safe evolution.",
  functionalRequirements: [
    "Tenants can register endpoints, rotate signing secrets, and subscribe each endpoint to selected event types.",
    "Producers submit events once and tenants can inspect every delivery attempt and replay a failed event.",
    "Deliveries retry transient failures while preserving a stable event identity for customer deduplication."
  ],
  nonGoals: [
    "Executing customer-authored transformation code and guaranteeing exactly-once effects inside customer systems are out of scope."
  ],
  constraints: [
    "A slow or failing tenant endpoint must not consume capacity reserved for healthy tenants.",
    "Payloads may contain customer data, so every read, replay, log, and secret operation must be tenant scoped.",
    "The system offers at-least-once delivery and must keep immutable attempt history for thirty days."
  ],
  scaleProfile: [
    "Steady ingress is 8,000 events per second with 50,000 events per second for ten-minute peaks.",
    "Each event fans out to six subscriptions on average and up to 2,000 for a large tenant.",
    "Ninety-five percent of healthy first attempts should begin within ten seconds of event acceptance."
  ],
  difficulties: ["guided", "standard", "stretch"],
  primaryTopicKey: "webhook-delivery",
  secondaryTopicKeys: ["multi-tenancy", "event-platforms", "retry-systems"],
  targetKeywords: ["backend", "webhooks", "queues", "idempotency", "multi-tenancy"],
  realismAnchors: [
    "Customer endpoints have independent latency, availability, and quota characteristics.",
    "One celebrity-style event can create a large tenant-specific fan-out hotspot.",
    "Retries increase exactly when downstream capacity is least healthy, creating amplification risk.",
    "Replay and secret rotation must work without weakening tenant authorization boundaries."
  ],
  targetFitExplanation:
    "The scenario exercises APIs, durable asynchronous processing, data access patterns, isolation, and operational trade-offs expected of backend and full-stack engineers.",
  coverageExplanation:
    "Four connected decisions compress the full design interview arc while the private rubrics retain explicit coverage of all sixteen Architecture dimensions.",
  questions: [
    {
      format: "written",
      objective:
        "Frame the user-visible scope, quantify fan-out and storage, and turn ambiguous reliability language into measurable targets.",
      dependency:
        "The accepted scope and estimates become the fixed load and correctness assumptions used by every later design decision.",
      topicKeys: ["webhook-delivery", "capacity-planning"],
      prompt:
        "Clarify the first-release requirements and non-goals, then estimate peak delivery attempts per second and 30-day attempt-history volume. State two SLOs and the assumptions behind your numbers.",
      artifact: {
        key: "webhook-requirements-scale-brief",
        kind: "metrics",
        title: "Product and traffic brief",
        content:
          "Ingress: 8,000 events/s steady, 50,000 events/s peak. Average fan-out: 6 endpoints/event; largest observed fan-out: 2,000. Average signed payload plus metadata: 4 KiB. Attempt history retained for 30 days. Product asks for 'fast and reliable delivery' but has not yet defined availability, latency percentile, or replay limits.",
        caption:
          "Peak fan-out and retry amplification must be stated separately from event ingress."
      },
      hints: [
        "Separate accepted event ingestion from downstream delivery because customer endpoints are outside this platform's availability boundary.",
        "Start peak attempts with 50,000 events/s × 6 subscriptions before adding an explicit retry-amplification assumption.",
        "Express latency and availability with a percentile, time window, and the conditions under which an endpoint counts as healthy."
      ],
      referenceAnswer: {
        summary:
          "Scope durable at-least-once delivery and history, estimate roughly 300,000 first attempts per peak second, and define measurable ingestion and healthy-endpoint delivery SLOs.",
        explanation:
          "The first release owns endpoint registration, subscriptions, event acceptance, signed at-least-once attempts, status, and bounded replay; it does not own exactly-once customer effects. Peak first attempts are 50,000 × 6 = 300,000/s before retry headroom. At 4 KiB, one attempt per subscription alone is about 106 TiB/day at peak if sustained, so planning must distinguish short peak, steady volume, compression, metadata indexes, and archival tiers. Useful targets include 99.99% accepted-ingress availability and p95 delivery start under ten seconds for endpoints meeting a declared health contract."
      },
      rubric: [
        {
          criterion:
            "Defines functional scope, actors, correctness boundary, and explicit non-goals.",
          points: 5,
          dimensionKeys: ["requirements-framing"]
        },
        {
          criterion: "Shows fan-out and storage arithmetic with assumptions and measurable SLOs.",
          points: 5,
          dimensionKeys: ["capacity-estimation"]
        }
      ],
      commonMistakes: [
        "Treating 50,000 incoming events as 50,000 deliveries ignores average fan-out and retry amplification.",
        "Promising exactly-once effects inside an external customer system claims control the platform does not have."
      ],
      interviewerFollowUps: [
        "How would the estimates change if the largest tenant's fan-out occurred during the global peak?",
        "Which SLO would you relax first for a manually requested replay?"
      ],
      transferConnection:
        "The same separation of ingestion guarantees from downstream outcomes applies to payments, email providers, and asynchronous partner integrations."
    },
    {
      format: "production-decision",
      objective:
        "Choose stable API, event, and storage contracts that support deduplication, secret rotation, queryable status, and safe retries.",
      dependency:
        "The contracts must preserve the event identity and tenant boundary established in stage one before components or queues are selected.",
      topicKeys: ["webhook-delivery", "event-contracts", "delivery-state"],
      prompt:
        "Review the proposed contract and data model. Identify the correctness gaps, then propose the API/event identities, core records, access keys, and consistency boundary you would ship.",
      artifact: {
        key: "webhook-contract-data-draft",
        kind: "config",
        title: "Proposed delivery contract",
        content:
          "POST /events { tenantId, eventType, payload } -> 202\nqueue message { payload, endpointUrl }\ndelivery_attempt(id, event_type, endpoint_url, status, created_at)\nsubscription(tenant_id, event_type, endpoint_url, secret)\n\nThe API generates a new event ID on every retry. Workers query subscriptions at execution time, sign with the current secret, and overwrite one status row per endpoint. No tenant key is required by the attempt-history query.",
        caption:
          "The proposal loses stable operation identity and the historical configuration used by each attempt."
      },
      hints: [
        "Give producer retries one stable ingestion identity and give each event–subscription delivery its own stable identity.",
        "A replay must know the payload version, endpoint, subscription, and signing-key version originally selected without exposing the secret.",
        "Use tenant-leading access keys and a transaction or outbox boundary that cannot commit the accepted event without its dispatch intent."
      ],
      referenceAnswer: {
        summary:
          "Use tenant-scoped stable event and delivery IDs, immutable payload/config references, an outbox boundary, and append-only attempt records with a separate delivery state machine.",
        explanation:
          "POST /tenants/{tenant}/events accepts a producer idempotency key and returns a stable event ID. Persist the event and outbox dispatch atomically. Freeze matching subscription/version IDs when expanding fan-out. A delivery key such as tenant+event+subscription identifies one logical delivery while attempt rows append try number, timestamps, response class, and bounded diagnostics. Current delivery state is updated conditionally; history and replay queries lead with tenant ID. Store a signing-key version reference and retrieve key material only at the signing boundary."
      },
      rubric: [
        {
          criterion:
            "Defines tenant-scoped event, subscription, delivery, and retry identities with idempotent API semantics.",
          points: 3,
          dimensionKeys: ["api-event-contracts"]
        },
        {
          criterion:
            "Chooses records and tenant-leading access paths that preserve payload, configuration, and attempt history.",
          points: 4,
          dimensionKeys: ["data-modeling", "storage-access-patterns"]
        },
        {
          criterion:
            "Uses an atomic event/outbox boundary and conditional state transitions for correctness.",
          points: 3,
          dimensionKeys: ["consistency-transactions"]
        }
      ],
      commonMistakes: [
        "Putting mutable endpoint URLs and raw secrets in queue messages makes replay, rotation, and audit semantics unsafe.",
        "One overwritten status row cannot explain retries or support trustworthy delivery history."
      ],
      interviewerFollowUps: [
        "What response should a producer receive when it reuses an idempotency key with a different payload?",
        "How do you prevent two workers from both advancing the same delivery state?"
      ],
      transferConnection:
        "Stable logical-operation identity plus append-only attempts is reusable for payment calls, exports, and other retrying side effects."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design the end-to-end asynchronous flow and diagnose tenant hotspots, retry amplification, backpressure, and failure-isolation boundaries.",
      dependency:
        "The flow consumes the frozen event, subscription, delivery, and attempt identities defined in the contract stage.",
      topicKeys: ["webhook-delivery", "queue-topology", "failure-isolation"],
      prompt:
        "Use the trace and metrics to explain the failure cascade. Propose component and queue boundaries, partitioning, admission control, retry scheduling, and caching that preserve healthy-tenant delivery.",
      artifact: {
        key: "webhook-hot-tenant-trace",
        kind: "trace",
        title: "Peak failure trace",
        content:
          "event-ingest -> subscriptions-cache -> one global deliveries queue partitioned by tenant_id -> 400 workers -> customer endpoints\n\n12:00 healthy delivery p95=4s, queue depth=0.8M, retry share=8%\n12:03 tenant=t-big endpoint returns 429; its 2,000-way event burst begins\n12:05 queue depth=11M, retry share=71%, partition t-big lag=9m\n12:08 global worker utilization=100%, healthy-tenant p95=14m\nRetry policy: immediate retries at 1s, 2s, 4s with no per-tenant concurrency limit. Subscription cache key is event_type and omits tenant_id.",
        caption:
          "A tenant hotspot and unsafe cache key combine with immediate retries in shared capacity."
      },
      hints: [
        "Name both correctness and capacity failures: the cache key can cross tenant boundaries while one partition and worker pool share blast radius.",
        "Separate scheduled retries from ready first attempts and enforce per-tenant and per-endpoint admission/concurrency budgets.",
        "Consider a sharded delivery key, delayed retry scheduler, dead-letter path, fair queues, circuit breaking, and queue-age-based autoscaling."
      ],
      referenceAnswer: {
        summary:
          "Fix the tenant-scoped cache, shard hot-tenant delivery work, isolate retry scheduling, and enforce fair bounded concurrency before shared workers call endpoints.",
        explanation:
          "Ingestion persists and emits fan-out work; a fan-out service resolves frozen subscription versions and creates logical deliveries. Ready work is partitioned by a distribution key that can shard a large tenant while preserving only the ordering actually required. A delayed scheduler releases exponential-backoff retries with jitter into separate capacity. Per-tenant and per-endpoint token buckets, concurrency caps, circuit breakers, and weighted-fair admission protect healthy tenants. Workers append attempts and conditionally update state. Tenant-aware caches never key solely by event type. Queue age, oldest healthy-tenant age, retry ratio, and endpoint outcomes drive autoscaling and isolation alarms."
      },
      rubric: [
        {
          criterion:
            "Defines coherent ingestion, fan-out, scheduling, worker, and state-update component boundaries.",
          points: 2,
          dimensionKeys: ["component-boundaries"]
        },
        {
          criterion:
            "Corrects cache scoping and designs bounded first-attempt and retry flow with backpressure.",
          points: 3,
          dimensionKeys: ["caching-contention", "async-work-backpressure"]
        },
        {
          criterion:
            "Handles hot partitions and isolates tenant, endpoint, and retry failures from healthy traffic.",
          points: 5,
          dimensionKeys: ["partitioning-hotspots", "reliability-failure-isolation"]
        }
      ],
      commonMistakes: [
        "Adding workers without fair admission allows retry traffic from one endpoint to consume the new capacity too.",
        "Partitioning only by tenant preserves the largest tenant as one unavoidable hot partition."
      ],
      interviewerFollowUps: [
        "Which ordering guarantee would you offer, and how does it constrain the partition key?",
        "What happens when the delayed-retry store is unavailable for ten minutes?"
      ],
      transferConnection:
        "Fair admission and delayed retry isolation generalize to crawlers, notification providers, and multi-tenant background-job platforms."
    },
    {
      format: "production-decision",
      objective:
        "Defend reliability, observability, privacy, cost, and a reversible migration from the unsafe design.",
      dependency:
        "The rollout must preserve the public contracts and component boundaries chosen in the previous stages.",
      topicKeys: ["webhook-delivery", "operability", "safe-migration"],
      prompt:
        "Choose a production plan for the design. Cover SLO instrumentation, tenant security and secret handling, retention cost, regional recovery, and a reversible migration that avoids duplicate or lost deliveries.",
      artifact: {
        key: "webhook-rollout-options",
        kind: "config",
        title: "Migration options",
        content:
          "A: Stop old workers, rewrite all pending rows, then start the new queue globally.\nB: Dual-write old and new queues and let both worker fleets deliver.\nC: Add stable delivery IDs and shadow new dispatch decisions, backfill immutable state, canary tenants to one active delivery path, compare invariants, then expand with a routing kill switch.\n\nCurrent telemetry stores full payloads and signing headers for 90 days in a shared log index. One region owns queue and delivery state; backups exist but restore and failover are untested.",
        caption:
          "The rollout must prevent two active delivery authorities and reduce sensitive telemetry."
      },
      hints: [
        "A safe migration may dual-write observations, but it must keep exactly one active authority for external delivery side effects.",
        "Use payload references, redacted structured fields, scoped access, key-version audit, and separate retention tiers instead of raw shared logs.",
        "Define canary invariants, SLO/error-budget gates, replay reconciliation, tested recovery objectives, and a routing rollback switch."
      ],
      referenceAnswer: {
        summary:
          "Choose shadow-and-canary migration with one delivery authority, redacted tenant-scoped telemetry, tiered retention, and tested regional recovery guarded by SLOs and invariants.",
        explanation:
          "Option C separates comparison from side effects. Introduce stable IDs and compatible schemas, shadow dispatch decisions, backfill history, then route canary tenants exclusively to the new path. Compare accepted-to-dispatched conservation, duplicate logical deliveries, queue age, healthy-endpoint success and latency, retry amplification, and tenant fairness. A kill switch returns routing to the old authority. Logs contain IDs, classifications, latency, and bounded redacted diagnostics—not payloads or signing headers—and use tenant-scoped access and short hot retention with cheaper archive. Encrypt secrets, rotate versioned keys, and audit use. Define and test RPO/RTO, replicated state, and regional failover before claiming multi-region availability."
      },
      rubric: [
        {
          criterion: "Defines user-facing SLOs, invariant telemetry, and tested failure recovery.",
          points: 3,
          dimensionKeys: ["observability-slos"]
        },
        {
          criterion:
            "Protects tenant data and signing material while choosing cost-aware retention and capacity.",
          points: 3,
          dimensionKeys: ["security-privacy", "cost-efficiency"]
        },
        {
          criterion:
            "Compares alternatives and gives a compatible, canary, single-authority migration with rollback.",
          points: 4,
          dimensionKeys: ["tradeoff-communication", "migration-evolution"]
        }
      ],
      commonMistakes: [
        "Letting old and new workers both deliver during dual-write testing creates the duplicate side effects the migration must prevent.",
        "Calling backups a recovery plan without measured restore and failover tests does not support an availability claim."
      ],
      interviewerFollowUps: [
        "Which single invariant would automatically stop the canary?",
        "How would you prove that a rollback cannot strand deliveries created only in the new schema?"
      ],
      transferConnection:
        "Single-authority canaries and invariant-based rollback are broadly useful when migrating any externally visible asynchronous side effect."
    }
  ]
});

export const HIGH_VOLUME_NOTIFICATION_PLATFORM = candidateArtifact({
  key: "high-volume-notification-platform",
  title: "High-volume notification platform",
  premise:
    "Design a multi-channel notification platform for transactional and product messages across email, push, and SMS providers.",
  candidateRole:
    "You own the platform boundaries for preferences, templates, scheduling, fan-out, provider delivery, regional resilience, and cost control.",
  functionalRequirements: [
    "Products submit transactional or campaign notifications using versioned templates and recipient data.",
    "Users control channel and topic preferences, quiet hours, locale, and mandatory transactional exceptions.",
    "Products can schedule sends and query recipient-level state without exposing another product's data."
  ],
  nonGoals: [
    "Building the upstream marketing audience-selection engine or guaranteeing that a provider places a message in a human inbox is out of scope."
  ],
  constraints: [
    "Transactional password-reset messages cannot wait behind bulk campaigns.",
    "A provider outage must degrade one channel without duplicating sends or blocking all channels.",
    "Consent, unsubscribe, quiet-hour, and regional data rules must be enforced from authoritative versions."
  ],
  scaleProfile: [
    "Normal volume is 12 million recipient notifications per day with a 120 million-recipient campaign once per week.",
    "Campaign launch produces 900,000 recipient-channel jobs per second for five minutes if admitted without shaping.",
    "Transactional messages target p95 provider acceptance under five seconds and 99.99% monthly platform availability."
  ],
  difficulties: ["guided", "standard", "stretch"],
  primaryTopicKey: "notification-platform",
  secondaryTopicKeys: ["preference-enforcement", "provider-routing", "campaign-fanout"],
  targetKeywords: ["backend", "notifications", "fan-out", "preferences", "regional reliability"],
  realismAnchors: [
    "Preferences can change between campaign creation, scheduling, and actual delivery.",
    "Provider acceptance is not the same as end-user delivery or engagement.",
    "Bulk fan-out can overwhelm shared queues before provider calls begin.",
    "SMS cost and regional consent rules make routing more than a latency decision."
  ],
  targetFitExplanation:
    "Notification systems expose common interview trade-offs across fan-out, data freshness, priority isolation, third-party reliability, privacy, and cost.",
  coverageExplanation:
    "The four-question MVP follows one notification from scoped requirements through contracts, data, flow, failure handling, and a defensible regional rollout.",
  questions: [
    {
      format: "mcq",
      objective:
        "Choose a scope and capacity posture that protects transactional latency from unbounded campaign fan-out.",
      dependency:
        "This sets the priority classes and admission assumptions used by the contract, queue, and rollout decisions.",
      topicKeys: ["notification-platform", "capacity-planning"],
      prompt:
        "Which first-release requirement and capacity decision best fits the supplied workload while preserving the transactional SLO?",
      artifact: {
        key: "notification-workload-brief",
        kind: "metrics",
        title: "Notification workload and goals",
        content:
          "Normal: 12M recipient notifications/day. Weekly campaign: 120M recipients. Unshaped campaign fan-out: 900k recipient-channel jobs/s for 5 minutes. Password resets: 2k/s peak, p95 provider acceptance <5s. Product request: 'launch campaigns immediately and never delay any message.' Shared provider quotas: email 250k/s, push 400k/s, SMS 25k/s.",
        caption:
          "Requested fan-out can exceed provider quota while a small transactional class has a strict latency target."
      },
      choices: [
        "Define transactional and bulk priority classes, admit campaigns at bounded rates below channel quotas, and expose separate latency/completion SLOs",
        "Put every message in one FIFO queue so campaign launch order is preserved globally",
        "Accept 900,000 jobs per second and rely on providers to discard any excess traffic",
        "Promise five-second end-user delivery for every channel because provider acceptance is measurable"
      ],
      correctChoiceIndex: 0,
      hints: [
        "Separate platform-to-provider acceptance from the provider's end-user outcome and separate latency-sensitive from bulk work.",
        "The unshaped campaign rate is larger than at least two channel quotas before retries are considered.",
        "The sound contract uses bounded admission and distinct SLOs rather than one global FIFO or an outcome the platform cannot control."
      ],
      referenceAnswer: {
        summary:
          "Use explicit transactional and bulk classes, shape campaigns to channel capacity, and define separate acceptance-latency and campaign-completion SLOs.",
        explanation:
          "The first choice frames controllable requirements: durable acceptance, preference enforcement, bounded scheduling, queryable state, and provider submission. Transactional queues reserve capacity for the 2k/s password-reset peak and p95 under five seconds. Campaign admission is shaped below quotas with retry headroom, and its SLO is completion over a declared window. Provider acceptance, delivery receipts, and engagement remain distinct states."
      },
      rubric: [
        {
          criterion:
            "Chooses bounded functional scope, priority semantics, and controllable delivery terminology.",
          points: 5,
          dimensionKeys: ["requirements-framing"]
        },
        {
          criterion:
            "Uses the supplied rates and quotas to reserve capacity and shape campaign fan-out.",
          points: 5,
          dimensionKeys: ["capacity-estimation"]
        }
      ],
      commonMistakes: [
        "Conflating provider acceptance with human delivery produces an SLO the platform cannot measure or guarantee.",
        "One FIFO queue allows a weekly campaign to violate a small but critical transactional latency class."
      ],
      interviewerFollowUps: [
        "How would you calculate a campaign completion estimate before accepting its schedule?",
        "What capacity would you reserve for retries during a partial provider outage?"
      ],
      transferConnection:
        "Priority classes and bounded admission apply to any platform mixing interactive work with large background batches."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Correct preference, template, deduplication, and recipient-state contracts with access paths that remain valid at send time.",
      dependency:
        "The records must preserve the priority and delivery-state distinctions established in the workload stage.",
      topicKeys: ["notification-platform", "preference-enforcement", "delivery-state"],
      prompt:
        "Diagnose the proposed schema and send contract. Redesign the stable identities, preference/template versioning, recipient state, and consistency boundaries needed for safe scheduling and retries.",
      artifact: {
        key: "notification-contract-schema",
        kind: "config",
        title: "Proposed notification records",
        content:
          "POST /send { userId, templateName, channels[] } -> 200\nnotification(id, user_id, template_name, status)\npreference(user_id, email_enabled, push_enabled, sms_enabled)\ntemplate(name, subject, body)\n\nScheduler copies current preference booleans into an in-memory job. A retry creates a new notification ID. Provider callbacks update status by user_id. Campaign recipient rows are deleted after submission.",
        caption:
          "Mutable names, retry identity, callback correlation, and consent timing are not defined."
      },
      hints: [
        "Separate a logical notification request from recipient-channel deliveries and provider attempts; each needs a stable correlation identity.",
        "Keep versioned templates and auditable preference/consent facts, then define whether policy is frozen at schedule time or rechecked at send time.",
        "Use product/tenant-leading access paths, an outbox for committed dispatch intent, and conditional recipient-channel state transitions."
      ],
      referenceAnswer: {
        summary:
          "Model stable request, recipient-channel delivery, and attempt identities; version templates and policy; recheck authoritative consent at send time; and correlate callbacks to attempts.",
        explanation:
          "The API accepts a product-scoped idempotency key and returns a stable request ID. Persist request, immutable template version, schedule, priority, and dispatch intent atomically. Expand recipients into stable delivery IDs keyed by product+request+recipient+channel; attempts append provider, provider message ID, timestamps, and result. Provider callbacks resolve the attempt rather than all rows for a user. Preference records retain topic/channel, locale, quiet-hour zone, consent source/version, and update time. Mandatory exceptions are explicit policy, and scheduled sends re-evaluate authoritative policy before release. Recipient state is retained for audit and queries with bounded archival."
      },
      rubric: [
        {
          criterion:
            "Defines idempotent request, recipient delivery, attempt, and callback contracts.",
          points: 3,
          dimensionKeys: ["api-event-contracts"]
        },
        {
          criterion:
            "Models versioned templates, consent/preferences, and append-only recipient-channel attempts with appropriate access paths.",
          points: 4,
          dimensionKeys: ["data-modeling", "storage-access-patterns"]
        },
        {
          criterion:
            "Uses atomic dispatch intent and conditional state transitions while defining send-time policy consistency.",
          points: 3,
          dimensionKeys: ["consistency-transactions"]
        }
      ],
      commonMistakes: [
        "Freezing mutable consent only at campaign creation can send messages after a user unsubscribes.",
        "Updating callbacks by user ID can corrupt many concurrent notifications for the same recipient."
      ],
      interviewerFollowUps: [
        "How would you handle a transactional message legally exempt from one marketing preference?",
        "Which data would you retain after payload deletion to investigate a complaint?"
      ],
      transferConnection:
        "Logical request, delivery, and attempt records are a reusable model for shipments, exports, and multi-provider external calls."
    },
    {
      format: "written",
      objective:
        "Build an end-to-end flow that isolates priority classes, shapes fan-out, routes providers, and survives regional or provider failure.",
      dependency:
        "Components must consume the immutable template and stable recipient-channel identities from the contract stage.",
      topicKeys: ["notification-platform", "campaign-fanout", "provider-routing"],
      prompt:
        "Describe the components and request/data flow from accepted request to recipient state. Include cache boundaries, queue topology, hot partitions, backpressure, deduplication, provider fallback, and regional failure.",
      artifact: {
        key: "notification-flow-failure-snapshot",
        kind: "trace",
        title: "Current shared delivery flow",
        content:
          "send-api -> one fanout worker -> one queue partitioned by campaign_id -> shared channel workers -> provider\n\nCampaign c-90: 120M recipients; partition lag=7h; worker batch retry=entire 10k batch on one timeout. Password-reset queue age=18m because it shares workers. Preference cache TTL=24h keyed by user_id only. Email provider A returns 503; router immediately retries A three times, then sends through B without a cross-provider dedupe key. Region failover starts consumers in region B while region A leases remain valid for 20m.",
        caption:
          "Shared capacity, coarse retries, stale cache scope, and two active regions can all duplicate or delay work."
      },
      hints: [
        "Give transactional, scheduled, and bulk work separate admission and reserved capacity while retaining a common state model.",
        "Shard large campaigns beyond campaign ID, checkpoint fan-out pages, retry individual deliveries, and use provider-aware circuit breakers and quotas.",
        "Make preference caches product/topic/channel aware with invalidation, and fence regional consumers so only one lease epoch can commit a delivery transition."
      ],
      referenceAnswer: {
        summary:
          "Use durable request/outbox ingestion, paged sharded fan-out, priority-isolated queues, fenced delivery workers, and policy/provider adapters with bounded fallback.",
        explanation:
          "The send API persists the request and outbox. A scheduler releases due requests. Fan-out workers page recipients, checkpoint shards, re-evaluate policy, render an immutable template version, and create recipient-channel deliveries. Separate priority queues or weighted admission reserve transactional capacity; campaign shards distribute by recipient hash rather than one campaign partition. Channel workers claim deliveries with fenced leases, append attempts, and use provider adapters with token buckets, circuit breakers, exponential backoff, and stable cross-provider dedupe metadata. Preference/template caches use complete product/topic/locale/version keys and targeted invalidation. Regional failover advances a lease epoch so stale workers cannot commit. Dead-letter and reconciliation paths retain bounded failed work."
      },
      rubric: [
        {
          criterion:
            "Defines coherent API, scheduler, fan-out, policy, rendering, queue, worker, provider, and state boundaries.",
          points: 2,
          dimensionKeys: ["component-boundaries"]
        },
        {
          criterion:
            "Uses correctly scoped caches, priority admission, checkpointing, and bounded individual-delivery retries.",
          points: 3,
          dimensionKeys: ["caching-contention", "async-work-backpressure"]
        },
        {
          criterion:
            "Shards campaign hotspots and isolates provider, priority, tenant, and regional failure with fenced ownership.",
          points: 5,
          dimensionKeys: ["partitioning-hotspots", "reliability-failure-isolation"]
        }
      ],
      commonMistakes: [
        "Partitioning solely by campaign ID turns the largest campaign into one permanently hot partition.",
        "Cross-provider fallback without a shared logical delivery identity can send the same message twice."
      ],
      interviewerFollowUps: [
        "How do you preserve per-user ordering without serializing an entire campaign?",
        "What state must be replicated before region B may take ownership?"
      ],
      transferConnection:
        "Sharded fan-out with priority isolation appears in feed generation, indexing, billing, and large export systems."
    },
    {
      format: "production-decision",
      objective:
        "Choose observability, privacy, cost, and rollout controls that make the multi-provider regional design defensible and reversible.",
      dependency:
        "The operating model must validate the stable identities, priority isolation, and fenced ownership established earlier.",
      topicKeys: ["notification-platform", "operability", "safe-migration"],
      prompt:
        "Propose the production-readiness and evolution plan. Define SLOs and invariants, privacy/retention controls, provider and channel cost policy, regional rollout, and rollback criteria.",
      artifact: {
        key: "notification-readiness-options",
        kind: "metrics",
        title: "Readiness review",
        content:
          "Dashboard reports one global 'sent rate' based on provider API 2xx responses. Message bodies, phone numbers, email addresses, and provider credentials appear in searchable logs retained for one year. Router always chooses the lowest-latency provider; SMS spend has grown 4×. Proposed regional launch enables active consumers in both regions for all products on day one. Rollback plan: redeploy the previous application image.",
        caption:
          "The proposal lacks outcome definitions, privacy boundaries, cost policy, and state-compatible rollback."
      },
      hints: [
        "Measure accepted, policy-suppressed, queued, provider-accepted, provider-delivered, failed, and engaged states separately by priority, channel, provider, and region.",
        "Tokenize recipient identifiers, redact content and credentials, scope access, and apply purpose-specific retention while preserving auditable consent and state transitions.",
        "Shadow routing, canary one product/region, fence one active authority, compare invariants and cost/quality guardrails, and retain schema/state compatibility for rollback."
      ],
      referenceAnswer: {
        summary:
          "Adopt state-specific SLOs and invariants, minimized telemetry, policy-aware cost routing, and a fenced shadow/canary regional rollout with compatible rollback.",
        explanation:
          "Transactional SLOs track durable acceptance and p95 provider acceptance; campaign SLOs track completion windows. Invariants reconcile accepted requests through terminal or explicitly pending recipient states and detect duplicate logical deliveries. Slice queue age, suppression, provider outcomes, fallback, callback lag, and cost per successful delivery. Telemetry uses tokens and IDs, never raw credentials or routine bodies, with scoped access and tiered retention. Routing balances consent, residency, health, quality, quota, and channel cost—not latency alone. Shadow region-B decisions first, canary fenced ownership for selected products, test failover/RPO/RTO, then expand. Rollback requires old readers to understand new states and a routing/lease kill switch, not only an old image."
      },
      rubric: [
        {
          criterion:
            "Defines state-specific SLOs, conservation/duplicate invariants, and tested regional recovery signals.",
          points: 3,
          dimensionKeys: ["observability-slos"]
        },
        {
          criterion:
            "Minimizes sensitive telemetry and applies explicit quality, residency, quota, and cost routing policy.",
          points: 3,
          dimensionKeys: ["security-privacy", "cost-efficiency"]
        },
        {
          criterion:
            "Compares rollout alternatives and gives a fenced, compatible canary with measurable rollback gates.",
          points: 4,
          dimensionKeys: ["tradeoff-communication", "migration-evolution"]
        }
      ],
      commonMistakes: [
        "A single sent-rate metric hides suppression, queue delay, provider acceptance, actual delivery, and duplicate outcomes.",
        "Rolling back code without compatible state and fenced consumers can worsen a regional migration failure."
      ],
      interviewerFollowUps: [
        "When would you deliberately choose a more expensive provider?",
        "Which privacy evidence must survive after notification content is deleted?"
      ],
      transferConnection:
        "State-specific SLOs, privacy-minimized telemetry, and fenced regional canaries transfer to most multi-provider workflow systems."
    }
  ]
});

export const ARCHITECTURE_DESIGN_REVIEW_CANDIDATES = Object.freeze([
  MULTI_TENANT_WEBHOOK_DELIVERY,
  HIGH_VOLUME_NOTIFICATION_PLATFORM
]);
