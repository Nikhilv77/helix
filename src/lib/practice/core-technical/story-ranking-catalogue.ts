import {
  coreTechnicalStoryRankingCandidateSchema,
  type CoreTechnicalStoryRankingCandidate
} from "./focus-ranking-contracts";

/**
 * These are release-approved ranking definitions, not mutable question blocks.
 * Database publication remains a separate fail-closed gate checked by the
 * eligibility and preparation services.
 */
export const NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE: readonly CoreTechnicalStoryRankingCandidate[] =
  deepFreeze(
    coreTechnicalStoryRankingCandidateSchema.array().parse([
      {
        key: "follow-the-operation",
        version: 1,
        title: "Follow the operation",
        publicationStatus: "published",
        roles: ["backend", "fullstack"],
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        frameworks: [],
        difficulties: ["guided", "standard", "stretch"],
        prerequisiteStoryKeys: [],
        topicKeys: [
          "async-scheduling",
          "javascript-values-and-mutation",
          "javascript-scope-and-closures",
          "errors-and-cancellation"
        ],
        mechanismKeys: [
          "event-loop",
          "reference-identity",
          "lexical-scope",
          "promise-rejection",
          "resource-cleanup"
        ],
        targetKeywords: ["backend", "fullstack", "javascript", "node", "api", "request"]
      },
      {
        key: "the-operation-fails-halfway",
        version: 1,
        title: "The operation fails halfway",
        publicationStatus: "published",
        roles: ["backend", "fullstack"],
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        frameworks: [],
        difficulties: ["guided", "standard", "stretch"],
        prerequisiteStoryKeys: [],
        topicKeys: [
          "errors-and-cancellation",
          "nodejs-streams-and-io",
          "nodejs-event-loop-health",
          "async-scheduling"
        ],
        mechanismKeys: [
          "promise-rejection",
          "abort-signal",
          "resource-cleanup",
          "backpressure",
          "promise-concurrency",
          "event-loop-lag"
        ],
        targetKeywords: ["backend", "senior", "reliability", "node", "api", "production"]
      }
    ])
  );

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
