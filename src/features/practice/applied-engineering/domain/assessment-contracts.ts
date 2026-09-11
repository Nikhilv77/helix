import { z } from "zod";
import {
  appliedEngineeringAdaptiveIncidentSelectionSchema,
  appliedEngineeringIncidentSelectionSchema
} from "./focus-ranking-contracts";
import {
  appliedEngineeringFingerprintSchema,
  appliedEngineeringIdentifierSchema
} from "./contracts";

export const APPLIED_ENGINEERING_ASSESSMENT_SCHEMA_VERSION = 1 as const;
export const APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION =
  "applied-engineering-assessment-blueprint-v1";
export const APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION =
  "applied-engineering-assessment-evaluator-v1";
export const APPLIED_ENGINEERING_ASSESSMENT_SCORING_VERSION =
  "applied-engineering-assessment-scoring-v1";

const boundedTextSchema = z.string().trim().min(1).max(12_000);
const assessmentAnswerSchema = z.string().trim().min(4).max(4_000);

export const appliedEngineeringAssessmentPromptKindSchema = z.enum([
  "evidence-defence",
  "repair-defence",
  "unseen-diagnosis-transfer",
  "verification-transfer",
  "rollout-defence"
]);

export const appliedEngineeringPublicAssessmentPromptSchema = z
  .object({
    id: appliedEngineeringIdentifierSchema,
    order: z.number().int().min(1).max(5),
    kind: appliedEngineeringAssessmentPromptKindSchema,
    prompt: z.string().min(20).max(4_000),
    context: z.string().min(8).max(4_000).nullable()
  })
  .strict();

const privateAssessmentPromptSchema = appliedEngineeringPublicAssessmentPromptSchema
  .extend({
    privateEvaluation: z
      .object({
        sourceQuestionId: z.string().uuid(),
        sourceQuestionFingerprint: appliedEngineeringFingerprintSchema,
        expectedAnswer: z.string().min(8).max(4_000),
        rubric: z
          .array(
            z
              .object({
                criterion: z.string().min(8).max(4_000),
                points: z.number().int().min(1).max(10)
              })
              .strict()
          )
          .min(1)
          .max(6),
        deterministicEvidence: z.enum(["accepted-run-required", "practice-evidence", "none"])
      })
      .strict()
  })
  .strict();

export const appliedEngineeringAssessmentResponseSchema = z
  .object({ promptId: appliedEngineeringIdentifierSchema, answer: assessmentAnswerSchema })
  .strict();

export const appliedEngineeringAssessmentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(APPLIED_ENGINEERING_ASSESSMENT_SCHEMA_VERSION),
    blueprintVersion: z.literal(APPLIED_ENGINEERING_ASSESSMENT_BLUEPRINT_VERSION),
    preparedAt: z.string().datetime(),
    blockContentFingerprint: appliedEngineeringFingerprintSchema,
    sourceSelection: appliedEngineeringIncidentSelectionSchema,
    prompts: z.array(privateAssessmentPromptSchema).length(5),
    submission: z
      .object({
        requestId: z.string().uuid(),
        responseFingerprint: appliedEngineeringFingerprintSchema,
        responses: z.array(appliedEngineeringAssessmentResponseSchema).length(5),
        submittedAt: z.string().datetime()
      })
      .strict()
      .optional()
  })
  .strict();

export const appliedEngineeringAssessmentStartInputSchema = z
  .object({ assessmentId: z.string().uuid(), requestId: z.string().uuid() })
  .strict();

export const appliedEngineeringAssessmentFinalizeInputSchema = z
  .object({
    assessmentId: z.string().uuid(),
    requestId: z.string().uuid(),
    responses: z.array(appliedEngineeringAssessmentResponseSchema).length(5)
  })
  .strict();

export const appliedEngineeringAssessmentScoresSchema = z
  .object({
    diagnosisEvidence: z.number().int().min(0).max(100),
    implementationCorrectness: z.number().int().min(0).max(100),
    testingVerification: z.number().int().min(0).max(100),
    productionJudgment: z.number().int().min(0).max(100),
    ownershipDelivery: z.number().int().min(0).max(100)
  })
  .strict();

export const appliedEngineeringAssessmentEvaluationSchema = z
  .object({
    scores: appliedEngineeringAssessmentScoresSchema,
    teacherSummary: z.string().trim().min(20).max(1_200),
    strengths: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    improvementAreas: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    promptFeedback: z
      .array(
        z
          .object({
            promptId: appliedEngineeringIdentifierSchema,
            score: z.number().int().min(0).max(100),
            feedback: z.string().trim().min(8).max(500)
          })
          .strict()
      )
      .length(5)
  })
  .strict();

export const appliedEngineeringContinuationDecisionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("continue"), next: appliedEngineeringAdaptiveIncidentSelectionSchema })
    .strict(),
  z
    .object({
      kind: z.literal("ready"),
      masteredKeys: z.array(appliedEngineeringIdentifierSchema),
      summary: z.string().min(20).max(700)
    })
    .strict(),
  z.object({ kind: z.literal("complete"), summary: z.string().min(20).max(700) }).strict()
]);

export const appliedEngineeringAssessmentReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    evaluatorVersion: z.literal(APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION),
    scoringVersion: z.literal(APPLIED_ENGINEERING_ASSESSMENT_SCORING_VERSION),
    finalizedAt: z.string().datetime(),
    scores: appliedEngineeringAssessmentScoresSchema,
    overallScore: z.number().int().min(0).max(100),
    teacherSummary: z.string().min(20).max(1_200),
    strengths: z.array(z.string().min(4).max(300)).min(1).max(5),
    improvementAreas: z.array(z.string().min(4).max(300)).min(1).max(5),
    promptFeedback: z
      .array(
        z
          .object({
            promptId: appliedEngineeringIdentifierSchema,
            score: z.number().int().min(0).max(100),
            feedback: z.string().min(8).max(500)
          })
          .strict()
      )
      .length(5),
    solvedVsLearned: z
      .object({
        completedCount: z.number().int().min(0).max(8),
        learnedCount: z.number().int().min(0).max(8),
        learnedQuestionOrders: z.array(z.number().int().min(1).max(8)),
        masteryCreditNote: z.string().min(20).max(400)
      })
      .strict(),
    deterministicEvidence: z
      .object({
        acceptedCodeQuestionCount: z.number().int().min(0).max(2),
        totalCodeQuestionCount: z.literal(2),
        implementationScoreCapped: z.boolean()
      })
      .strict(),
    nextIncident: appliedEngineeringAdaptiveIncidentSelectionSchema.optional(),
    continuation: appliedEngineeringContinuationDecisionSchema.optional()
  })
  .strict()
  .superRefine((report, context) => {
    if (!report.nextIncident && !report.continuation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A report requires a next incident or terminal continuation decision."
      });
    }
  });

export const appliedEngineeringSafeTranscriptSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentId: z.string().uuid(),
    blockId: z.string().uuid(),
    entries: z
      .array(
        z
          .object({
            promptId: appliedEngineeringIdentifierSchema,
            order: z.number().int().min(1).max(5),
            kind: appliedEngineeringAssessmentPromptKindSchema,
            prompt: z.string().min(20).max(4_000),
            answer: boundedTextSchema
          })
          .strict()
      )
      .length(5)
  })
  .strict();

export const appliedEngineeringContinueInputSchema = z
  .object({ blockId: z.string().uuid(), requestId: z.string().uuid() })
  .strict();

export type AppliedEngineeringAssessmentSnapshot = z.infer<
  typeof appliedEngineeringAssessmentSnapshotSchema
>;
export type AppliedEngineeringAssessmentEvaluation = z.infer<
  typeof appliedEngineeringAssessmentEvaluationSchema
>;
export type AppliedEngineeringAssessmentReport = z.infer<
  typeof appliedEngineeringAssessmentReportSchema
>;
export type AppliedEngineeringSafeTranscript = z.infer<
  typeof appliedEngineeringSafeTranscriptSchema
>;

export function publicAppliedEngineeringAssessmentSnapshot(raw: unknown) {
  const snapshot = appliedEngineeringAssessmentSnapshotSchema.parse(raw);
  return {
    schemaVersion: snapshot.schemaVersion,
    blueprintVersion: snapshot.blueprintVersion,
    preparedAt: snapshot.preparedAt,
    prompts: snapshot.prompts.map(({ id, order, kind, prompt, context }) => ({
      id,
      order,
      kind,
      prompt,
      context
    })),
    submission: snapshot.submission
      ? {
          requestId: snapshot.submission.requestId,
          responses: snapshot.submission.responses,
          submittedAt: snapshot.submission.submittedAt
        }
      : null
  };
}
