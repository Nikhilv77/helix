import {
  architectureDesignScenarioRankingCandidateSchema,
  type ArchitectureDesignScenarioRankingCandidate
} from "./focus-ranking-contracts";
import type { ArchitectureDesignDimension, ArchitectureDesignFamily } from "./contracts";
import type { ArchitectureDesignReviewArtifact } from "./review-artifact-contracts";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";
import { ARCHITECTURE_DESIGN_PROPOSED_RANKING_CANDIDATES } from "./scenario-briefs";

const ARCHITECTURE_FAMILIES: Readonly<Record<string, ArchitectureDesignFamily>> = {
  "multi-tenant-webhook-delivery": "asynchronous-delivery",
  "high-volume-notification-platform": "asynchronous-delivery",
  "marketplace-checkout-inventory": "transactional-workflow",
  "collaborative-document-editing": "realtime-collaboration",
  "global-media-processing": "media-storage-delivery",
  "search-autocomplete-platform": "search-indexing"
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

export const ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE = deepFreeze([
  ...buildArchitectureDesignScenarioRankingCatalogue(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES),
  ...ARCHITECTURE_DESIGN_PROPOSED_RANKING_CANDIDATES
]);

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
