import { reviewedArchitectureDesignArtifact as candidateArtifact } from "./reviewed-scenario-builder";
import { SEARCH_AUTOCOMPLETE_PLATFORM } from "./reviewed-search-scenario";

export { SEARCH_AUTOCOMPLETE_PLATFORM };

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

export const MARKETPLACE_CHECKOUT_INVENTORY = candidateArtifact({
  key: "marketplace-checkout-inventory",
  title: "Marketplace checkout and inventory",
  premise:
    "Design checkout for a multi-seller marketplace that reserves limited stock, authorizes payment, creates an order, and recovers safely when inventory, payment, or fulfillment services fail.",
  candidateRole:
    "You own the backend design from checkout acceptance through inventory reservation, payment authorization, order state, reconciliation, operability, and safe migration.",
  functionalRequirements: [
    "Buyers can submit a multi-item checkout once and receive one stable order outcome despite client, worker, or provider retries.",
    "The platform reserves limited inventory, authorizes payment, and exposes buyer and seller views of order progress.",
    "Operators can reconcile orders, reservations, inventory, and payment attempts after partial failure."
  ],
  nonGoals: [
    "Card-network settlement, warehouse routing, and a globally serializable transaction across external providers are out of scope."
  ],
  constraints: [
    "Flash sales create a small number of extremely hot SKUs that must not corrupt unrelated inventory.",
    "Payment providers can time out and later send callbacks, so timeout does not prove that authorization failed.",
    "Money, order, reservation, and inventory state must remain auditable and reconcilable after retries."
  ],
  scaleProfile: [
    "Normal traffic is 4,000 checkout attempts per second with 40,000 attempts per second during flash-sale peaks.",
    "An order contains four items on average while the hottest SKU can receive 15,000 reservation attempts per second.",
    "Payment authorization has a 1.5-second median, a 12-second tail, and may return an unknown outcome on timeout."
  ],
  difficulties: ["guided", "standard", "stretch"],
  primaryTopicKey: "checkout-workflow",
  secondaryTopicKeys: ["inventory-reservation", "payment-consistency", "reconciliation"],
  targetKeywords: [
    "backend",
    "fullstack",
    "payments",
    "ecommerce",
    "inventory",
    "transactions",
    "idempotency",
    "reconciliation"
  ],
  realismAnchors: [
    "A payment timeout is an unknown outcome because a later provider callback can still confirm authorization.",
    "Flash-sale demand concentrates on a few inventory keys rather than distributing evenly across the catalogue.",
    "Reservation expiry races with payment completion and must use explicit state and time semantics.",
    "Financial and inventory correctness requires reconciliation after retries, not only synchronous request success."
  ],
  targetFitExplanation:
    "Checkout exercises transactional APIs, concurrency control, state-machine design, asynchronous coordination, payment uncertainty, reconciliation, and safe production evolution expected of backend and full-stack engineers.",
  coverageExplanation:
    "Four connected decisions follow one checkout from requirements and load through durable contracts, failure-aware workflow design, operating invariants, and reversible migration while covering all sixteen Architecture dimensions.",
  authoredAt: "2026-09-12T00:00:00.000Z",
  reviewedAt: "2026-09-12",
  questions: [
    {
      format: "written",
      objective:
        "Define the checkout correctness boundary, quantify normal and flash-sale work, and turn oversell and recovery language into measurable guarantees.",
      dependency:
        "The agreed order, reservation, payment, and recovery semantics become fixed constraints for all later contracts and workflow decisions.",
      topicKeys: ["checkout-workflow", "capacity-planning"],
      prompt:
        "Define the first-release checkout boundary and non-goals. Estimate peak checkout, reservation, and inventory-write rates, then state the oversell, latency, availability, and recovery guarantees your design will defend.",
      artifact: {
        key: "checkout-requirements-scale-brief",
        kind: "metrics",
        title: "Checkout and flash-sale brief",
        content:
          "Normal checkout attempts: 4,000/s. Flash-sale peak: 40,000/s for 8 minutes. Average order: 4 distinct items. Hottest SKU: 15,000 reservation attempts/s with 3,000 units available. Payment authorization: median 1.5s, p99 12s, 1% timeout with a possible later callback. Reservation TTL: 10 minutes. Product asks for 'no oversells, exactly-once checkout, and instant confirmation.'",
        caption:
          "The design must separate a stable checkout outcome from provider timing and hot-inventory contention."
      },
      hints: [
        "Separate the buyer-visible checkout request from reservation, payment authorization, order confirmation, and fulfillment outcomes.",
        "Start with 40,000 checkouts/s multiplied by four items, then account for conditional updates, retries, and the 15,000/s hot key separately.",
        "Replace 'exactly once' with stable idempotent identities, explicit unknown payment outcomes, measurable oversell policy, and reconciliation."
      ],
      referenceAnswer: {
        summary:
          "Scope checkout through durable order outcome, plan for roughly 160,000 first reservation operations per peak second, isolate hot SKUs, and promise idempotent processing plus measurable correctness and recovery rather than a cross-provider exactly-once transaction.",
        explanation:
          "The first release accepts one idempotent checkout, validates price and seller terms, reserves each item, requests payment authorization, creates a durable order outcome, releases expired reservations, and exposes buyer and seller state. Fulfillment routing and card settlement remain outside the boundary. Peak first reservation demand is 40,000 × 4 = 160,000 operations/s before retry headroom, while the hottest SKU is a distinct contention problem at 15,000 attempts/s. Useful guarantees include one logical order per idempotency key and matching payload, no inventory decrement below the chosen safety bound, p95 durable checkout decision under five seconds when payment responds, 99.99% acceptance availability, and reconciliation of unknown payment outcomes within a declared window. A payment timeout remains pending or unknown until callback or reconciliation resolves it."
      },
      rubric: [
        {
          criterion:
            "Defines the buyer-visible scope, actors, order/payment correctness boundary, explicit non-goals, and realistic guarantees.",
          points: 5,
          dimensionKeys: ["requirements-framing"]
        },
        {
          criterion:
            "Calculates peak reservation work, treats hot-SKU contention separately, and defines measurable latency, availability, oversell, and recovery targets.",
          points: 5,
          dimensionKeys: ["capacity-estimation"]
        }
      ],
      commonMistakes: [
        "Multiplying only checkout requests and ignoring four inventory operations per order understates peak write demand.",
        "Treating a provider timeout as a failed authorization can charge a buyer after inventory has already been released or retried."
      ],
      interviewerFollowUps: [
        "Which guarantee changes if the business accepts a small bounded oversell rate during a flash sale?",
        "What should the buyer see when payment remains unknown beyond the normal checkout latency target?"
      ],
      transferConnection:
        "Explicit unknown outcomes and stable logical operations also apply to booking, billing, and other workflows that cross an external side-effect boundary."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design idempotent checkout, reservation, order, payment, state-history, and access contracts with explicit local consistency boundaries.",
      dependency:
        "The records must preserve the stable buyer outcome, inventory safety, and unknown-payment semantics established in the requirements stage.",
      topicKeys: ["checkout-workflow", "inventory-reservation", "payment-consistency"],
      prompt:
        "Diagnose the proposed API and records. Redesign the idempotency, order, reservation, inventory, payment-attempt, state-transition, and reconciliation contracts, including indexes and the consistency boundaries you would ship.",
      artifact: {
        key: "checkout-contract-data-draft",
        kind: "config",
        title: "Proposed checkout contract and records",
        content:
          "POST /checkout { buyerId, items[], paymentToken } -> { orderId }\norder(id, buyer_id, total, status, payment_id)\ninventory(sku, available_count)\npayment(order_id, provider_id, status)\n\nEach retry creates a new order ID. The API reads available_count, decrements it in a later statement, commits the order, and then calls the provider. Provider callbacks update every payment row matching buyer_id. A reservation expiry job sets the order to CANCELLED without checking its current version. Buyer history scans orders by created_at; no append-only state or reconciliation record exists.",
        caption:
          "The proposal loses stable request identity and allows races across inventory, payment callbacks, and expiry."
      },
      hints: [
        "Give the checkout request, order, item reservation, logical payment, and each provider attempt separate stable identities.",
        "Protect stock and state changes with conditional versions or unique reservation facts instead of a read followed by an unguarded write.",
        "Commit local state and dispatch intent atomically, correlate callbacks to a provider attempt, and index expiry and reconciliation work explicitly."
      ],
      referenceAnswer: {
        summary:
          "Use a buyer-scoped idempotency contract, stable order and logical-payment IDs, conditional inventory reservations, append-only attempts and transitions, and local outbox boundaries with explicit expiry and reconciliation indexes.",
        explanation:
          "POST /buyers/{buyer}/checkouts accepts an idempotency key and a request fingerprint; replay returns the same checkout/order while a different payload conflicts. The order and line items retain price/catalogue versions. Each order-line reservation has a stable ID, SKU, quantity, state, expiry, and version; inventory is protected by a conditional decrement, atomic counter, or serialized hot-key owner within one storage boundary. A logical payment is separate from append-only provider attempts, each with its provider correlation key and idempotency token. Provider callbacks address one attempt and advance legal states conditionally. Local order/reservation changes commit with an outbox command; external payment is never claimed as part of that database transaction. Append-only state transitions and reconciliation cases explain history. Indexes lead with buyer for history, seller and state for fulfillment, SKU for reservations, expiry bucket for release, and resolution state for reconciliation."
      },
      rubric: [
        {
          criterion:
            "Defines stable idempotent checkout, order, reservation, logical-payment, attempt, callback, and conflict semantics.",
          points: 3,
          dimensionKeys: ["api-event-contracts"]
        },
        {
          criterion:
            "Models versioned order facts, append-only attempts and transitions, and access paths for buyers, sellers, expiry, and reconciliation.",
          points: 4,
          dimensionKeys: ["data-modeling", "storage-access-patterns"]
        },
        {
          criterion:
            "Uses conditional inventory and workflow transitions plus a local atomic state-and-outbox boundary without claiming a distributed transaction.",
          points: 3,
          dimensionKeys: ["consistency-transactions"]
        }
      ],
      commonMistakes: [
        "Using one mutable order status erases the payment, reservation, expiry, and reconciliation history needed to explain failures.",
        "Correlating callbacks by buyer ID can update multiple concurrent orders and payment attempts for the same person."
      ],
      interviewerFollowUps: [
        "What response should the API return when an idempotency key is reused with a changed basket?",
        "How would you query and release millions of expiring reservations without scanning the reservation table?"
      ],
      transferConnection:
        "Stable intent, append-only attempts, and conditional state transitions generalize to reservations, payouts, and external fulfillment workflows."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design the checkout workflow and diagnose duplicate authorization, hot inventory, expiry races, retry amplification, and regional ownership failures.",
      dependency:
        "The flow consumes the frozen checkout, order, reservation, payment-attempt, and transition identities defined in the contract stage.",
      topicKeys: ["checkout-workflow", "inventory-reservation", "reconciliation"],
      prompt:
        "Use the trace and metrics to explain the inconsistent outcomes. Propose component, partition, cache, queue, backpressure, retry, compensation, reconciliation, and regional-ownership boundaries that keep unrelated checkouts healthy.",
      artifact: {
        key: "checkout-failure-trace",
        kind: "trace",
        title: "Flash-sale checkout failure trace",
        content:
          "checkout-api -> inventory cache -> shared checkout queue -> 300 workers -> payment provider\n\n10:00 hot SKU available_count=3,000; cache TTL=60s\n10:01 15,000 buyers read 'available'; database inventory becomes -412 after unguarded decrements\n10:02 provider request p-77 times out; worker retries with a new provider key and receives success\n10:04 original p-77 callback also succeeds; buyer has two authorizations\n10:10 expiry worker marks 8,200 orders CANCELLED without a version check, including 340 paid orders\n10:12 retry traffic is 68% of the shared queue; unrelated checkout p95=46s\nRegion B consumers start while region A leases remain valid for 15 minutes.",
        caption:
          "Stale availability, unguarded transitions, regenerated payment identity, and shared retries create oversells and duplicate charges."
      },
      hints: [
        "A cache can help browsing, but the reservation decision must use an authoritative conditional boundary for the hot SKU.",
        "Keep the same provider idempotency identity across an unknown timeout and let callbacks advance only a legal versioned payment state.",
        "Separate fresh checkout commands, delayed retries, expiry, and reconciliation capacity; fence regional owners before they can commit transitions."
      ],
      referenceAnswer: {
        summary:
          "Use authoritative conditional reservations, one durable workflow owner, stable payment idempotency, isolated delayed retries and reconciliation, hot-key admission, and fenced regional commits.",
        explanation:
          "The checkout API persists one intent and outbox command. A workflow coordinator advances explicit versioned states. Browsing may use cached availability, but reservation uses a conditional database update, atomic per-SKU counter, or partition owner that cannot go below the accepted policy. Hot SKU admission is rate limited and may use a waiting-room token rather than flooding shared workers. The same logical payment and provider idempotency key survive timeouts; a timeout becomes UNKNOWN until callback or a reconciliation poll resolves it. Expiry commands conditionally release only still-reserved orders, while compensation reverses a known earlier step and reconciliation investigates uncertain or mismatched facts. Fresh checkout work, delayed retries, expiry, and reconciliation receive separate queues or fair reserved capacity with exponential backoff and circuit breaking. Region ownership uses epochs or fenced leases so stale workers cannot commit. Invariants and repair jobs compare order, reservation, payment, and inventory facts without blocking the request path."
      },
      rubric: [
        {
          criterion:
            "Defines coherent API, workflow, inventory, payment, expiry, outbox, and reconciliation component boundaries.",
          points: 2,
          dimensionKeys: ["component-boundaries"]
        },
        {
          criterion:
            "Uses browsing caches safely and separates fresh, retry, expiry, and reconciliation work with bounded backpressure.",
          points: 3,
          dimensionKeys: ["caching-contention", "async-work-backpressure"]
        },
        {
          criterion:
            "Protects hot inventory, isolates payment and retry failures, and fences competing regional owners while preserving recoverable state.",
          points: 5,
          dimensionKeys: ["partitioning-hotspots", "reliability-failure-isolation"]
        }
      ],
      commonMistakes: [
        "Making the availability cache strongly consistent does not by itself prevent two reservation writers from consuming the same unit.",
        "Immediately retrying an unknown payment with a new provider key can create a second real authorization rather than recover the first."
      ],
      interviewerFollowUps: [
        "When would you choose a serialized per-SKU owner instead of conditional database updates?",
        "How does the workflow resolve a successful payment callback that arrives after reservation expiry?"
      ],
      transferConnection:
        "Separating compensation from uncertainty reconciliation is essential in booking, billing, shipping, and other multi-step external workflows."
    },
    {
      format: "production-decision",
      objective:
        "Defend reconciliation, observability, payment privacy, regional recovery, cost, and a reversible migration from synchronous checkout.",
      dependency:
        "The production plan must validate the stable identities, conditional transitions, workflow ownership, and recovery paths established earlier.",
      topicKeys: ["checkout-workflow", "payment-consistency", "reconciliation"],
      prompt:
        "Choose a production plan for the checkout design. Define correctness invariants and SLOs, payment and personal-data boundaries, reconciliation and expiry operations, cost signals, regional recovery, and a reversible migration from the current synchronous flow.",
      artifact: {
        key: "checkout-production-readiness",
        kind: "config",
        title: "Checkout migration and telemetry proposal",
        content:
          "Migration A: switch every buyer to the new workflow after one maintenance window.\nMigration B: send each checkout through old and new payment workers and accept the first result.\nMigration C: add stable identities and compatible state first, shadow decisions without external side effects, backfill history, route one buyer cohort to one active workflow authority, compare invariants, then expand behind a kill switch.\n\nCurrent dashboard counts HTTP 200 as successful checkout. Logs retain payment tokens, addresses, and full baskets for one year. Reconciliation runs manually after complaints. Region B has a database replica, but failover and stale-worker fencing have never been tested.",
        caption:
          "A safe launch needs outcome invariants, minimized telemetry, one side-effect authority, and state-compatible rollback."
      },
      hints: [
        "Measure accepted intents through one explainable terminal or explicitly pending state, and reconcile payment, order, reservation, and inventory facts.",
        "Tokenize payment references, redact personal fields and basket contents, scope access, and use purpose-specific retention rather than raw searchable logs.",
        "Shadow decisions but keep one active payment/order authority; canary a cohort with invariant, SLO, recovery, and rollback gates."
      ],
      referenceAnswer: {
        summary:
          "Choose compatible shadow-and-canary migration with one workflow authority, conservation-style reconciliation, outcome-based SLOs, minimized telemetry, explicit unit costs, and tested fenced regional recovery.",
        explanation:
          "Option C compares behavior without duplicating charges or orders. First introduce stable checkout, order, reservation, and payment identities plus old-reader-compatible states. Shadow new decisions and backfill append-only history, then route a buyer or seller cohort exclusively through the new authority. Automated gates reconcile accepted checkout intents to terminal or explicitly pending states; confirmed orders to valid reservations; captured or authorized money to one logical payment; and inventory decrements to reservations and releases. Track acceptance availability, decision latency, unknown-payment age, oversell count, stuck-state age, expiry lag, duplicate-provider outcomes, reconciliation backlog, and recovery objectives. Logs contain scoped IDs, state, reason class, latency, and redacted diagnostics—not payment tokens, addresses, or full baskets. Costs include provider calls, database contention, queue work, reconciliation effort, and reserved flash-sale capacity. Regional failover must advance a fenced epoch and pass measured RPO/RTO exercises. Rollback uses routing and lease kill switches while both versions understand all emitted state."
      },
      rubric: [
        {
          criterion:
            "Defines outcome-based SLOs, conservation-style invariants, automated reconciliation, and tested fenced recovery.",
          points: 3,
          dimensionKeys: ["observability-slos"]
        },
        {
          criterion:
            "Protects payment and buyer data while identifying provider, contention, storage, retry, and reserved-capacity costs.",
          points: 3,
          dimensionKeys: ["security-privacy", "cost-efficiency"]
        },
        {
          criterion:
            "Compares migration choices and gives a compatible single-authority canary with measurable promotion and rollback gates.",
          points: 4,
          dimensionKeys: ["tradeoff-communication", "migration-evolution"]
        }
      ],
      commonMistakes: [
        "Sending the same checkout through old and new payment workers creates the duplicate side effects the migration is supposed to prevent.",
        "An application rollback is unsafe when old code cannot understand new states or stale regional workers can still commit."
      ],
      interviewerFollowUps: [
        "Which invariant should automatically stop the first production canary?",
        "What minimum audit evidence should remain after personal checkout details reach their deletion deadline?"
      ],
      transferConnection:
        "Conservation invariants and single-authority canaries are reusable for ledger migrations, booking workflows, and any externally visible transactional system."
    }
  ]
});

export const COLLABORATIVE_DOCUMENT_EDITING = candidateArtifact({
  key: "collaborative-document-editing",
  title: "Collaborative document editing",
  premise:
    "Design a multi-device collaborative document editor with live updates, presence, offline edits, access control, and durable version history.",
  candidateRole:
    "You own the full-stack system boundaries for connection management, operation ordering, convergence, persistence, authorization, history, and protocol evolution.",
  functionalRequirements: [
    "Multiple authorized users can edit one document concurrently and observe remote edits and presence with bounded delay.",
    "Clients can edit offline, reconnect, repair missing operations, and converge without silently discarding accepted work.",
    "Users can inspect version history while owners can change or revoke document access."
  ],
  nonGoals: [
    "Pixel-identical rich-text rendering across every client and synchronous global ordering across unrelated documents are out of scope."
  ],
  constraints: [
    "A small number of celebrity documents can have thousands of simultaneous editors and much higher operation rates.",
    "Slow or disconnected clients must not create unbounded server buffers or block healthy collaborators.",
    "A revoked client must not regain write authority by replaying previously queued offline operations."
  ],
  scaleProfile: [
    "The service holds 3 million concurrent connections and receives 600,000 durable edit operations per second globally.",
    "Most documents have fewer than ten active editors, while a hot document can reach 5,000 simultaneous editors.",
    "Local edits should render immediately and healthy remote collaborators target p95 propagation below 250 milliseconds."
  ],
  difficulties: ["guided", "standard", "stretch"],
  primaryTopicKey: "collaborative-editing",
  secondaryTopicKeys: ["realtime-sync", "offline-conflicts", "document-history"],
  targetKeywords: [
    "backend",
    "fullstack",
    "websockets",
    "realtime",
    "collaboration",
    "offline sync",
    "conflict resolution",
    "distributed systems"
  ],
  realismAnchors: [
    "Durable edits and ephemeral cursor presence have different consistency, retention, and recovery requirements.",
    "Offline clients can reconnect with operations based on an old revision after permissions or document state have changed.",
    "A celebrity document creates a single-document ordering and broadcast hotspot despite broad global distribution.",
    "Long-lived connections and mixed client versions make failover and protocol migration observable product behavior."
  ],
  targetFitExplanation:
    "Collaborative editing exercises realtime connection management, concurrent state, ordering and convergence, authorization, hot-key isolation, recovery, and client/server evolution expected of backend and full-stack engineers.",
  coverageExplanation:
    "Four connected decisions move from collaboration semantics and capacity through versioned operation contracts, realtime topology and failure recovery, and privacy-safe protocol evolution while covering all sixteen Architecture dimensions.",
  authoredAt: "2026-09-12T00:00:00.000Z",
  reviewedAt: "2026-09-12",
  questions: [
    {
      format: "written",
      objective:
        "Separate durable and ephemeral collaboration semantics, quantify aggregate and hot-document load, and define measurable convergence and recovery targets.",
      dependency:
        "The agreed edit, presence, offline, access, ordering, and latency semantics constrain every later operation contract and topology decision.",
      topicKeys: ["collaborative-editing", "realtime-sync"],
      prompt:
        "Define the first-release editing, presence, offline, history, and sharing boundary. Estimate connection, edit-operation, and snapshot load, account for a hot document, and state the latency, durability, convergence, and recovery guarantees your design will defend.",
      artifact: {
        key: "collaboration-requirements-scale-brief",
        kind: "metrics",
        title: "Collaboration workload and product goals",
        content:
          "3M concurrent connections globally; 600k durable edit operations/s peak. Median document: 4 active editors and 2 MiB current state. Celebrity document: 5,000 simultaneous editors and 25,000 operations/s. Presence updates: up to 4/s/editor and may be dropped. Offline clients may reconnect after 14 days. Product asks for 'instant edits, no conflicts, unlimited history, and immediate permission revocation everywhere.' Healthy remote collaborators target p95 propagation below 250ms.",
        caption:
          "Aggregate connection scale, one-document hotspots, ephemeral presence, and offline durability require different bounds."
      },
      hints: [
        "Separate durable document operations from lossy presence and cursor signals before estimating storage or delivery guarantees.",
        "Calculate both the global operation stream and the 25,000-operation-per-second single-document sequencing and broadcast hotspot.",
        "Define local rendering, server acceptance, remote propagation, convergence, history retention, offline recovery, and revocation as distinct promises."
      ],
      referenceAnswer: {
        summary:
          "Scope durable convergent edits, bounded offline synchronization and version history separately from ephemeral presence, while planning explicitly for 3 million connections, 600,000 edits per second, and a 25,000-operation-per-second hot document.",
        explanation:
          "The first release owns authenticated document open, durable editing, reconnect and gap repair, bounded version history, sharing, and ephemeral presence. Presence can be sampled or dropped; accepted edits cannot. Local edits render optimistically, server acceptance has a durable acknowledgement, and healthy remote peers target p95 propagation below 250ms. Convergence means authorized clients that receive the same accepted operations reach equivalent document state, not that every user intention is conflict-free. At 600,000 operations/s, even 200-byte compressed operations produce about 10 TiB/day before indexes and replication; snapshots and compaction must bound replay. The hot document independently requires sequencing and broadcasting 25,000 operations/s to thousands of clients. Offline duration, retained operation horizon, snapshot availability, access revalidation, and recovery objectives must be explicit. Permission revocation should stop newly authorized actions within a measurable bound, but disconnected clients cannot be physically recalled."
      },
      rubric: [
        {
          criterion:
            "Defines editing, presence, offline, history, sharing, ordering, convergence, revocation, and explicit non-goal semantics.",
          points: 5,
          dimensionKeys: ["requirements-framing"]
        },
        {
          criterion:
            "Quantifies global connections and operation storage, isolates hot-document load, and gives measurable latency, durability, and recovery targets.",
          points: 5,
          dimensionKeys: ["capacity-estimation"]
        }
      ],
      commonMistakes: [
        "Treating presence as durable work forces high-volume cursor noise through the edit durability and history path.",
        "Promising conflict-free user intent or immediate revocation on disconnected devices claims control the service does not have."
      ],
      interviewerFollowUps: [
        "Which product guarantee would you relax first for a 5,000-editor celebrity document?",
        "How does a fourteen-day offline limit influence operation retention and snapshot policy?"
      ],
      transferConnection:
        "Separating durable state from ephemeral coordination also applies to multiplayer sessions, shared whiteboards, and live operational dashboards."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design stable document, operation, revision, snapshot, membership, and sync-cursor contracts with explicit convergence and authorization boundaries.",
      dependency:
        "The contracts must preserve the durability, convergence, offline, and revocation semantics fixed in the requirements stage.",
      topicKeys: ["collaborative-editing", "offline-conflicts", "document-history"],
      prompt:
        "Diagnose the proposed synchronization contract and records. Redesign operation identity, revision or causal context, deduplication, snapshots, membership, history access, compaction, and the handling of queued offline edits after permission revocation.",
      artifact: {
        key: "collaboration-contract-data-draft",
        kind: "config",
        title: "Proposed document synchronization records",
        content:
          "WS /documents/{documentId}?userId={userId}\nclient -> { position, insertedText }\nserver -> { documentText }\n\ndocument(id, text, version, owner_id)\npresence(document_id, user_id, cursor)\n\nEvery reconnect sends the full document and resets version=1. Client retries create new edit IDs. The server applies positions to whichever text is current. Membership is cached for 24h by user_id only. Operations are deleted after a nightly snapshot. Offline edits are accepted before access is rechecked. History reads scan snapshots by created_at without document or tenant keys.",
        caption:
          "The proposal has no stable operation identity, causal base, safe authorization scope, or recoverable history boundary."
      },
      hints: [
        "Give each client operation a stable ID plus document identity and a base revision or causal context that survives retry.",
        "Choose and defend server ordering, OT, or CRDT semantics; a raw text position without transformation or causality is not enough.",
        "Revalidate document-scoped membership before accepting offline work and retain snapshots plus the bounded operation range needed for gap repair."
      ],
      referenceAnswer: {
        summary:
          "Use document-scoped stable operation IDs, explicit revision or causal context, conditional membership versions, append-only operations, and versioned snapshots with bounded compaction and access-aware offline replay.",
        explanation:
          "A client operation includes tenant/document ID, actor/device ID, stable operation ID, base revision or causal context, operation type, and client sequence. A uniqueness key deduplicates retries. For the stated central service and rich-text requirements, a server-ordered log with a documented OT or structured-operation transform is defensible; a CRDT is viable when stronger peer/offline autonomy justifies metadata cost. The accepted order advances a document revision conditionally and appends the operation atomically with dispatch intent. Versioned snapshots record the last included revision and format/protocol version; compaction deletes only operations older than both the recovery horizon and a verified snapshot. Sync cursors request snapshot plus operations after a revision and detect gaps. Membership is keyed by document and principal with a version/revocation time. Every reconnect and offline batch reauthorizes; revoked edits are rejected or exported for the user, never silently committed. History and snapshots use tenant/document-leading access paths, while presence lives in separately expiring storage."
      },
      rubric: [
        {
          criterion:
            "Defines document-scoped operation, retry, revision/causal, sync, and authorization contracts with explicit conflict semantics.",
          points: 3,
          dimensionKeys: ["api-event-contracts"]
        },
        {
          criterion:
            "Models append-only operations, versioned snapshots and membership with bounded compaction and document-leading history access paths.",
          points: 4,
          dimensionKeys: ["data-modeling", "storage-access-patterns"]
        },
        {
          criterion:
            "Uses conditional revision/membership transitions and an atomic accepted-operation and dispatch boundary.",
          points: 3,
          dimensionKeys: ["consistency-transactions"]
        }
      ],
      commonMistakes: [
        "Sending only character positions against mutable text makes concurrent inserts and deletes ambiguous without transformation or causal semantics.",
        "Accepting an offline batch before rechecking document membership lets revoked clients recover write authority through stale queued work."
      ],
      interviewerFollowUps: [
        "What evidence would make you choose a CRDT instead of server ordering with transformation?",
        "How do mixed protocol versions read an old snapshot and exchange operations during a rolling migration?"
      ],
      transferConnection:
        "Stable causal operations, snapshots, and authorization-aware replay transfer to offline forms, replicated workflows, and synchronized device state."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design realtime connection, sequencing, persistence, broadcast, and recovery boundaries while diagnosing hot documents, slow consumers, and competing regional owners.",
      dependency:
        "The topology consumes the frozen operation, revision, snapshot, membership, and sync-cursor contracts defined in the previous stage.",
      topicKeys: ["collaborative-editing", "realtime-sync", "offline-conflicts"],
      prompt:
        "Use the trace and metrics to explain the divergence and overload. Propose gateway, routing, sequencing, persistence, cache, broadcast, backpressure, partitioning, reconnect, and regional-failover boundaries that preserve healthy documents.",
      artifact: {
        key: "collaboration-hot-document-trace",
        kind: "trace",
        title: "Hot-document and failover trace",
        content:
          "clients -> regional websocket gateways -> broker partition(document_id) -> document worker -> database -> broadcast\n\n14:00 doc=d-hot reaches 5,000 editors and 25k ops/s; its one broker partition lag=38s\n14:01 one slow client has a 1.8GB process-local send buffer; gateway memory=94%\n14:02 worker cache holds document text but no revision; restarted worker loads snapshot r810 and misses operations r811-r846\n14:03 clients reconnect and resend edits with new IDs; duplicate text appears\n14:04 region B declares itself owner while region A's 15-minute lease remains valid; both assign revision r847\n14:06 unrelated document propagation p95=19s because all broadcasts share the same worker pool.",
        caption:
          "One-document serialization, unbounded client buffers, incomplete recovery, unstable retry IDs, and unfenced failover cause divergence."
      },
      hints: [
        "Keep one logical ordering authority per document, but separate ordering from scalable broadcast and protect shared capacity from a celebrity document.",
        "Bound each client's outgoing buffer; a client that falls behind should receive a gap marker and resynchronize from a snapshot plus operations.",
        "Persist accepted order before acknowledgement, retain stable retry IDs, and fence ownership epochs so stale regional workers cannot commit revisions."
      ],
      referenceAnswer: {
        summary:
          "Route each document to one fenced sequencing authority, durably append before acknowledgement, scale broadcast separately, bound slow clients, shard hot-document fan-out, and recover gaps from verified snapshots plus operations.",
        explanation:
          "Regional gateways authenticate connections and route stable operations by document ownership. One logical sequencer per document assigns or validates order and atomically appends the operation with revision and dispatch intent before durable acknowledgement. Ownership is a fenced epoch stored with every commit; a region or restarted worker with an older epoch cannot advance state. Normal documents distribute across partitions, while a hot document receives dedicated admission, an adequately provisioned sequencer, and a broadcast tree or regional relays so ordering does not require one worker to write to 5,000 sockets. Presence uses lossy coalesced capacity. Per-client send buffers are bounded; slow clients receive a resync signal instead of unbounded history. Reconnect presents the last revision, uses the same operation IDs, loads a verified snapshot, and replays the contiguous retained log while detecting gaps. Revision-aware caches never hold text without its version. Separate sequencing and broadcast pools, document quotas, queue-age admission, and circuit breakers isolate overload from unrelated documents."
      },
      rubric: [
        {
          criterion:
            "Defines coherent gateway, routing, document-owner, durable-log, snapshot, dispatch, broadcast, and resynchronization boundaries.",
          points: 2,
          dimensionKeys: ["component-boundaries"]
        },
        {
          criterion:
            "Uses revision-aware caches and bounded per-client/document backpressure with a safe slow-consumer resync path.",
          points: 3,
          dimensionKeys: ["caching-contention", "async-work-backpressure"]
        },
        {
          criterion:
            "Handles hot-document sequencing and broadcast while fencing regional ownership and recovering duplicates or missing operations.",
          points: 5,
          dimensionKeys: ["partitioning-hotspots", "reliability-failure-isolation"]
        }
      ],
      commonMistakes: [
        "Adding more unordered document workers can increase throughput while allowing two workers to assign conflicting revisions for the same document.",
        "Keeping every missed update in an unbounded socket buffer lets one slow client exhaust a shared gateway."
      ],
      interviewerFollowUps: [
        "How would you scale broadcast for one hot document without creating a second ordering authority?",
        "What exact state must region B verify before it can accept the first operation after failover?"
      ],
      transferConnection:
        "Fenced entity ownership and bounded resynchronization apply to multiplayer rooms, live auctions, and other realtime partitioned sessions."
    },
    {
      format: "production-decision",
      objective:
        "Defend collaboration observability, content privacy, deletion and retention, cost, regional recovery, and reversible protocol evolution.",
      dependency:
        "The operating and rollout plan must validate the frozen operation semantics, access versions, sequencing authority, snapshots, and recovery protocol.",
      topicKeys: ["collaborative-editing", "document-history", "realtime-sync"],
      prompt:
        "Choose a production-readiness and protocol-evolution plan. Define collaboration SLOs and invariants, privacy and access audit, deletion and history retention, connection and storage costs, regional recovery, mixed-client rollout, and rollback criteria.",
      artifact: {
        key: "collaboration-protocol-rollout",
        kind: "config",
        title: "Synchronization protocol rollout proposal",
        content:
          "Current telemetry logs full document text and access tokens for every rejected operation and retains logs for one year. Dashboard shows only connected socket count. Snapshots and operation history are never deleted.\n\nProtocol v2 changes operation encoding and snapshot format. Proposal: require every client to upgrade on launch day, let v1 and v2 workers both sequence the same documents during rollout, and roll back by deploying the previous server image. Region B has replicated snapshots, but operation-lag, lease fencing, and restore time have not been tested.",
        caption:
          "The proposal exposes content, lacks convergence evidence, and gives mixed versions and regions competing write authority."
      },
      hints: [
        "Measure accepted-to-applied conservation, convergence delay, revision gaps, reconnect recovery, slow-client eviction, and hot-document saturation—not only socket count.",
        "Keep document bodies and credentials out of routine telemetry; scope access audit and make history, deletion, and snapshot retention purpose-specific.",
        "Use version negotiation and compatible readers, shadow protocol decisions, canary document cohorts behind one fenced sequencer, and retain a routing rollback switch."
      ],
      referenceAnswer: {
        summary:
          "Use convergence and recovery SLOs, privacy-minimized document-scoped audit, bounded history and verified deletion, cost attribution, and a compatible mixed-client canary with one fenced authority and tested regional rollback.",
        explanation:
          "Track connection success, durable acknowledgement, local-to-remote propagation, accepted-to-applied operation conservation, duplicate IDs, revision gaps, convergence checks, reconnect repair, rejected unauthorized edits, slow-client resync, hot-document saturation, snapshot age, and compaction lag. Telemetry carries document/operation IDs, versions, timing, and bounded reason codes—not content or tokens—with document-scoped privileged-access audit. Retention distinguishes user-visible history, recovery operations, snapshots, ephemeral presence, audit facts, and backups; deletion records propagation and policy-bounded backup expiry. Costs include connection memory, regional relay egress, operations and snapshots, hot-document broadcast, and long offline retention. Protocol v2 uses negotiated capabilities and versioned operation/snapshot readers. Shadow decode and transformation results, canary document cohorts through one active fenced sequencer, compare revision and convergence invariants, and expand gradually. A routing/epoch kill switch returns authority to the compatible old path. Regional readiness requires measured operation lag, snapshot restore, ownership transfer, RPO, and RTO rather than replica existence alone."
      },
      rubric: [
        {
          criterion:
            "Defines convergence, propagation, recovery, authorization, saturation, snapshot, and tested regional-failover signals.",
          points: 3,
          dimensionKeys: ["observability-slos"]
        },
        {
          criterion:
            "Minimizes content telemetry and defines scoped audit, deletion/retention, and explicit connection, storage, relay, and hot-document cost controls.",
          points: 3,
          dimensionKeys: ["security-privacy", "cost-efficiency"]
        },
        {
          criterion:
            "Compares protocol choices and provides compatible mixed-client canaries with one fenced authority and measurable rollback gates.",
          points: 4,
          dimensionKeys: ["tradeoff-communication", "migration-evolution"]
        }
      ],
      commonMistakes: [
        "Allowing v1 and v2 workers to sequence the same document creates divergent histories even if both protocol implementations are individually correct.",
        "Rolling back only the server image cannot recover clients or snapshots that the old protocol can no longer interpret."
      ],
      interviewerFollowUps: [
        "Which invariant should automatically remove the first v2 document cohort from the canary?",
        "What evidence may remain after document content is deleted so that privileged access is still auditable?"
      ],
      transferConnection:
        "Capability-negotiated protocols and single-authority canaries transfer to messaging clients, device synchronization, and other long-lived version-skewed systems."
    }
  ]
});

export const GLOBAL_MEDIA_PROCESSING = candidateArtifact({
  key: "global-media-processing",
  title: "Global media upload and processing",
  premise:
    "Design a platform that accepts large photos and videos, processes immutable variants, serves them globally, and enforces tenant access, deletion, and lifecycle policy.",
  candidateRole:
    "You own the backend and full-stack boundaries for resumable upload, metadata, processing workflows, global delivery, tenant security, deletion, and cost control.",
  functionalRequirements: [
    "Users can upload large media resumably and observe durable upload and processing status after reconnecting.",
    "The platform scans originals, creates versioned derivatives, and serves authorized assets through global delivery infrastructure.",
    "Owners can delete an asset and receive a traceable outcome across originals, derivatives, caches, and retained backups."
  ],
  nonGoals: [
    "Building a video editor, guaranteeing immediate backup erasure, and grading media quality with an unbounded model are out of scope."
  ],
  constraints: [
    "Application servers must not proxy every media byte or trust client-selected storage object keys.",
    "Duplicate workflow delivery must not create inconsistent derivatives or publish unscanned content.",
    "Storage, transcoding, replication, and CDN egress costs must remain attributable and bounded by tenant policy."
  ],
  scaleProfile: [
    "The platform accepts 25 million uploads per day with a 20 MiB average and 20 GiB maximum object size.",
    "Each accepted original produces five derivatives on average and peak processing demand reaches 35,000 jobs per second.",
    "Global delivery serves 8 petabytes per month while one viral asset can receive 2 million requests per minute."
  ],
  difficulties: ["guided", "standard", "stretch"],
  primaryTopicKey: "media-processing",
  secondaryTopicKeys: ["object-storage", "workflow-orchestration", "cdn-delivery"],
  targetKeywords: [
    "backend",
    "fullstack",
    "object storage",
    "media",
    "uploads",
    "transcoding",
    "cdn",
    "workflow"
  ],
  realismAnchors: [
    "Large uploads fail mid-transfer and must resume without sending completed parts through application servers again.",
    "Processing jobs are delivered at least once, so every derivative needs stable source and transformation identity.",
    "A deletion request crosses metadata, original objects, derivatives, CDN caches, replicas, and policy-bounded backups.",
    "A viral asset changes CDN and egress economics without necessarily increasing origin upload traffic."
  ],
  targetFitExplanation:
    "Media processing exercises large-object APIs, object storage, durable workflows, immutable derivatives, CDN delivery, tenant authorization, deletion, failure recovery, and cost trade-offs expected of backend and full-stack engineers.",
  coverageExplanation:
    "Four connected decisions follow an asset from scoped upload requirements through ownership-safe contracts, idempotent processing and delivery, and privacy-aware production evolution while covering all sixteen Architecture dimensions.",
  authoredAt: "2026-09-12T00:00:00.000Z",
  reviewedAt: "2026-09-12",
  questions: [
    {
      format: "written",
      objective:
        "Define the media lifecycle boundary, quantify ingress, storage amplification, processing, and egress, and establish measurable readiness and deletion guarantees.",
      dependency:
        "The accepted object, derivative, delivery, retention, and deletion semantics become fixed inputs to every later contract and workflow decision.",
      topicKeys: ["media-processing", "object-storage", "cdn-delivery"],
      prompt:
        "Define the first-release upload, processing, delivery, sharing, and deletion boundary. Estimate daily original storage, derivative amplification, peak processing, and delivery egress, then state measurable upload, readiness, availability, and deletion objectives.",
      artifact: {
        key: "media-requirements-scale-brief",
        kind: "metrics",
        title: "Media workload and lifecycle brief",
        content:
          "25M uploads/day; average original 20 MiB; maximum 20 GiB. Five derivatives per accepted original with combined size averaging 1.4× the original. Peak processing arrivals: 35k jobs/s before retries. Global delivery: 8 PiB/month; viral asset: 2M requests/minute. Originals retained for the account lifetime; abandoned multipart uploads currently never expire. Product asks for 'instant processing, permanent links, immediate deletion everywhere, and zero failed uploads.'",
        caption:
          "Original bytes, derived bytes, processing work, CDN egress, and deletion completion need separate estimates and promises."
      },
      hints: [
        "Separate upload acceptance, scan completion, derivative readiness, CDN delivery, and policy-complete deletion rather than calling all of them availability.",
        "Start original storage with 25 million multiplied by 20 MiB, then add the 1.4× derivative factor, replication, retention, and abandoned-part cleanup.",
        "Account for resumable 20 GiB objects, retry headroom above 35,000 jobs/s, viral CDN traffic, and the limits of immediate backup deletion."
      ],
      referenceAnswer: {
        summary:
          "Scope resumable direct upload through scanned, versioned derivatives and authorized delivery, plan for roughly 477 TiB of new originals per day plus about 668 TiB of derivatives before replication, and define distinct upload, processing, delivery, and policy-bounded deletion objectives.",
        explanation:
          "The first release owns authenticated upload sessions, multipart transfer, finalize and checksum verification, scanning, immutable derivative generation, status, signed delivery, lifecycle policy, and traceable deletion. Interactive editing and immediate physical removal from every backup remain outside the boundary. Twenty-five million × 20 MiB is about 477 TiB of originals per day; derivatives add roughly 668 TiB at 1.4× before replicas, temporary parts, indexes, and retention. Peak processing must exceed 35,000 jobs/s with retry and poison-work isolation. Delivery planning starts from 8 PiB/month and treats a 2M-request/minute viral asset as a cache and origin-protection hotspot. Useful targets distinguish resumable-upload completion, p95 time-to-ready by media class, authorized CDN availability, processing backlog age, and deletion from active serving within a short bound with separately disclosed backup expiry."
      },
      rubric: [
        {
          criterion:
            "Defines the media lifecycle, actors, access and deletion boundary, controllable guarantees, and explicit non-goals.",
          points: 5,
          dimensionKeys: ["requirements-framing"]
        },
        {
          criterion:
            "Calculates original and derivative storage, addresses processing and viral-delivery peaks, and defines measurable lifecycle SLOs.",
          points: 5,
          dimensionKeys: ["capacity-estimation"]
        }
      ],
      commonMistakes: [
        "Estimating only original uploads ignores derivative amplification, replication, abandoned parts, and long-term retention.",
        "Promising immediate deletion from immutable backups confuses removal from active serving with policy-bounded physical expiry."
      ],
      interviewerFollowUps: [
        "Which media class would receive a different time-to-ready SLO and why?",
        "How would the storage estimate change if originals move to an archive tier after thirty days?"
      ],
      transferConnection:
        "Lifecycle-specific guarantees and amplification estimates also apply to backups, document conversion, scientific data, and other derived-object platforms."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design ownership-safe upload, object, asset-version, derivative, processing, access, and deletion contracts with idempotent state transitions.",
      dependency:
        "The contracts must preserve the accepted upload, immutable derivative, authorization, readiness, and deletion semantics established in stage one.",
      topicKeys: ["media-processing", "object-storage", "workflow-orchestration"],
      prompt:
        "Diagnose the proposed upload API and records. Redesign upload-session authorization, server-owned object keys, asset and version identity, processing and derivative lineage, access paths, state transitions, and deletion semantics.",
      artifact: {
        key: "media-contract-data-draft",
        kind: "config",
        title: "Proposed upload and asset contract",
        content:
          "POST /upload { tenantId, objectKey, filename } -> { bucketUrl }\nPOST /complete { objectKey } -> 200\nmedia(id, tenant_id, object_key, status, public_url)\njob(media_id, type, status)\n\nThe browser chooses any objectKey and receives permanent bucket credentials. Complete trusts client size and checksum. Re-upload overwrites the same object and media row. Retries create new job IDs and derivative paths. GET /media/{id} checks only that the ID exists. DELETE removes the current object but does not record derivatives, CDN keys, replicas, or backup expiry.",
        caption:
          "Client-controlled keys, permanent credentials, mutable assets, missing lineage, and unscoped reads break ownership and lifecycle guarantees."
      },
      hints: [
        "Create the upload session only after tenant authorization and issue short-lived permissions for one server-generated object prefix and allowed operation.",
        "Separate stable asset identity from immutable original versions, transformation versions, derivatives, and idempotent processing attempts.",
        "Finalize against object-store evidence, advance state conditionally with an outbox, and model deletion as a traceable multi-target lifecycle."
      ],
      referenceAnswer: {
        summary:
          "Use an authorized upload session with a server-owned object namespace, immutable asset versions, content and transformation identity, idempotent jobs, tenant-leading reads, and an auditable deletion workflow.",
        explanation:
          "POST /tenants/{tenant}/assets creates a stable asset and upload session after checking the caller, media policy, size, and quota. The server generates an unguessable tenant-bound staging key and short-lived multipart permissions limited to that key, operation, size, content type, and expiry; no permanent credentials leave the service. Parts and finalize are idempotent. Finalize verifies object ownership, store-reported length, checksum, and upload-session state before conditionally creating an immutable asset version and outbox event. Original versions never overwrite each other. Derivatives are keyed by tenant, asset version, transformation version, and output kind so duplicate delivery converges on the same result. Append-only attempts retain bounded diagnostics while current job and asset states advance conditionally. Tenant/owner leads every asset, history, and deletion read. Deletion creates a durable request with targets for staging data, originals, derivatives, indexes, CDN keys, replicas, and backup-expiry evidence; active-serving removal and backup expiry remain distinct states."
      },
      rubric: [
        {
          criterion:
            "Defines authorized upload/finalize, stable asset/version, idempotent job, delivery, and deletion contracts with server-owned object identity.",
          points: 3,
          dimensionKeys: ["api-event-contracts"]
        },
        {
          criterion:
            "Models immutable originals, derivative lineage, attempts, lifecycle state, and tenant-leading access and cleanup paths.",
          points: 4,
          dimensionKeys: ["data-modeling", "storage-access-patterns"]
        },
        {
          criterion:
            "Uses conditional finalize/job transitions and an atomic metadata-and-dispatch boundary while treating blob operations as external effects.",
          points: 3,
          dimensionKeys: ["consistency-transactions"]
        }
      ],
      commonMistakes: [
        "Letting a client choose an arbitrary object key can overwrite or claim another tenant's media even when the API request itself is authenticated.",
        "Naming derivatives only by job ID makes duplicate processing create multiple conflicting outputs with no stable source lineage."
      ],
      interviewerFollowUps: [
        "Which restrictions belong in a signed multipart-upload permission?",
        "What evidence should a deletion-status API expose without leaking internal bucket or backup details?"
      ],
      transferConnection:
        "Server-owned resource namespaces and immutable transformation lineage generalize to document imports, build artifacts, and data-processing pipelines."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design an idempotent processing and delivery pipeline while diagnosing duplicate work, poison media, cache staleness, regional loss, and viral origin overload.",
      dependency:
        "The flow consumes the frozen upload session, immutable asset version, transformation version, derivative, and deletion identities from the contract stage.",
      topicKeys: ["media-processing", "workflow-orchestration", "cdn-delivery"],
      prompt:
        "Use the trace and metrics to explain the unsafe publication and overload. Propose finalize, scan, metadata, processing, storage, cache/CDN, retry, backpressure, isolation, reconciliation, and regional-failure boundaries.",
      artifact: {
        key: "media-processing-failure-trace",
        kind: "trace",
        title: "Duplicate processing and viral-delivery trace",
        content:
          "upload-complete -> one shared jobs queue -> processor -> mutable /assets/{assetId}/output.mp4 -> CDN\n\n09:00 job j-8 times out after writing output; retry j-9 overwrites the same key with a different codec\n09:02 scan queue lags 18m, but status becomes READY when any derivative exists; unscanned asset is served\n09:04 corrupt video retries 40 times and consumes 35% of workers; image time-to-ready p95=27m\n09:06 region A loses processors; region B replays jobs without transformation versions\n09:08 deleted asset metadata is gone, but thumbnail and CDN URL still return 200\n09:10 viral asset causes 900k origin requests/min because signed URL query strings fragment the cache key.",
        caption:
          "Mutable outputs, unsafe readiness, poison retries, incomplete deletion, and cache fragmentation amplify at-least-once delivery failures."
      },
      hints: [
        "Make every stage consume and produce immutable versioned identities; readiness should require the declared scan and derivative manifest, not any output.",
        "Separate media classes and expensive stages with quotas, bounded retries, dead-letter handling, and per-tenant admission rather than one worker pool.",
        "Use a stable cacheable asset-version URL with authorization at the appropriate boundary, origin shielding, and explicit deletion invalidation and reconciliation."
      ],
      referenceAnswer: {
        summary:
          "Drive immutable idempotent stages from durable metadata, gate publication on a verified manifest, isolate poison and expensive work, protect origins with versioned CDN keys, and reconcile every lifecycle target including deletion.",
        explanation:
          "Finalize verifies the staged object and atomically records an immutable asset version plus outbox event. Scanning, metadata extraction, transcoding, thumbnails, and publication are independently idempotent stages keyed by asset version, transformation version, and output kind. Conditional job claims and deterministic object keys make duplicate delivery return the same result; output is written to a temporary key and promoted only after checksum and policy validation. READY requires a declared scan result and complete derivative manifest. Separate queues, quotas, concurrency limits, timeouts, bounded exponential retries, and dead-letter review isolate corrupt files, media classes, tenants, and costly codecs. Region B can replay the durable manifest because transformation identity is frozen. CDN URLs include immutable asset versions; authorization tokens do not unnecessarily fragment the cache key, and origin shielding/request coalescing protects a viral asset. Deletion tombstones prevent republishing, revoke serving, invalidate CDN keys, and drive idempotent removal across originals and derivatives. Reconciliation finds orphan objects, missing outputs, stuck jobs, manifest mismatches, and incomplete deletion."
      },
      rubric: [
        {
          criterion:
            "Defines coherent finalize, scan, extraction, transformation, manifest, publication, delivery, deletion, and reconciliation boundaries.",
          points: 2,
          dimensionKeys: ["component-boundaries"]
        },
        {
          criterion:
            "Uses versioned cache keys and isolates media classes, poison work, tenants, and retries with bounded admission and backpressure.",
          points: 3,
          dimensionKeys: ["caching-contention", "async-work-backpressure"]
        },
        {
          criterion:
            "Handles duplicate processing, viral origin hotspots, regional replay, safe readiness, and deletion propagation without cross-tenant impact.",
          points: 5,
          dimensionKeys: ["partitioning-hotspots", "reliability-failure-isolation"]
        }
      ],
      commonMistakes: [
        "Increasing retries for corrupt input consumes more shared capacity without making an unsupported codec processable.",
        "Deleting only the metadata row removes the identities needed to revoke cached delivery and reconcile derivative objects."
      ],
      interviewerFollowUps: [
        "How do you prevent two regions from both publishing different outputs for the same transformation version?",
        "When should an authorized CDN request reach the application, an edge function, or a signed immutable URL directly?"
      ],
      transferConnection:
        "Idempotent manifests, poison-work isolation, and immutable cache keys transfer to build systems, report generation, and batch feature pipelines."
    },
    {
      format: "production-decision",
      objective:
        "Defend signed access, tenant isolation, privacy deletion, observability, regional recovery, cost policy, and reversible migration from a legacy upload path.",
      dependency:
        "The production plan must validate the frozen ownership, lineage, manifest, delivery, deletion, and reconciliation boundaries established earlier.",
      topicKeys: ["media-processing", "object-storage", "cdn-delivery"],
      prompt:
        "Choose a production-readiness and evolution plan. Define lifecycle SLOs and invariants, signed-access and privacy controls, deletion evidence, storage/compute/egress cost policy, regional recovery, and a reversible migration from the legacy upload path.",
      artifact: {
        key: "media-production-readiness",
        kind: "config",
        title: "Media security and migration proposal",
        content:
          "Current logs contain permanent bucket URLs, upload credentials, filenames, user IDs, and signed delivery URLs for one year. All originals and every derivative remain in hot replicated storage forever. Dashboard shows only successful HTTP uploads.\n\nMigration A: rewrite every object key during one maintenance window.\nMigration B: let old and new processors publish to the same mutable output paths.\nMigration C: add asset/version identity and manifests, shadow new transformations, backfill lineage, canary one media class through one publication authority, compare outputs and lifecycle invariants, then switch routing with a kill switch.\nBackups exist in another region, but restore, deletion propagation, and processor fencing are untested.",
        caption:
          "Safe evolution needs minimized credentials and metadata, lifecycle evidence, cost-aware retention, one publisher, and tested recovery."
      },
      hints: [
        "Measure accepted uploads through scanned and ready, failed, quarantined, deleted, or explicitly pending lifecycle states, including orphan and duplicate invariants.",
        "Use short-lived scoped upload/delivery authorization, redact identifiers and credentials, and record deletion propagation without putting object secrets in logs.",
        "Shadow immutable outputs, canary one class behind one active publication authority, retain compatible manifests, and gate promotion on SLO, cost, recovery, and rollback evidence."
      ],
      referenceAnswer: {
        summary:
          "Choose a manifest-compatible shadow-and-canary migration with one publisher, lifecycle invariants and SLOs, scoped short-lived access, auditable deletion, tiered storage, explicit unit costs, and tested fenced regional recovery.",
        explanation:
          "Option C separates output comparison from serving authority. Introduce stable asset/version and transformation identities, compatible manifests, and immutable keys. Shadow transformations, compare checksums and quality policy, backfill lineage, then canary one media class or tenant through exactly one publisher and CDN route. A kill switch restores the old compatible reader without deleting new evidence. Track upload completion, checksum failure, scan age, time-to-ready, queue age by stage/class, retry and poison rates, missing or duplicate manifest outputs, CDN hit ratio, origin requests, deletion age, orphan bytes, and tested RPO/RTO. Authorization uses server-generated namespaces and short-lived least-privilege upload and delivery tokens. Logs retain scoped IDs, versions, timing, and bounded error classes—not credentials, signed URLs, sensitive filenames, or routine content. Deletion keeps a minimal tombstone and per-target completion evidence while backups expire under disclosed policy. Storage tiers, derivative demand, codec compute, replication, CDN hit rate, origin egress, and cost per ready/served asset drive policy. Regional processors use fenced claims so replay cannot create a competing publisher."
      },
      rubric: [
        {
          criterion:
            "Defines lifecycle SLOs, manifest/orphan/duplicate invariants, deletion evidence, and tested fenced regional recovery.",
          points: 3,
          dimensionKeys: ["observability-slos"]
        },
        {
          criterion:
            "Uses scoped short-lived access and minimized telemetry while applying explicit storage, compute, replication, and egress cost policy.",
          points: 3,
          dimensionKeys: ["security-privacy", "cost-efficiency"]
        },
        {
          criterion:
            "Compares alternatives and provides a compatible single-publisher canary with measurable promotion and rollback gates.",
          points: 4,
          dimensionKeys: ["tradeoff-communication", "migration-evolution"]
        }
      ],
      commonMistakes: [
        "Logging signed URLs or upload credentials turns operational telemetry into a reusable access path to customer media.",
        "Allowing old and new processors to overwrite one mutable output key makes comparison destructive and rollback unverifiable."
      ],
      interviewerFollowUps: [
        "Which lifecycle invariant should automatically stop the first media-class canary?",
        "What deletion evidence should remain after all active media bytes and personal metadata are removed?"
      ],
      transferConnection:
        "Versioned manifests, scoped object access, and lifecycle-aware canaries apply to data exports, model artifacts, and other large-object workflows."
    }
  ]
});

export const ARCHITECTURE_DESIGN_REVIEW_CANDIDATES = Object.freeze([
  MULTI_TENANT_WEBHOOK_DELIVERY,
  HIGH_VOLUME_NOTIFICATION_PLATFORM,
  MARKETPLACE_CHECKOUT_INVENTORY,
  COLLABORATIVE_DOCUMENT_EDITING,
  GLOBAL_MEDIA_PROCESSING,
  SEARCH_AUTOCOMPLETE_PLATFORM
]);
