import { z } from "zod";
import { coreTechnicalBaselineEvidenceSchema } from "./baseline-evidence-contracts";
import { coreTechnicalDifficultySchema } from "./story-contracts";
import { coreTechnicalTechnologySchema } from "./technology-focus";

export const CORE_TECHNICAL_FOCUS_SCHEMA_VERSION = 1 as const;
export const CORE_TECHNICAL_FIRST_STORY_RANKING_POLICY_VERSION = 1 as const;
export const CORE_TECHNICAL_ADAPTIVE_STORY_RANKING_POLICY_VERSION = 2 as const;

const identifierSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const coreTechnicalConfirmedFocusSchema = z
  .object({
    schemaVersion: z.literal(CORE_TECHNICAL_FOCUS_SCHEMA_VERSION),
    focusFingerprint: fingerprintSchema,
    confirmedAt: z.string().datetime(),
    role: z.enum(["backend", "fullstack"]),
    seniority: z.enum(["junior", "mid", "senior"]),
    targetJob: z.string().min(2).max(160),
    targetCompany: z.string().min(2).max(160).nullable(),
    targetDate: z.string().date().nullable(),
    stack: z
      .object({
        language: z.literal("javascript"),
        runtime: z.literal("nodejs"),
        runtimeVersion: z.literal("22 LTS"),
        framework: identifierSchema.nullable(),
        /** Optional for snapshots created before personalized technology selection. */
        technology: coreTechnicalTechnologySchema.optional()
      })
      .strict(),
    excludedTopicKeys: z.array(identifierSchema),
    resumeEvidence: z
      .object({
        topicKeys: z.array(identifierSchema),
        mechanismKeys: z.array(identifierSchema)
      })
      .strict(),
    baselineEvidence: coreTechnicalBaselineEvidenceSchema
  })
  .strict();

export const coreTechnicalStoryRankingCandidateSchema = z
  .object({
    key: identifierSchema,
    version: z.number().int().positive(),
    title: z.string().min(5).max(100),
    publicationStatus: z.enum(["review", "published", "retired"]),
    roles: z.array(z.enum(["backend", "fullstack"])).min(1),
    language: z.literal("javascript"),
    runtime: z.literal("nodejs"),
    runtimeVersion: z.literal("22 LTS"),
    frameworks: z.array(identifierSchema),
    difficulties: z.array(coreTechnicalDifficultySchema).min(1),
    prerequisiteStoryKeys: z.array(identifierSchema),
    topicKeys: z.array(identifierSchema).min(1),
    mechanismKeys: z.array(identifierSchema).min(1),
    targetKeywords: z.array(z.string().min(2).max(80))
  })
  .strict();

export const coreTechnicalFirstStoryScoreSchema = z
  .object({
    baselineGapTransfer: z.number().int().min(0).max(35),
    targetRoleJob: z.number().int().min(0).max(25),
    resumeProjectRelevance: z.number().int().min(0).max(15),
    plannedCoverage: z.number().int().min(0).max(15),
    storyDiversity: z.number().int().min(0).max(10),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const coreTechnicalRankedStorySchema = z
  .object({
    storyKey: identifierSchema,
    storyVersion: z.number().int().positive(),
    title: z.string().min(5).max(100),
    difficulty: coreTechnicalDifficultySchema,
    emphasizedConceptKeys: z.array(identifierSchema),
    scores: coreTechnicalFirstStoryScoreSchema
  })
  .strict();

export const coreTechnicalFirstStorySelectionSchema = z
  .object({
    policyVersion: z.literal(CORE_TECHNICAL_FIRST_STORY_RANKING_POLICY_VERSION),
    focusFingerprint: fingerprintSchema,
    selectedStory: coreTechnicalRankedStorySchema,
    rankings: z.array(coreTechnicalRankedStorySchema).min(1),
    reason: z.string().min(20).max(320)
  })
  .strict();

export const coreTechnicalAdaptiveEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentScores: z
      .object({
        technicalAccuracy: z.number().int().min(0).max(100),
        mechanismReasoning: z.number().int().min(0).max(100),
        diagnosisEvidence: z.number().int().min(0).max(100),
        debuggingImplementation: z.number().int().min(0).max(100),
        communicationProduction: z.number().int().min(0).max(100)
      })
      .strict(),
    practice: z
      .object({
        completedCount: z.number().int().min(0).max(8),
        learnedCount: z.number().int().min(0).max(8),
        meanVerifiedScore: z.number().min(0).max(10),
        hintsUsed: z.number().int().min(0).max(24),
        acceptedCodeQuestionCount: z.number().int().min(0).max(2),
        totalCodeQuestionCount: z.number().int().min(0).max(2),
        weakTopicKeys: z.array(identifierSchema),
        weakMechanismKeys: z.array(identifierSchema)
      })
      .strict(),
    priorStoryKeys: z.array(identifierSchema).min(1),
    priorTopicKeys: z.array(identifierSchema)
  })
  .strict();

export const coreTechnicalAdaptiveStoryScoreSchema = z
  .object({
    assessmentWeakness: z.number().int().min(0).max(30),
    practiceWeakness: z.number().int().min(0).max(25),
    targetRoleJob: z.number().int().min(0).max(20),
    plannedCoverage: z.number().int().min(0).max(15),
    novelty: z.number().int().min(0).max(10),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const coreTechnicalAdaptiveRankedStorySchema = z
  .object({
    storyKey: identifierSchema,
    storyVersion: z.number().int().positive(),
    title: z.string().min(5).max(100),
    difficulty: coreTechnicalDifficultySchema,
    emphasizedConceptKeys: z.array(identifierSchema),
    scores: coreTechnicalAdaptiveStoryScoreSchema
  })
  .strict();

export const coreTechnicalAdaptiveStorySelectionSchema = z
  .object({
    policyVersion: z.literal(CORE_TECHNICAL_ADAPTIVE_STORY_RANKING_POLICY_VERSION),
    focusFingerprint: fingerprintSchema,
    evidence: coreTechnicalAdaptiveEvidenceSchema,
    selectedStory: coreTechnicalAdaptiveRankedStorySchema,
    rankings: z.array(coreTechnicalAdaptiveRankedStorySchema).min(1),
    reason: z.string().min(20).max(420)
  })
  .strict();

export const coreTechnicalStorySelectionSchema = z.union([
  coreTechnicalFirstStorySelectionSchema,
  coreTechnicalAdaptiveStorySelectionSchema
]);

export type CoreTechnicalConfirmedFocus = z.infer<typeof coreTechnicalConfirmedFocusSchema>;
export type CoreTechnicalStoryRankingCandidate = z.infer<
  typeof coreTechnicalStoryRankingCandidateSchema
>;
export type CoreTechnicalRankedStory = z.infer<typeof coreTechnicalRankedStorySchema>;
export type CoreTechnicalFirstStorySelection = z.infer<
  typeof coreTechnicalFirstStorySelectionSchema
>;
export type CoreTechnicalAdaptiveEvidence = z.infer<typeof coreTechnicalAdaptiveEvidenceSchema>;
export type CoreTechnicalAdaptiveStorySelection = z.infer<
  typeof coreTechnicalAdaptiveStorySelectionSchema
>;
export type CoreTechnicalStorySelection = z.infer<typeof coreTechnicalStorySelectionSchema>;

export function publicCoreTechnicalConfirmedFocus(raw: unknown) {
  const focus = coreTechnicalConfirmedFocusSchema.parse(raw);
  return {
    role: focus.role,
    seniority: focus.seniority,
    targetJob: focus.targetJob,
    targetCompany: focus.targetCompany,
    targetDate: focus.targetDate,
    stack: focus.stack,
    excludedTopicKeys: focus.excludedTopicKeys,
    baselineState: focus.baselineEvidence.state
  };
}
