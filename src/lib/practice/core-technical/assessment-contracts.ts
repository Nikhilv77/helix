import { z } from "zod";
import { coreTechnicalAdaptiveStorySelectionSchema } from "./focus-ranking-contracts";

export const CORE_TECHNICAL_ASSESSMENT_SCHEMA_VERSION = 1 as const;
export const CORE_TECHNICAL_ASSESSMENT_BLUEPRINT_VERSION = "core-technical-assessment-blueprint-v1";
export const CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION = "core-technical-assessment-evaluator-v1";
export const CORE_TECHNICAL_ASSESSMENT_SCORING_VERSION = "core-technical-assessment-scoring-v1";

const identifierSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const boundedTextSchema = z.string().trim().min(1).max(12_000);
const assessmentAnswerSchema = z.string().trim().min(4).max(4_000);

export const coreTechnicalAssessmentPromptKindSchema = z.enum([
  "weak-response-review",
  "code-evidence-defence",
  "unseen-diagnosis-transfer",
  "repair-implementation-transfer",
  "production-verification-defence"
]);

export const coreTechnicalPublicAssessmentPromptSchema = z
  .object({
    id: identifierSchema,
    order: z.number().int().min(1).max(5),
    kind: coreTechnicalAssessmentPromptKindSchema,
    prompt: z.string().min(20).max(4_000),
    context: z.string().min(8).max(4_000).nullable()
  })
  .strict();

const privateAssessmentPromptSchema = coreTechnicalPublicAssessmentPromptSchema
  .extend({
    privateEvaluation: z
      .object({
        sourceQuestionId: z.string().uuid(),
        sourceQuestionFingerprint: fingerprintSchema,
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

export const coreTechnicalAssessmentResponseSchema = z
  .object({
    promptId: identifierSchema,
    answer: assessmentAnswerSchema
  })
  .strict();

export const coreTechnicalAssessmentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CORE_TECHNICAL_ASSESSMENT_SCHEMA_VERSION),
    blueprintVersion: z.literal(CORE_TECHNICAL_ASSESSMENT_BLUEPRINT_VERSION),
    preparedAt: z.string().datetime(),
    blockContentFingerprint: fingerprintSchema,
    prompts: z.array(privateAssessmentPromptSchema).length(5),
    submission: z
      .object({
        requestId: z.string().uuid(),
        responseFingerprint: fingerprintSchema,
        responses: z.array(coreTechnicalAssessmentResponseSchema).length(5),
        submittedAt: z.string().datetime()
      })
      .strict()
      .optional()
  })
  .strict();

export const coreTechnicalAssessmentStartInputSchema = z
  .object({
    assessmentId: z.string().uuid(),
    requestId: z.string().uuid()
  })
  .strict();

export const coreTechnicalAssessmentFinalizeInputSchema = z
  .object({
    assessmentId: z.string().uuid(),
    requestId: z.string().uuid(),
    responses: z.array(coreTechnicalAssessmentResponseSchema).length(5)
  })
  .strict();

export const coreTechnicalAssessmentScoresSchema = z
  .object({
    technicalAccuracy: z.number().int().min(0).max(100),
    mechanismReasoning: z.number().int().min(0).max(100),
    diagnosisEvidence: z.number().int().min(0).max(100),
    debuggingImplementation: z.number().int().min(0).max(100),
    communicationProduction: z.number().int().min(0).max(100)
  })
  .strict();

export const coreTechnicalAssessmentEvaluationSchema = z
  .object({
    scores: coreTechnicalAssessmentScoresSchema,
    teacherSummary: z.string().trim().min(20).max(1_200),
    strengths: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    improvementAreas: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    promptFeedback: z
      .array(
        z
          .object({
            promptId: identifierSchema,
            score: z.number().int().min(0).max(100),
            feedback: z.string().trim().min(8).max(500)
          })
          .strict()
      )
      .length(5)
  })
  .strict();

export const coreTechnicalAssessmentReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    evaluatorVersion: z.literal(CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION),
    scoringVersion: z.literal(CORE_TECHNICAL_ASSESSMENT_SCORING_VERSION),
    finalizedAt: z.string().datetime(),
    scores: coreTechnicalAssessmentScoresSchema,
    overallScore: z.number().int().min(0).max(100),
    teacherSummary: z.string().min(20).max(1_200),
    strengths: z.array(z.string().min(4).max(300)).min(1).max(5),
    improvementAreas: z.array(z.string().min(4).max(300)).min(1).max(5),
    promptFeedback: z
      .array(
        z
          .object({
            promptId: identifierSchema,
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
        totalCodeQuestionCount: z.number().int().min(0).max(2),
        implementationScoreCapped: z.boolean()
      })
      .strict(),
    nextStory: coreTechnicalAdaptiveStorySelectionSchema
  })
  .strict();

export const coreTechnicalSafeTranscriptSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentId: z.string().uuid(),
    blockId: z.string().uuid(),
    entries: z
      .array(
        z
          .object({
            promptId: identifierSchema,
            order: z.number().int().min(1).max(5),
            kind: coreTechnicalAssessmentPromptKindSchema,
            prompt: z.string().min(20).max(4_000),
            answer: boundedTextSchema
          })
          .strict()
      )
      .length(5)
  })
  .strict();

export const coreTechnicalContinueInputSchema = z
  .object({
    blockId: z.string().uuid(),
    requestId: z.string().uuid()
  })
  .strict();

export type CoreTechnicalAssessmentSnapshot = z.infer<typeof coreTechnicalAssessmentSnapshotSchema>;
export type CoreTechnicalAssessmentEvaluation = z.infer<
  typeof coreTechnicalAssessmentEvaluationSchema
>;
export type CoreTechnicalAssessmentReport = z.infer<typeof coreTechnicalAssessmentReportSchema>;
export type CoreTechnicalSafeTranscript = z.infer<typeof coreTechnicalSafeTranscriptSchema>;

export function publicCoreTechnicalAssessmentSnapshot(raw: unknown) {
  const snapshot = coreTechnicalAssessmentSnapshotSchema.parse(raw);
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
