import {
  architectureDesignScenarioRankingCandidateSchema,
  type ArchitectureDesignScenarioRankingCandidate
} from "./focus-ranking-contracts";
import type { ArchitectureDesignDimension, ArchitectureDesignFamily } from "./contracts";
import type { ArchitectureDesignReviewArtifact } from "./review-artifact-contracts";
import {
  ARCHITECTURE_DESIGN_CONTENT_CANDIDATES,
  ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS
} from "./content-candidates";
import { ARCHITECTURE_DESIGN_PROPOSED_RANKING_CANDIDATES } from "./scenario-briefs";

const ARCHITECTURE_FAMILIES: Readonly<Record<string, ArchitectureDesignFamily>> = {
  "multi-tenant-webhook-delivery": "asynchronous-delivery",
  "high-volume-notification-platform": "asynchronous-delivery",
  "marketplace-checkout-inventory": "transactional-workflow",
  "collaborative-document-editing": "realtime-collaboration",
  "global-media-processing": "media-storage-delivery",
  "search-autocomplete-platform": "search-indexing",
  "retrieval-augmented-support-assistant": "search-indexing",
  "real-time-fraud-model-platform": "transactional-workflow",
  "infinite-social-feed-client": "client-data-rendering",
  "typeahead-search-client": "interactive-client-component",
  "offline-field-inspection-app": "offline-first-client",
  "design-system-rollout": "frontend-platform",
  "realtime-chat-web-client": "realtime-client",
  "product-page-web-performance": "client-data-rendering",
  "clickstream-analytics-pipeline": "event-analytics-pipeline",
  "cdc-lakehouse-replication": "change-data-capture",
  "daily-revenue-reporting": "batch-analytics-pipeline",
  "data-quality-lineage-platform": "data-platform-governance",
  "realtime-fraud-feature-pipeline": "streaming-feature-pipeline",
  "experiment-metrics-pipeline": "batch-analytics-pipeline"
};

const EMPHASIS_DIMENSIONS: Readonly<Record<string, readonly ArchitectureDesignDimension[]>> = {
  "multi-tenant-webhook-delivery": [
    "api-event-contracts",
    "caching-contention",
    "async-work-backpressure",
    "partitioning-hotspots",
    "reliability-failure-isolation"
  ],
  "high-volume-notification-platform": [
    "requirements-framing",
    "component-boundaries",
    "async-work-backpressure",
    "security-privacy",
    "cost-efficiency"
  ],
  "marketplace-checkout-inventory": [
    "api-event-contracts",
    "data-modeling",
    "storage-access-patterns",
    "consistency-transactions",
    "reliability-failure-isolation"
  ],
  "collaborative-document-editing": [
    "api-event-contracts",
    "consistency-transactions",
    "caching-contention",
    "partitioning-hotspots",
    "reliability-failure-isolation"
  ],
  "global-media-processing": [
    "capacity-estimation",
    "storage-access-patterns",
    "async-work-backpressure",
    "security-privacy",
    "cost-efficiency"
  ],
  "search-autocomplete-platform": [
    "storage-access-patterns",
    "caching-contention",
    "partitioning-hotspots",
    "observability-slos",
    "migration-evolution"
  ],
  "retrieval-augmented-support-assistant": [
    "requirements-framing",
    "data-modeling",
    "security-privacy",
    "observability-slos",
    "migration-evolution"
  ],
  "real-time-fraud-model-platform": [
    "capacity-estimation",
    "consistency-transactions",
    "reliability-failure-isolation",
    "observability-slos",
    "migration-evolution"
  ],
  "infinite-social-feed-client": [
    "capacity-estimation",
    "data-modeling",
    "consistency-transactions",
    "partitioning-hotspots",
    "observability-slos"
  ],
  "typeahead-search-client": [
    "capacity-estimation",
    "api-event-contracts",
    "caching-contention",
    "async-work-backpressure",
    "reliability-failure-isolation"
  ],
  "offline-field-inspection-app": [
    "storage-access-patterns",
    "consistency-transactions",
    "async-work-backpressure",
    "reliability-failure-isolation",
    "migration-evolution"
  ],
  "design-system-rollout": [
    "requirements-framing",
    "api-event-contracts",
    "component-boundaries",
    "cost-efficiency",
    "migration-evolution"
  ],
  "realtime-chat-web-client": [
    "api-event-contracts",
    "consistency-transactions",
    "async-work-backpressure",
    "partitioning-hotspots",
    "reliability-failure-isolation"
  ],
  "product-page-web-performance": [
    "capacity-estimation",
    "storage-access-patterns",
    "caching-contention",
    "partitioning-hotspots",
    "security-privacy"
  ],
  "clickstream-analytics-pipeline": [
    "capacity-estimation",
    "api-event-contracts",
    "consistency-transactions",
    "async-work-backpressure",
    "partitioning-hotspots"
  ],
  "cdc-lakehouse-replication": [
    "api-event-contracts",
    "data-modeling",
    "consistency-transactions",
    "reliability-failure-isolation",
    "migration-evolution"
  ],
  "daily-revenue-reporting": [
    "requirements-framing",
    "data-modeling",
    "storage-access-patterns",
    "consistency-transactions",
    "observability-slos"
  ],
  "data-quality-lineage-platform": [
    "api-event-contracts",
    "component-boundaries",
    "reliability-failure-isolation",
    "observability-slos",
    "security-privacy"
  ],
  "realtime-fraud-feature-pipeline": [
    "capacity-estimation",
    "consistency-transactions",
    "caching-contention",
    "partitioning-hotspots",
    "reliability-failure-isolation"
  ],
  "experiment-metrics-pipeline": [
    "requirements-framing",
    "data-modeling",
    "partitioning-hotspots",
    "observability-slos",
    "migration-evolution"
  ]
};

const TARGET_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  "multi-tenant-webhook-delivery": [
    "backend",
    "fullstack",
    "distributed systems",
    "webhooks",
    "queues",
    "idempotency",
    "multi-tenancy",
    "reliability"
  ],
  "high-volume-notification-platform": [
    "backend",
    "fullstack",
    "distributed systems",
    "notifications",
    "fan-out",
    "preferences",
    "regional reliability",
    "cost"
  ],
  "marketplace-checkout-inventory": [
    "backend",
    "fullstack",
    "payments",
    "ecommerce",
    "inventory",
    "transactions",
    "idempotency",
    "reconciliation"
  ],
  "collaborative-document-editing": [
    "backend",
    "fullstack",
    "websockets",
    "realtime",
    "collaboration",
    "offline sync",
    "conflict resolution",
    "distributed systems"
  ],
  "global-media-processing": [
    "backend",
    "fullstack",
    "object storage",
    "media",
    "uploads",
    "transcoding",
    "cdn",
    "workflow"
  ]
};

export function buildArchitectureDesignScenarioRankingCatalogue(
  artifacts: readonly ArchitectureDesignReviewArtifact[]
): readonly ArchitectureDesignScenarioRankingCandidate[] {
  return deepFreeze(
    architectureDesignScenarioRankingCandidateSchema.array().parse(
      artifacts.map((artifact) => ({
        key: artifact.scenario.key,
        version: 1,
        title: artifact.scenario.title,
        publicationStatus: artifact.humanReview.status === "approved" ? "published" : "review",
        architectureFamily: architectureFamilyFor(artifact.scenario.key),
        roles: artifact.scenario.roles,
        seniorities: artifact.scenario.seniorities,
        difficulties: artifact.scenario.difficulties,
        prerequisiteScenarioKeys: [],
        topicKeys: [artifact.scenario.primaryTopicKey, ...artifact.scenario.secondaryTopicKeys],
        dimensionKeys: artifact.scenario.dimensionKeys,
        emphasisDimensionKeys: emphasisDimensionsFor(artifact.scenario.key),
        targetKeywords: TARGET_KEYWORDS[artifact.scenario.key] ?? artifact.scenario.targetKeywords
      }))
    )
  );
}

/** Every scenario, including interview-only ones; used by the System Design interview. */
export const ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE = deepFreeze([
  ...buildArchitectureDesignScenarioRankingCatalogue(ARCHITECTURE_DESIGN_CONTENT_CANDIDATES),
  ...ARCHITECTURE_DESIGN_PROPOSED_RANKING_CANDIDATES
]);

/** What Practice may rank, list, and continue into: everything except interview-only cases. */
export const ARCHITECTURE_DESIGN_PRACTICE_RANKING_CATALOGUE = deepFreeze(
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
    (candidate) => !ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS.has(candidate.key)
  )
);

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function architectureFamilyFor(scenarioKey: string): ArchitectureDesignFamily {
  const family = ARCHITECTURE_FAMILIES[scenarioKey];
  if (!family) throw new Error(`Architecture scenario ${scenarioKey} has no architecture family`);
  return family;
}

function emphasisDimensionsFor(scenarioKey: string): readonly ArchitectureDesignDimension[] {
  const dimensions = EMPHASIS_DIMENSIONS[scenarioKey];
  if (!dimensions) {
    throw new Error(`Architecture scenario ${scenarioKey} has no emphasis dimensions`);
  }
  return dimensions;
}
