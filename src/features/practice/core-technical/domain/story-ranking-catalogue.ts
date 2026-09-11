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
        key: "javascript-values-copying-mutation",
        version: 2,
        title: "Trace and fix shared JavaScript state",
        publicationStatus: "published",
        roles: ["backend", "fullstack"],
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        frameworks: [],
        difficulties: ["guided", "standard", "stretch"],
        prerequisiteStoryKeys: [],
        topicKeys: ["javascript-values-and-mutation"],
        mechanismKeys: [
          "reference-identity",
          "shallow-copy",
          "property-copy",
          "structured-clone",
          "shared-mutation",
          "mutation-boundary",
          "copy-on-write",
          "defensive-copy"
        ],
        targetKeywords: ["backend", "fullstack", "javascript", "typescript", "node", "api"]
      },
      {
        key: "javascript-scope-closures-retained-state",
        version: 2,
        title: "Trace and fix retained JavaScript state",
        publicationStatus: "published",
        roles: ["backend", "fullstack"],
        language: "javascript",
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        frameworks: [],
        difficulties: ["guided", "standard", "stretch"],
        prerequisiteStoryKeys: ["javascript-values-copying-mutation"],
        topicKeys: ["javascript-scope-and-closures"],
        mechanismKeys: [
          "lexical-scope",
          "loop-binding",
          "closure",
          "module-state",
          "garbage-collection-roots",
          "listener-cleanup",
          "encapsulated-state",
          "state-ownership"
        ],
        targetKeywords: ["backend", "fullstack", "javascript", "typescript", "node", "memory"]
      }
    ])
  );

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
