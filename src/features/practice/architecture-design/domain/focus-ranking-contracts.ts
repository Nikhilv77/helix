import { z } from "zod";
import { architectureDesignBaselineEvidenceSchema } from "./baseline-evidence-contracts";
import {
  architectureDesignDifficultySchema,
  architectureDesignDimensionSchema,
  architectureDesignFamilySchema,
  architectureDesignFingerprintSchema,
  architectureDesignIdentifierSchema,
  architectureDesignRoleSchema,
  architectureDesignSenioritySchema
} from "./contracts";

export const ARCHITECTURE_DESIGN_FOCUS_SCHEMA_VERSION = 1 as const;
export const ARCHITECTURE_DESIGN_FIRST_SCENARIO_RANKING_POLICY_VERSION = 1 as const;
export const ARCHITECTURE_DESIGN_ADAPTIVE_SCENARIO_RANKING_POLICY_VERSION = 1 as const;

export const architectureDesignFocusConfirmationSchema = z
  .object({ path: z.literal("role-aligned") })
  .strict();

export const architectureDesignConfirmedFocusSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_FOCUS_SCHEMA_VERSION),
    focusFingerprint: architectureDesignFingerprintSchema,
    confirmedAt: z.string().datetime(),
    path: z.literal("role-aligned"),
    role: architectureDesignRoleSchema,
    seniority: architectureDesignSenioritySchema,
    targetJob: z.string().trim().min(2).max(160),
    targetCompany: z.string().trim().min(2).max(160).nullable(),
    targetDate: z.string().date().nullable(),
    excludedScenarioKeys: z.array(architectureDesignIdentifierSchema),
    resumeEvidence: z
      .object({
        architectureSkillKeys: z.array(architectureDesignIdentifierSchema),
        projectKeywords: z.array(z.string().trim().min(2).max(120))
      })
      .strict(),
    planEvidence: z
      .object({
        blueprintId: z.string().trim().min(1).max(180).nullable(),
        topicKeys: z.array(architectureDesignIdentifierSchema),
        skillKeys: z.array(architectureDesignIdentifierSchema)
      })
      .strict(),
    baselineEvidence: architectureDesignBaselineEvidenceSchema
  })
  .strict();

export const architectureDesignScenarioRankingCandidateSchema = z
  .object({
    key: architectureDesignIdentifierSchema,
    version: z.number().int().positive(),
    title: z.string().trim().min(5).max(120),
    publicationStatus: z.enum(["draft", "review", "published", "retired"]),
    architectureFamily: architectureDesignFamilySchema,
    roles: z.array(architectureDesignRoleSchema).min(1),
    seniorities: z.array(architectureDesignSenioritySchema).min(1),
    difficulties: z.array(architectureDesignDifficultySchema).min(1),
    prerequisiteScenarioKeys: z.array(architectureDesignIdentifierSchema),
    topicKeys: z.array(architectureDesignIdentifierSchema).min(1),
    dimensionKeys: z.array(architectureDesignDimensionSchema).min(1),
    emphasisDimensionKeys: z.array(architectureDesignDimensionSchema).min(2).max(8),
    targetKeywords: z.array(z.string().trim().min(2).max(80))
  })
  .strict()
  .superRefine((candidate, context) => {
    const covered = new Set(candidate.dimensionKeys);
    if (candidate.emphasisDimensionKeys.some((dimension) => !covered.has(dimension))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emphasisDimensionKeys"],
        message: "Ranking emphasis dimensions must be covered by the scenario rubric"
      });
    }
  });

export const architectureDesignScenarioScoreSchema = z
  .object({
    baselineGapTransfer: z.number().int().min(0).max(30),
    targetRoleJob: z.number().int().min(0).max(20),
    resumeProjectRelevance: z.number().int().min(0).max(15),
    dimensionCoverage: z.number().int().min(0).max(20),
    plannedCoverage: z.number().int().min(0).max(10),
    novelty: z.number().int().min(0).max(5),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const architectureDesignRankedScenarioSchema = z
  .object({
    scenarioKey: architectureDesignIdentifierSchema,
    scenarioVersion: z.number().int().positive(),
    title: z.string().trim().min(5).max(120),
    difficulty: architectureDesignDifficultySchema,
    emphasizedDimensionKeys: z.array(architectureDesignDimensionSchema),
    scores: architectureDesignScenarioScoreSchema
  })
  .strict();

export const architectureDesignFirstScenarioSelectionSchema = z
  .object({
    policyVersion: z.literal(ARCHITECTURE_DESIGN_FIRST_SCENARIO_RANKING_POLICY_VERSION),
    focusFingerprint: architectureDesignFingerprintSchema,
    selectedScenario: architectureDesignRankedScenarioSchema,
    rankings: z.array(architectureDesignRankedScenarioSchema).min(1),
    reason: z.string().trim().min(20).max(500)
  })
  .strict();

export const architectureDesignAdaptiveEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentScores: z
      .object({
        requirementsScope: z.number().int().min(0).max(100),
        apiDataCapacity: z.number().int().min(0).max(100),
        architectureTradeoffs: z.number().int().min(0).max(100),
        reliabilitySecurityOperability: z.number().int().min(0).max(100),
        communicationEvolution: z.number().int().min(0).max(100)
      })
      .strict(),
    practice: z
      .object({
        completedCount: z.number().int().min(0).max(4),
        learnedCount: z.number().int().min(0).max(4),
        meanVerifiedScore: z.number().min(0).max(10),
        hintsUsed: z.number().int().min(0).max(12),
        weakDimensionKeys: z.array(architectureDesignDimensionSchema),
        strongDimensionKeys: z.array(architectureDesignDimensionSchema)
      })
      .strict(),
    priorScenarioKeys: z.array(architectureDesignIdentifierSchema).min(1),
    priorTopicKeys: z.array(architectureDesignIdentifierSchema)
  })
  .strict();

export const architectureDesignAdaptiveScenarioScoreSchema = z
  .object({
    assessmentWeakness: z.number().int().min(0).max(30),
    practiceWeakness: z.number().int().min(0).max(25),
    targetRoleJob: z.number().int().min(0).max(15),
    dimensionCoverage: z.number().int().min(0).max(15),
    plannedCoverage: z.number().int().min(0).max(10),
    novelty: z.number().int().min(0).max(5),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const architectureDesignAdaptiveRankedScenarioSchema =
  architectureDesignRankedScenarioSchema.extend({
    scores: architectureDesignAdaptiveScenarioScoreSchema
  });

export const architectureDesignAdaptiveScenarioSelectionSchema = z
  .object({
    policyVersion: z.literal(ARCHITECTURE_DESIGN_ADAPTIVE_SCENARIO_RANKING_POLICY_VERSION),
    focusFingerprint: architectureDesignFingerprintSchema,
    evidence: architectureDesignAdaptiveEvidenceSchema,
    selectedScenario: architectureDesignAdaptiveRankedScenarioSchema,
    rankings: z.array(architectureDesignAdaptiveRankedScenarioSchema).min(1),
    reason: z.string().trim().min(20).max(600)
  })
  .strict();

export const architectureDesignScenarioSelectionSchema = z.union([
  architectureDesignFirstScenarioSelectionSchema,
  architectureDesignAdaptiveScenarioSelectionSchema
]);

export type ArchitectureDesignConfirmedFocus = z.infer<
  typeof architectureDesignConfirmedFocusSchema
>;
export type ArchitectureDesignScenarioRankingCandidate = z.infer<
  typeof architectureDesignScenarioRankingCandidateSchema
>;
export type ArchitectureDesignRankedScenario = z.infer<
  typeof architectureDesignRankedScenarioSchema
>;
export type ArchitectureDesignFirstScenarioSelection = z.infer<
  typeof architectureDesignFirstScenarioSelectionSchema
>;
export type ArchitectureDesignAdaptiveEvidence = z.infer<
  typeof architectureDesignAdaptiveEvidenceSchema
>;
export type ArchitectureDesignAdaptiveRankedScenario = z.infer<
  typeof architectureDesignAdaptiveRankedScenarioSchema
>;
export type ArchitectureDesignAdaptiveScenarioSelection = z.infer<
  typeof architectureDesignAdaptiveScenarioSelectionSchema
>;
export type ArchitectureDesignScenarioSelection = z.infer<
  typeof architectureDesignScenarioSelectionSchema
>;

export function publicArchitectureDesignConfirmedFocus(raw: unknown) {
  const focus = architectureDesignConfirmedFocusSchema.parse(raw);
  return {
    path: focus.path,
    role: focus.role,
    seniority: focus.seniority,
    targetJob: focus.targetJob,
    targetCompany: focus.targetCompany,
    targetDate: focus.targetDate,
    excludedScenarioKeys: focus.excludedScenarioKeys,
    baselineState: focus.baselineEvidence.state
  };
}
