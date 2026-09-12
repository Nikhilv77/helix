import { reviewedArchitectureDesignArtifact } from "./reviewed-scenario-builder";

export const SEARCH_AUTOCOMPLETE_PLATFORM = reviewedArchitectureDesignArtifact({
  key: "search-autocomplete-platform",
  title: "Search and autocomplete platform",
  premise:
    "Design product search and autocomplete over a large, frequently changing catalogue with filters, authorization, relevance, typo tolerance, and regional reads.",
  candidateRole:
    "You own source-to-index contracts, ingestion and reindexing, query serving, authorization, relevance evaluation, privacy deletion, and safe index evolution.",
  functionalRequirements: [
    "Users can search and autocomplete catalogue entities using text, structured filters, stable pagination, and tenant-aware authorization.",
    "Source changes and deletions reach the searchable view within a declared freshness objective and survive replay or reindexing.",
    "Operators can compare relevance versions and migrate indexes without making the transactional source depend on search availability."
  ],
  nonGoals: [
    "Replacing the transactional catalogue database or promising one universally correct relevance order for every query is out of scope."
  ],
  constraints: [
    "Authorization filters must not leak another tenant's documents or even confirm that a hidden document exists.",
    "Indexing spikes, reindexing, and a hot query must not consume the capacity reserved for normal search traffic.",
    "Older or duplicated change events must not overwrite a newer searchable document version."
  ],
  scaleProfile: [
    "The source contains 800 million searchable entities and changes at 120,000 records per second during catalogue imports.",
    "Search peaks at 250,000 queries per second and autocomplete peaks at 600,000 requests per second across regions.",
    "Search targets p95 below 250 milliseconds while 99 percent of accepted source changes should be visible within 60 seconds."
  ],
  difficulties: ["guided", "standard", "stretch"],
  primaryTopicKey: "search-platform",
  secondaryTopicKeys: ["change-data-capture", "index-evolution", "relevance-evaluation"],
  targetKeywords: [
    "backend",
    "fullstack",
    "search",
    "autocomplete",
    "indexing",
    "relevance",
    "change data capture",
    "distributed systems"
  ],
  realismAnchors: [
    "The searchable index is a derived view whose freshness and availability differ from the transactional catalogue.",
    "Tenant authorization and deletion must survive caches, filters, replicas, reindexing, and delayed change events.",
    "Hot queries and autocomplete prefixes concentrate read load even when catalogue documents are evenly sharded.",
    "Analyzer, mapping, synonym, and ranking changes require full index evolution rather than an in-place code-only rollback."
  ],
  targetFitExplanation:
    "Search exercises query contracts, derived data, CDC, version-aware indexing, shard and cache design, relevance evaluation, privacy deletion, read scaling, and zero-downtime index evolution expected of backend and full-stack engineers.",
  coverageExplanation:
    "Four connected decisions move from search behavior and capacity through safe query/index contracts, ingestion and serving failures, and relevance-aware production evolution while covering all sixteen Architecture dimensions.",
  authoredAt: "2026-09-12T00:00:00.000Z",
  reviewedAt: "2026-09-12",
  questions: [
    {
      format: "written",
      objective:
        "Define distinct search behaviors, quantify query and indexing load, and turn relevance, freshness, latency, and authorization language into measurable requirements.",
      dependency:
        "The accepted query classes, source-of-truth boundary, freshness, pagination, and authorization semantics constrain every later index and serving decision.",
      topicKeys: ["search-platform", "relevance-evaluation"],
      prompt:
        "Define the first-release search, autocomplete, filter, authorization, and pagination boundary. Estimate query, update, replica, and index-storage load, account for hot queries, and state measurable latency, availability, freshness, and relevance objectives.",
      artifact: {
        key: "search-requirements-scale-brief",
        kind: "metrics",
        title: "Search workload and product goals",
        content:
          "800M source entities; average searchable document 3 KiB before index overhead. Catalogue imports peak at 120k source changes/s. Search peak: 250k queries/s; autocomplete peak: 600k requests/s. Top 100 prefixes produce 18% of autocomplete traffic. Product asks for 'real-time updates, perfect relevance, every filter, unlimited result pages, and no separate search outage.' Target search latency: p95 <250ms; desired freshness: 99% of accepted changes visible within 60s.",
        caption:
          "Search, autocomplete, indexing, hot prefixes, storage overhead, and transactional availability need separate bounds."
      },
      hints: [
        "Separate full-text search, exact identifier lookup, autocomplete, filters, and analytical queries before choosing one latency or consistency promise.",
        "Estimate raw searchable fields first, then state assumptions for inverted-index overhead, replicas, reindex headroom, and change replay.",
        "Define relevance with a versioned judged-query set and guarded user outcomes; define freshness as source version or event time visible by a percentile."
      ],
      referenceAnswer: {
        summary:
          "Scope authorized product search and autocomplete as a derived service, plan for roughly 2.2 TiB of raw searchable fields before index overhead and replicas, and define separate latency, freshness, availability, pagination, and relevance objectives.",
        explanation:
          "The first release supports full-text product search, bounded structured filters, typo-tolerant autocomplete, tenant-aware visibility, and cursor-based pagination. Exact source-of-truth lookups and analytical scans remain outside the search path. Eight hundred million × 3 KiB is about 2.2 TiB of raw searchable fields before postings, stored fields, replicas, metadata, and temporary double capacity for reindexing. Peak search plus autocomplete is 850,000 requests/s, with explicit hot-prefix handling, while indexing must absorb 120,000 changes/s plus replay. Useful targets include p95 search below 250ms, a separate tighter autocomplete target, 99.99% regional query availability, 99% source-version freshness within 60 seconds, stable bounded pagination semantics, zero unauthorized results, and relevance gates over a representative judged-query set plus protected online outcomes. Search may be stale or unavailable without corrupting the transactional catalogue."
      },
      rubric: [
        {
          criterion:
            "Defines search, autocomplete, filter, authorization, pagination, relevance, source-of-truth boundaries, and explicit non-goals.",
          points: 5,
          dimensionKeys: ["requirements-framing"]
        },
        {
          criterion:
            "Quantifies query, update, storage, replica/reindex, and hot-prefix load and supplies measurable latency, availability, freshness, and relevance targets.",
          points: 5,
          dimensionKeys: ["capacity-estimation"]
        }
      ],
      commonMistakes: [
        "Treating the search index as the transactional source of truth lets indexing lag or reindex failure corrupt catalogue correctness.",
        "Promising perfect relevance creates no measurable evaluation or trade-off boundary for latency, freshness, diversity, or business rules."
      ],
      interviewerFollowUps: [
        "Which query type would you remove first if arbitrary filters doubled index size and tail latency?",
        "How much temporary capacity must be reserved to rebuild the full index without deleting the active one?"
      ],
      transferConnection:
        "Derived-view freshness, judged quality sets, and read/write capacity separation also apply to recommendations, analytics materializations, and cached catalogues."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design safe query, cursor, document-version, indexing-event, authorization, configuration, and deletion contracts with replay-aware consistency.",
      dependency:
        "The contracts must preserve the source-of-truth, bounded pagination, tenant visibility, freshness, and relevance semantics established in stage one.",
      topicKeys: ["search-platform", "change-data-capture", "index-evolution"],
      prompt:
        "Diagnose the proposed query and indexing contracts. Redesign stable document and event versions, cursor pagination, authorization filters, analyzer/ranking configuration, stale-event rejection, backfill access paths, and privacy deletion semantics.",
      artifact: {
        key: "search-contract-data-draft",
        kind: "config",
        title: "Proposed query and index contracts",
        content:
          "GET /search?q={text}&tenantId={tenant}&page=50000 -> results\nindex message { entityId, title, body, visible }\nsearch_document(entity_id, tenant_id, text, updated_at)\n\nThe client supplies tenantId and the search service trusts it. CDC retries have new message IDs and overwrite documents in arrival order. Pagination uses offset and a mutable relevance score. Analyzer and synonym files are edited in place. A delete removes the source row, but old events, query caches, replicas, and the rebuilding index are not tracked. Backfill scans the source without a stable snapshot or checkpoint.",
        caption:
          "Untrusted scope, arrival-order writes, unstable offsets, mutable configuration, and incomplete deletion break safety and repeatability."
      },
      hints: [
        "Derive tenant and visibility scope from the authorized caller, and include stable source version plus event identity on every upsert or delete.",
        "Use a signed cursor over stable sort values and search/index version instead of a deep mutable offset.",
        "Version mappings, analyzers, synonyms, and rankers; make deletion a versioned event that reaches every live and rebuilding index and cache."
      ],
      referenceAnswer: {
        summary:
          "Use server-derived authorization scope, version-conditional document events, signed search-after cursors, immutable index configuration, checkpointed backfills, and deletion versions that dominate stale upserts.",
        explanation:
          "The query API derives tenant, principal, and allowed resource scope from authentication rather than a trusted query parameter. A signed cursor carries index generation, normalized query/filter fingerprint, stable sort tuple, and expiry; search-after avoids unbounded offsets, while product semantics state how mutations affect later pages. Each source entity has a monotonic version or ordered change position. Upsert and delete events carry tenant, entity, source version, event ID, and bounded fields; an index write applies only when its version is newer, so duplicates and late events are harmless. Tombstone versions prevent an older replay from resurrecting deleted content. Index generations freeze mapping, analyzer, synonym, authorization-field, and ranker versions. Backfills read a stable snapshot or watermark, checkpoint partitions, then replay changes after that point. Access paths support tenant/entity repair, version-lag sampling, backfill partitions, and deletion verification. Privacy deletion fans out to every serving and rebuilding generation, query and document caches, retained events under policy, replicas, and backup expiry evidence."
      },
      rubric: [
        {
          criterion:
            "Defines authorized query/filter/cursor behavior and stable versioned upsert, delete, retry, and configuration contracts.",
          points: 3,
          dimensionKeys: ["api-event-contracts"]
        },
        {
          criterion:
            "Models derived documents, immutable index generations, tombstones, checkpoints, and access paths for repair, backfill, and deletion verification.",
          points: 4,
          dimensionKeys: ["data-modeling", "storage-access-patterns"]
        },
        {
          criterion:
            "Uses conditional source-version writes and a consistent snapshot-plus-change boundary without coupling source transactions to search availability.",
          points: 3,
          dimensionKeys: ["consistency-transactions"]
        }
      ],
      commonMistakes: [
        "Filtering by a client-supplied tenant ID can leak hidden documents even when the search endpoint requires authentication.",
        "Applying changes in delivery order lets a delayed old upsert resurrect a document after a newer privacy deletion."
      ],
      interviewerFollowUps: [
        "What should happen when a cursor references an index generation retired during pagination?",
        "How do you prove a deletion reached an index that was being rebuilt when the request arrived?"
      ],
      transferConnection:
        "Version-dominant updates, tombstones, and snapshot-plus-stream backfills transfer to caches, analytics views, and CDC-fed materializations."
    },
    {
      format: "artifact-diagnosis",
      objective:
        "Design isolated indexing and query-serving paths while diagnosing stale writes, hot shards, cache stampedes, replay load, and reindex failures.",
      dependency:
        "The topology consumes the frozen source versions, index generations, cursor, authorization, tombstone, and configuration contracts from stage two.",
      topicKeys: ["search-platform", "change-data-capture", "index-evolution"],
      prompt:
        "Use the trace and metrics to explain stale and slow results. Propose CDC, enrichment, indexing, shard/replica, query, authorization, cache, overload, replay, reindex, and regional-failure boundaries that protect normal search traffic.",
      artifact: {
        key: "search-ingestion-serving-trace",
        kind: "trace",
        title: "Import, hot-query, and reindex failure trace",
        content:
          "source DB -> CDC -> shared enrichment workers -> active index\nclients -> query cache -> shared search cluster\n\n11:00 import reaches 120k changes/s; indexing consumes all cluster CPU and search p95=3.8s\n11:02 event entity=e7 version=42 applies, then delayed version=39 overwrites it\n11:03 prefix 'iphone' is 14% of traffic; its cache entry expires globally and 80k identical queries hit one shard\n11:05 tenant_id shard key leaves one enterprise tenant at 71% of shard storage\n11:07 reindex reads live rows for 9h with no watermark, misses concurrent deletes, then alias switches globally\n11:08 region B serves old authorization filters and a deleted private product becomes searchable.",
        caption:
          "Shared indexing capacity, arrival-order writes, a hot prefix, skewed shards, and an unsafe reindex combine correctness and availability failures."
      },
      hints: [
        "Separate indexing and query admission or capacity, and reject a document event whose source version is older than the indexed version.",
        "Use bounded cache keys, jitter, request coalescing, hot-query protection, and shard evidence beyond tenant identity alone.",
        "Build a versioned index from a checkpointed snapshot, replay changes through a watermark, shadow queries, and switch a reversible alias only after authorization and deletion invariants pass."
      ],
      referenceAnswer: {
        summary:
          "Use checkpointed version-aware CDC, isolated indexing capacity, evidence-based shards and replicas, coalesced caches and load shedding, plus shadowed versioned reindexing with reversible routing.",
        explanation:
          "A transactional outbox or ordered CDC reader captures source versions and checkpoints durable positions. Enrichment is idempotent and versioned; index writers apply only newer versions and preserve tombstones. Bulk imports and replays use bounded queues, rate limits, and dedicated or reserved indexing capacity so they cannot exhaust query nodes. Serving uses replicas placed by regional latency and failure goals. Shard design considers document and query distribution, using routing and split strategy that can isolate a large tenant or collection without making every tenant one permanent hotspot. Query caches include normalized query, authorized scope, locale, configuration, and index generation, with TTL jitter, stale-while-revalidate where safe, request coalescing, hot-key admission, and load shedding. Reindexing reads a stable snapshot at a watermark, checkpoints partitions, replays later changes until caught up, verifies counts, versions, deletions, and authorization, shadows representative queries, canaries reads, and switches an alias or routing pointer reversibly. Region B cannot serve until its generation and authorization policy reach the required checkpoint."
      },
      rubric: [
        {
          criterion:
            "Defines coherent source capture, enrichment, indexing, generation, query, authorization, cache, replica, reindex, and reconciliation boundaries.",
          points: 2,
          dimensionKeys: ["component-boundaries"]
        },
        {
          criterion:
            "Uses correctly scoped coalesced caches and isolates import, replay, and reindex work through bounded admission and reserved serving capacity.",
          points: 3,
          dimensionKeys: ["caching-contention", "async-work-backpressure"]
        },
        {
          criterion:
            "Handles shard skew, hot queries, stale events, regional lag, and reindex failure with version-aware and reversible recovery.",
          points: 5,
          dimensionKeys: ["partitioning-hotspots", "reliability-failure-isolation"]
        }
      ],
      commonMistakes: [
        "Adding query replicas without separating indexing load lets the same import saturate every node that serves user traffic.",
        "Switching to an index built from changing live rows without a watermark can permanently omit concurrent updates and deletions."
      ],
      interviewerFollowUps: [
        "Which signals tell you whether to split a large tenant, a hot category, or the whole index differently?",
        "How would autocomplete degrade safely when the primary search cluster is overloaded?"
      ],
      transferConnection:
        "Version-aware materialization, capacity isolation, and reversible generation switches also apply to analytics cubes, recommendation candidates, and cache rebuilds."
    },
    {
      format: "production-decision",
      objective:
        "Defend relevance and freshness evaluation, privacy deletion, abuse controls, cost, regional recovery, and reversible analyzer and index evolution.",
      dependency:
        "The production plan must validate the frozen versions, authorization scope, index generations, serving topology, and reindex protocol established earlier.",
      topicKeys: ["search-platform", "relevance-evaluation", "index-evolution"],
      prompt:
        "Choose a production-readiness and index-evolution plan. Define search quality, freshness, latency, and correctness signals; privacy deletion and abuse controls; shard, replica, refresh, and retention costs; regional recovery; and reversible analyzer/ranker migration.",
      artifact: {
        key: "search-quality-migration-review",
        kind: "metrics",
        title: "Search quality and migration review",
        content:
          "Dashboard: global average latency and click-through rate only. Query logs retain raw personal queries, user IDs, authorization filters, and result documents for one year. Search replicas: 18 per region regardless of traffic. Refresh interval: 1s for every index.\n\nNew analyzer improves aggregate click-through 4% but reduces exact-SKU recall 19% and raises p95 latency 45%. Proposal overwrites analyzer settings in place, rebuilds the active index, and rolls back by deploying old application code. Delete verification checks only the source database. Region failover has never compared index generation, tombstone checkpoint, or authorization-policy version.",
        caption:
          "Aggregate engagement hides critical slices, while in-place index mutation and incomplete deletion make rollback and privacy unverifiable."
      },
      hints: [
        "Combine a versioned judged-query set with guarded online metrics sliced by intent, locale, tenant, exact lookup, and zero-result behavior.",
        "Minimize or tokenize query telemetry, restrict access, apply purpose-specific retention, and verify deletion across events, every index generation, caches, replicas, and backup policy.",
        "Build an immutable candidate generation, shadow and canary reads, compare quality, freshness, latency, and cost guardrails, and retain the old alias target for rollback."
      ],
      referenceAnswer: {
        summary:
          "Use sliced offline and online quality gates, minimized telemetry, end-to-end deletion evidence, demand-based index cost policy, and an immutable shadow/canary generation with reversible routing.",
        explanation:
          "Quality combines a versioned representative judged-query set—NDCG, recall, exact-identifier success, filter correctness, and zero-result slices—with guarded online task completion, reformulation, abandonment, latency, and business constraints. Aggregate click-through alone can reward misleading ranking. Operational SLOs cover p50, p95, and p99 latency, error and shed rate, saturation, source-version freshness, indexing lag, cache behavior, authorization rejects, and deletion age by region and generation. Query telemetry is minimized or tokenized, excludes result bodies and credentials, uses scoped audited access, and has purpose-specific retention. Deletion verification follows source, CDC and tombstone, all active and building indexes, document and query caches, replicas, and policy-bounded backups. Cost decisions expose bytes per document, shards, replicas, refresh and merge work, cache, reindex double capacity, and cost per thousand queries or updates. The new analyzer and ranker build an immutable generation, catch up through a watermark, shadow judged and sampled traffic, then canary query cohorts behind an alias. Exact-SKU recall, authorization, deletion, freshness, latency, error, and cost gates control promotion. Rollback moves the alias to the retained old generation; old application code alone cannot undo an in-place index change. Regional failover requires compatible generation, authorization version, tombstone checkpoint, and tested RPO and RTO."
      },
      rubric: [
        {
          criterion:
            "Defines sliced quality and operational SLOs, correctness and deletion invariants, and tested region-generation recovery.",
          points: 3,
          dimensionKeys: ["observability-slos"]
        },
        {
          criterion:
            "Minimizes sensitive query telemetry and applies explicit shard, replica, refresh, cache, retention, and reindex cost policy.",
          points: 3,
          dimensionKeys: ["security-privacy", "cost-efficiency"]
        },
        {
          criterion:
            "Compares relevance trade-offs and provides an immutable shadow/canary generation with measurable promotion and alias rollback gates.",
          points: 4,
          dimensionKeys: ["tradeoff-communication", "migration-evolution"]
        }
      ],
      commonMistakes: [
        "Optimizing aggregate click-through can hide worse exact lookup, minority-language, authorization, or long-tail query outcomes.",
        "Deploying old application code cannot restore analyzer settings or documents after the active index was rebuilt in place."
      ],
      interviewerFollowUps: [
        "Which metric should block launch despite the four-percent aggregate click-through improvement?",
        "What privacy evidence should survive after a user's raw query history and searchable documents are deleted?"
      ],
      transferConnection:
        "Sliced quality gates and immutable generation canaries transfer to recommendations, ranking models, feature indexes, and other derived decision systems."
    }
  ]
});
