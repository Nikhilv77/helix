import { z } from "zod";

import { coreTechnicalDifficultySchema } from "./story-contracts";

export const CORE_TECHNICAL_GOLD_SET_VERSION = 1 as const;

const identifierSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const coreTechnicalGoldReviewSchema = z
  .object({
    status: z.enum(["candidate", "approved", "rejected"]),
    reviewerId: z.string().min(2).max(160).nullable(),
    reviewedAt: isoDateSchema.nullable(),
    notes: z.array(z.string().min(20).max(700)).min(1)
  })
  .superRefine((review, context) => {
    const attested = review.reviewerId !== null && review.reviewedAt !== null;
    if (review.status === "approved" && !attested) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Approved gold cases require a reviewer and review date"
      });
    }
    if (review.status === "candidate" && attested) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Candidate gold cases cannot contain an approval attestation"
      });
    }
  });

export const coreTechnicalGoldCaseSchema = z.object({
  goldSetVersion: z.literal(CORE_TECHNICAL_GOLD_SET_VERSION),
  key: identifierSchema,
  title: z.string().min(5).max(140),
  purpose: z.string().min(30).max(700),
  candidateContext: z.object({
    role: identifierSchema,
    seniority: z.enum(["junior", "mid", "senior", "staff"]),
    language: identifierSchema,
    runtime: identifierSchema,
    targetJob: z.string().min(2).max(160),
    baselineState: z.enum(["UNKNOWN", "GUIDED", "STANDARD", "STRETCH"]),
    weakMechanismKeys: z.array(identifierSchema),
    unassessedMechanismKeys: z.array(identifierSchema),
    recentTopicKeys: z.array(identifierSchema),
    excludedTopicKeys: z.array(identifierSchema)
  }),
  expected: z.object({
    storyTitle: z.string().min(5).max(100),
    difficulty: coreTechnicalDifficultySchema,
    stagePatternKeys: z.array(identifierSchema).length(6),
    requiredStoryTopicKeys: z.array(identifierSchema).min(1).max(4),
    requiredPrimaryMechanismKeys: z.array(identifierSchema).length(6),
    minimumConnectedStages: z.number().int().min(4).max(8),
    minimumUniqueArtifacts: z.number().int().min(4).max(8),
    expectedMinutes: z.object({
      minimum: z.number().int().min(30).max(50),
      maximum: z.number().int().min(30).max(50)
    }),
    rationale: z.array(z.string().min(20).max(700)).min(3)
  }),
  review: coreTechnicalGoldReviewSchema
});

export const coreTechnicalEvaluationMetricSchema = z.object({
  key: z.enum([
    "contract-validity",
    "stage-blueprint",
    "coverage",
    "story-quality",
    "question-integrity",
    "critic-approval",
    "public-safety"
  ]),
  earned: z.number().int().min(0),
  available: z.number().int().min(1),
  findings: z.array(z.string().min(2).max(700))
});

export const coreTechnicalGoldEvaluationReportSchema = z.object({
  goldSetVersion: z.literal(CORE_TECHNICAL_GOLD_SET_VERSION),
  caseKey: identifierSchema,
  qualityPassed: z.boolean(),
  releaseEligible: z.boolean(),
  humanReviewStatus: z.enum(["candidate", "approved", "rejected"]),
  totalScore: z.number().int().min(0).max(100),
  metrics: z.array(coreTechnicalEvaluationMetricSchema).length(7),
  hardFailures: z.array(z.string().min(2).max(700))
});

export const coreTechnicalGoldEvaluationSuiteReportSchema = z.object({
  goldSetVersion: z.literal(CORE_TECHNICAL_GOLD_SET_VERSION),
  qualityPassRate: z.number().int().min(0).max(100),
  allQualityPassed: z.boolean(),
  releaseEligible: z.boolean(),
  caseReports: z.array(coreTechnicalGoldEvaluationReportSchema).min(1)
});

export type CoreTechnicalGoldCase = z.infer<typeof coreTechnicalGoldCaseSchema>;
export type CoreTechnicalGoldEvaluationReport = z.infer<
  typeof coreTechnicalGoldEvaluationReportSchema
>;
export type CoreTechnicalGoldEvaluationSuiteReport = z.infer<
  typeof coreTechnicalGoldEvaluationSuiteReportSchema
>;
