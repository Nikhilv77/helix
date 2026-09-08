import { z } from "zod";
import { appliedEngineeringBaselineEvidenceSchema } from "./baseline-evidence-contracts";
import {
  appliedEngineeringDifficultySchema,
  appliedEngineeringFingerprintSchema,
  appliedEngineeringIdentifierSchema,
  appliedEngineeringProductionSignalSchema
} from "./contracts";

export const APPLIED_ENGINEERING_FOCUS_SCHEMA_VERSION = 1 as const;
export const APPLIED_ENGINEERING_FIRST_INCIDENT_RANKING_POLICY_VERSION = 1 as const;
export const APPLIED_ENGINEERING_ADAPTIVE_INCIDENT_RANKING_POLICY_VERSION = 1 as const;

export const appliedEngineeringConfirmedFocusSchema = z
  .object({
    schemaVersion: z.literal(APPLIED_ENGINEERING_FOCUS_SCHEMA_VERSION),
    focusFingerprint: appliedEngineeringFingerprintSchema,
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
        framework: appliedEngineeringIdentifierSchema.nullable()
      })
      .strict(),
    excludedIncidentKeys: z.array(appliedEngineeringIdentifierSchema),
    resumeEvidence: z
      .object({
        technologyKeys: z.array(appliedEngineeringIdentifierSchema),
        projectKeywords: z.array(z.string().trim().min(2).max(120)),
        productionSignalKeys: z.array(appliedEngineeringProductionSignalSchema)
      })
      .strict(),
    baselineEvidence: appliedEngineeringBaselineEvidenceSchema
  })
  .strict();

export const appliedEngineeringIncidentRankingCandidateSchema = z
  .object({
    key: appliedEngineeringIdentifierSchema,
    version: z.number().int().positive(),
    title: z.string().min(5).max(120),
    publicationStatus: z.enum(["review", "published", "retired"]),
    roles: z.array(z.enum(["backend", "fullstack"])).min(1),
    language: z.literal("javascript"),
    runtime: z.literal("nodejs"),
    runtimeVersion: z.literal("22 LTS"),
    frameworks: z.array(appliedEngineeringIdentifierSchema),
    difficulties: z.array(appliedEngineeringDifficultySchema).min(1),
    prerequisiteIncidentKeys: z.array(appliedEngineeringIdentifierSchema),
    topicKeys: z.array(appliedEngineeringIdentifierSchema).min(1),
    productionSignalKeys: z.array(appliedEngineeringProductionSignalSchema).min(1),
    targetKeywords: z.array(z.string().min(2).max(80))
  })
  .strict();

export const appliedEngineeringFirstIncidentScoreSchema = z
  .object({
    baselineGapTransfer: z.number().int().min(0).max(30),
    targetRoleJob: z.number().int().min(0).max(20),
    resumeProjectRelevance: z.number().int().min(0).max(15),
    productionEvidenceCoverage: z.number().int().min(0).max(20),
    plannedCoverage: z.number().int().min(0).max(10),
    novelty: z.number().int().min(0).max(5),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const appliedEngineeringRankedIncidentSchema = z
  .object({
    incidentKey: appliedEngineeringIdentifierSchema,
    incidentVersion: z.number().int().positive(),
    title: z.string().min(5).max(120),
    difficulty: appliedEngineeringDifficultySchema,
    emphasizedSignalKeys: z.array(appliedEngineeringProductionSignalSchema),
    scores: appliedEngineeringFirstIncidentScoreSchema
  })
  .strict();

export const appliedEngineeringFirstIncidentSelectionSchema = z
  .object({
    policyVersion: z.literal(APPLIED_ENGINEERING_FIRST_INCIDENT_RANKING_POLICY_VERSION),
    focusFingerprint: appliedEngineeringFingerprintSchema,
    selectedIncident: appliedEngineeringRankedIncidentSchema,
    rankings: z.array(appliedEngineeringRankedIncidentSchema).min(1),
    reason: z.string().min(20).max(420)
  })
  .strict();

export const appliedEngineeringAdaptiveEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentScores: z
      .object({
        diagnosisEvidence: z.number().int().min(0).max(100),
        implementationCorrectness: z.number().int().min(0).max(100),
        testingVerification: z.number().int().min(0).max(100),
        productionJudgment: z.number().int().min(0).max(100),
        ownershipDelivery: z.number().int().min(0).max(100)
      })
      .strict(),
    practice: z
      .object({
        completedCount: z.number().int().min(0).max(8),
        learnedCount: z.number().int().min(0).max(8),
        meanVerifiedScore: z.number().min(0).max(10),
        hintsUsed: z.number().int().min(0).max(24),
        acceptedCodeQuestionCount: z.number().int().min(0).max(2),
        weakTopicKeys: z.array(appliedEngineeringIdentifierSchema),
        weakSignalKeys: z.array(appliedEngineeringProductionSignalSchema)
      })
      .strict(),
    priorIncidentKeys: z.array(appliedEngineeringIdentifierSchema).min(1),
    priorTopicKeys: z.array(appliedEngineeringIdentifierSchema)
  })
  .strict();

export const appliedEngineeringAdaptiveIncidentScoreSchema = z
  .object({
    // Defaults preserve compatibility with first-release selection snapshots
    // while adaptive ranking records the richer weakness signals.
    assessmentWeakness: z.number().int().min(0).max(30).optional(),
    practiceWeakness: z.number().int().min(0).max(25).optional(),
    baselineGapTransfer: z.number().int().min(0).max(30).optional(),
    resumeProjectRelevance: z.number().int().min(0).max(15).optional(),
    targetRoleJob: z.number().int().min(0).max(15),
    productionEvidenceCoverage: z.number().int().min(0).max(15),
    plannedCoverage: z.number().int().min(0).max(10),
    novelty: z.number().int().min(0).max(5),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const appliedEngineeringAdaptiveRankedIncidentSchema = z
  .object({
    incidentKey: appliedEngineeringIdentifierSchema,
    incidentVersion: z.number().int().positive(),
    title: z.string().min(5).max(120),
    difficulty: appliedEngineeringDifficultySchema,
    emphasizedSignalKeys: z.array(appliedEngineeringProductionSignalSchema),
    scores: appliedEngineeringAdaptiveIncidentScoreSchema
  })
  .strict();

export const appliedEngineeringAdaptiveIncidentSelectionSchema = z
  .object({
    policyVersion: z.literal(APPLIED_ENGINEERING_ADAPTIVE_INCIDENT_RANKING_POLICY_VERSION),
    focusFingerprint: appliedEngineeringFingerprintSchema,
    evidence: appliedEngineeringAdaptiveEvidenceSchema,
    selectedIncident: appliedEngineeringAdaptiveRankedIncidentSchema,
    rankings: z.array(appliedEngineeringAdaptiveRankedIncidentSchema).min(1),
    reason: z.string().min(20).max(500)
  })
  .strict();

export const appliedEngineeringIncidentSelectionSchema = z.union([
  appliedEngineeringFirstIncidentSelectionSchema,
  appliedEngineeringAdaptiveIncidentSelectionSchema
]);

export type AppliedEngineeringConfirmedFocus = z.infer<
  typeof appliedEngineeringConfirmedFocusSchema
>;
export type AppliedEngineeringIncidentRankingCandidate = z.infer<
  typeof appliedEngineeringIncidentRankingCandidateSchema
>;
export type AppliedEngineeringRankedIncident = z.infer<
  typeof appliedEngineeringRankedIncidentSchema
>;
export type AppliedEngineeringFirstIncidentSelection = z.infer<
  typeof appliedEngineeringFirstIncidentSelectionSchema
>;
export type AppliedEngineeringAdaptiveEvidence = z.infer<
  typeof appliedEngineeringAdaptiveEvidenceSchema
>;
export type AppliedEngineeringAdaptiveIncidentSelection = z.infer<
  typeof appliedEngineeringAdaptiveIncidentSelectionSchema
>;
export type AppliedEngineeringAdaptiveRankedIncident = z.infer<
  typeof appliedEngineeringAdaptiveRankedIncidentSchema
>;
export type AppliedEngineeringIncidentSelection = z.infer<
  typeof appliedEngineeringIncidentSelectionSchema
>;

export function publicAppliedEngineeringConfirmedFocus(raw: unknown) {
  const focus = appliedEngineeringConfirmedFocusSchema.parse(raw);
  return {
    role: focus.role,
    seniority: focus.seniority,
    targetJob: focus.targetJob,
    targetCompany: focus.targetCompany,
    targetDate: focus.targetDate,
    stack: focus.stack,
    excludedIncidentKeys: focus.excludedIncidentKeys,
    baselineState: focus.baselineEvidence.state
  };
}
