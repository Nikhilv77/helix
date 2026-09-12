import { z } from "zod";
import {
  ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
  architectureDesignDifficultySchema,
  architectureDesignDimensionSchema,
  architectureDesignFamilySchema,
  architectureDesignIdentifierSchema,
  architectureDesignRoleSchema,
  architectureDesignSenioritySchema
} from "./contracts";
import {
  architectureDesignScenarioRankingCandidateSchema,
  type ArchitectureDesignScenarioRankingCandidate
} from "./focus-ranking-contracts";

const meaningfulTextSchema = z.string().trim().min(20).max(2_000);

/**
 * A frozen content brief is catalogue metadata, not a reviewed scenario artifact.
 * Drafts have no questions or private evaluation material and can never be published directly.
 */
export const architectureDesignScenarioBriefSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION),
    version: z.number().int().positive(),
    publicationStatus: z.enum(["draft", "review"]),
    key: architectureDesignIdentifierSchema,
    title: z.string().trim().min(5).max(120),
    architectureFamily: architectureDesignFamilySchema,
    premise: meaningfulTextSchema,
    candidateRole: meaningfulTextSchema,
    functionalRequirements: z.array(meaningfulTextSchema).min(2).max(8),
    nonGoals: z.array(meaningfulTextSchema).min(1).max(6),
    constraints: z.array(meaningfulTextSchema).min(2).max(8),
    scaleProfile: z.array(meaningfulTextSchema).min(2).max(8),
    roles: z.array(architectureDesignRoleSchema).min(1),
    seniorities: z.array(architectureDesignSenioritySchema).min(1),
    difficulties: z.array(architectureDesignDifficultySchema).min(1),
    primaryTopicKey: architectureDesignIdentifierSchema,
    secondaryTopicKeys: z.array(architectureDesignIdentifierSchema).min(1).max(6),
    dimensionKeys: z.array(architectureDesignDimensionSchema).length(16),
    emphasisDimensionKeys: z.array(architectureDesignDimensionSchema).min(2).max(8),
    targetKeywords: z.array(z.string().trim().min(2).max(80)).min(2).max(16)
  })
  .strict()
  .superRefine((brief, context) => {
    if (new Set(brief.dimensionKeys).size !== architectureDesignDimensionSchema.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensionKeys"],
        message: "Every Architecture scenario brief must plan coverage of all sixteen dimensions"
      });
    }
    if (brief.secondaryTopicKeys.includes(brief.primaryTopicKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryTopicKeys"],
        message: "The primary scenario topic cannot also be secondary"
      });
    }
  });

export type ArchitectureDesignScenarioBrief = z.infer<typeof architectureDesignScenarioBriefSchema>;

export const ARCHITECTURE_DESIGN_PROPOSED_SCENARIO_BRIEFS = deepFreeze(
  architectureDesignScenarioBriefSchema.array().parse([])
);

export const ARCHITECTURE_DESIGN_PROPOSED_RANKING_CANDIDATES = deepFreeze(
  architectureDesignScenarioRankingCandidateSchema.array().parse(
    ARCHITECTURE_DESIGN_PROPOSED_SCENARIO_BRIEFS.map((brief) => ({
      key: brief.key,
      version: brief.version,
      title: brief.title,
      publicationStatus: brief.publicationStatus,
      architectureFamily: brief.architectureFamily,
      roles: brief.roles,
      seniorities: brief.seniorities,
      difficulties: brief.difficulties,
      prerequisiteScenarioKeys: [],
      topicKeys: [brief.primaryTopicKey, ...brief.secondaryTopicKeys],
      dimensionKeys: brief.dimensionKeys,
      emphasisDimensionKeys: brief.emphasisDimensionKeys,
      targetKeywords: brief.targetKeywords
    }))
  )
) satisfies readonly ArchitectureDesignScenarioRankingCandidate[];

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
