import {
  architectureDesignScenarioRankingCandidateSchema,
  type ArchitectureDesignScenarioRankingCandidate
} from "./focus-ranking-contracts";
import type { ArchitectureDesignReviewArtifact } from "./review-artifact-contracts";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";

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
        roles: artifact.scenario.roles,
        seniorities: artifact.scenario.seniorities,
        difficulties: artifact.scenario.difficulties,
        prerequisiteScenarioKeys: [],
        topicKeys: [artifact.scenario.primaryTopicKey, ...artifact.scenario.secondaryTopicKeys],
        dimensionKeys: artifact.scenario.dimensionKeys,
        targetKeywords: TARGET_KEYWORDS[artifact.scenario.key] ?? []
      }))
    )
  );
}

export const ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE =
  buildArchitectureDesignScenarioRankingCatalogue(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES);

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
