import {
  appliedEngineeringIncidentRankingCandidateSchema,
  type AppliedEngineeringIncidentRankingCandidate
} from "./focus-ranking-contracts";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "./reviewed-incidents";

const TARGET_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  "duplicate-work-after-retry": [
    "backend",
    "fullstack",
    "node",
    "api",
    "payment",
    "checkout",
    "order",
    "queue",
    "retry",
    "database"
  ],
  "latency-cascade-under-load": [
    "backend",
    "fullstack",
    "senior",
    "node",
    "api",
    "performance",
    "latency",
    "database",
    "cache",
    "observability"
  ]
};

/**
 * Ranking metadata is derived from the reviewed artifact so incident content
 * and compatibility gates cannot silently drift apart. Candidate artifacts
 * remain REVIEW-only until an explicit owner attestation is present.
 */
export const NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE: readonly AppliedEngineeringIncidentRankingCandidate[] =
  deepFreeze(
    appliedEngineeringIncidentRankingCandidateSchema.array().parse(
      APPLIED_ENGINEERING_REVIEW_CANDIDATES.map((artifact) => ({
        key: artifact.incident.key,
        version: 1,
        title: artifact.incident.title,
        publicationStatus: artifact.humanReview.status === "approved" ? "published" : "review",
        roles: ["backend", "fullstack"],
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        frameworks: [],
        difficulties: [artifact.incident.difficulty],
        prerequisiteIncidentKeys: artifact.incident.prerequisiteIncidentKeys,
        topicKeys: [artifact.incident.primaryTopicKey, ...artifact.incident.secondaryTopicKeys],
        productionSignalKeys: artifact.incident.productionSignalKeys,
        targetKeywords: TARGET_KEYWORDS[artifact.incident.key] ?? []
      }))
    )
  );

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
