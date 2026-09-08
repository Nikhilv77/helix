import { z } from "zod";
import {
  architectureDesignAdaptiveScenarioSelectionSchema,
  architectureDesignScenarioSelectionSchema
} from "./focus-ranking-contracts";
import {
  architectureDesignDimensionSchema,
  architectureDesignFingerprintSchema,
  architectureDesignIdentifierSchema
} from "./contracts";
import { architectureDesignRubricItemSchema } from "./question-contracts";

export const ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION = 1 as const;
export const ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION =
  "architecture-design-assessment-blueprint-v1" as const;
export const ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION =
  "architecture-design-assessment-evaluator-v1" as const;
export const ARCHITECTURE_DESIGN_ASSESSMENT_SCORING_VERSION =
  "architecture-design-assessment-scoring-v1" as const;

const boundedTextSchema = z.string().trim().min(1).max(12_000);
const assessmentAnswerSchema = z.string().trim().min(8).max(6_000);

export const architectureDesignAssessmentPromptKindSchema = z.enum([
  "requirements-scope",
  "api-data-capacity",
  "architecture-tradeoffs",
  "reliability-security-operability",
  "communication-evolution"
]);

export const architectureDesignPublicAssessmentPromptSchema = z
  .object({
    id: architectureDesignIdentifierSchema,
    order: z.number().int().min(1).max(5),
    kind: architectureDesignAssessmentPromptKindSchema,
    prompt: z.string().trim().min(20).max(4_000),
    context: z.string().trim().min(8).max(4_000).nullable()
  })
  .strict();

export const architectureDesignPrivateAssessmentPromptSchema =
  architectureDesignPublicAssessmentPromptSchema
    .extend({
      privateEvaluation: z
        .object({
          sourceQuestionId: z.string().uuid(),
          sourceQuestionFingerprint: architectureDesignFingerprintSchema,
          expectedAnswer: z.string().trim().min(8).max(6_000),
          rubric: z.array(architectureDesignRubricItemSchema).min(1).max(6),
          dimensionKeys: z.array(architectureDesignDimensionSchema).min(1).max(8)
        })
        .strict()
    })
    .strict()
    .superRefine((prompt, context) => {
      if (prompt.privateEvaluation.rubric.reduce((total, item) => total + item.points, 0) !== 10) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["privateEvaluation", "rubric"],
          message: "Assessment prompt rubrics must total exactly 10 points"
        });
      }
    });

export const architectureDesignAssessmentResponseSchema = z
  .object({ promptId: architectureDesignIdentifierSchema, answer: assessmentAnswerSchema })
  .strict();

export const architectureDesignAssessmentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION),
    blueprintVersion: z.literal(ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION),
    preparedAt: z.string().datetime(),
    blockContentFingerprint: architectureDesignFingerprintSchema,
    sourceSelection: architectureDesignScenarioSelectionSchema,
    prompts: z.array(architectureDesignPrivateAssessmentPromptSchema).length(5),
    submission: z
      .object({
        requestId: z.string().uuid(),
        responseFingerprint: architectureDesignFingerprintSchema,
        responses: z.array(architectureDesignAssessmentResponseSchema).length(5),
        submittedAt: z.string().datetime()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((snapshot, context) => {
    snapshot.prompts.forEach((prompt, index) => {
      if (prompt.order !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prompts", index, "order"],
          message: "Assessment prompts must be ordered from one through five"
        });
      }
    });
    if (new Set(snapshot.prompts.map(({ id }) => id)).size !== snapshot.prompts.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prompts"],
        message: "Assessment prompt IDs must be unique"
      });
    }
  });

export const publicArchitectureDesignAssessmentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_ASSESSMENT_SCHEMA_VERSION),
    blueprintVersion: z.literal(ARCHITECTURE_DESIGN_ASSESSMENT_BLUEPRINT_VERSION),
    preparedAt: z.string().datetime(),
    prompts: z.array(architectureDesignPublicAssessmentPromptSchema).length(5),
    submission: z
      .object({
        requestId: z.string().uuid(),
        responses: z.array(architectureDesignAssessmentResponseSchema).length(5),
        submittedAt: z.string().datetime()
      })
      .strict()
      .nullable()
  })
  .strict();

export const architectureDesignAssessmentScoresSchema = z
  .object({
    requirementsScope: z.number().int().min(0).max(100),
    apiDataCapacity: z.number().int().min(0).max(100),
    architectureTradeoffs: z.number().int().min(0).max(100),
    reliabilitySecurityOperability: z.number().int().min(0).max(100),
    communicationEvolution: z.number().int().min(0).max(100)
  })
  .strict();

export const architectureDesignDimensionMasterySchema = z
  .object({
    dimensionKey: architectureDesignDimensionSchema,
    score: z.number().int().min(0).max(100),
    evidence: z.string().trim().min(8).max(500)
  })
  .strict();

export const architectureDesignAssessmentEvaluationSchema = z
  .object({
    scores: architectureDesignAssessmentScoresSchema,
    teacherSummary: z.string().trim().min(20).max(1_200),
    strengths: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    improvementAreas: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    nextSteps: z.array(z.string().trim().min(8).max(400)).min(1).max(5),
    dimensionMastery: z.array(architectureDesignDimensionMasterySchema).length(16)
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (
      new Set(evaluation.dimensionMastery.map(({ dimensionKey }) => dimensionKey)).size !==
      architectureDesignDimensionSchema.options.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensionMastery"],
        message: "Assessment evaluation requires one result for every Architecture dimension"
      });
    }
  });

export const architectureDesignAssessmentReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    evaluatorVersion: z.literal(ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION),
    scoringVersion: z.literal(ARCHITECTURE_DESIGN_ASSESSMENT_SCORING_VERSION),
    model: z
      .object({ provider: z.string().min(1).max(80), model: z.string().min(1).max(120) })
      .strict(),
    promptFingerprint: architectureDesignFingerprintSchema,
    evaluationFingerprint: architectureDesignFingerprintSchema,
    finalizedAt: z.string().datetime(),
    scores: architectureDesignAssessmentScoresSchema,
    overallScore: z.number().int().min(0).max(100),
    teacherSummary: z.string().trim().min(20).max(1_200),
    strengths: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    improvementAreas: z.array(z.string().trim().min(4).max(300)).min(1).max(5),
    nextSteps: z.array(z.string().trim().min(8).max(400)).min(1).max(5),
    dimensionMastery: z.array(architectureDesignDimensionMasterySchema).length(16),
    solvedVsLearned: z
      .object({
        completedCount: z.number().int().min(0).max(4),
        learnedCount: z.number().int().min(0).max(4),
        learnedQuestionOrders: z.array(z.number().int().min(1).max(4)),
        masteryCreditNote: z.string().trim().min(20).max(400)
      })
      .strict(),
    nextScenario: architectureDesignAdaptiveScenarioSelectionSchema
  })
  .strict()
  .superRefine((report, context) => {
    if (
      new Set(report.dimensionMastery.map(({ dimensionKey }) => dimensionKey)).size !==
      architectureDesignDimensionSchema.options.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensionMastery"],
        message: "Assessment reports require one result for every Architecture dimension"
      });
    }
  });

export const architectureDesignAssessmentStartInputSchema = z
  .object({ assessmentId: z.string().uuid(), requestId: z.string().uuid() })
  .strict();

export const architectureDesignAssessmentFinalizeInputSchema = z
  .object({
    assessmentId: z.string().uuid(),
    requestId: z.string().uuid(),
    responses: z.array(architectureDesignAssessmentResponseSchema).length(5)
  })
  .strict();

export const architectureDesignContinueInputSchema = z
  .object({ blockId: z.string().uuid(), requestId: z.string().uuid() })
  .strict();

export const architectureDesignSafeTranscriptSchema = z
  .object({
    schemaVersion: z.literal(1),
    assessmentId: z.string().uuid(),
    blockId: z.string().uuid(),
    entries: z
      .array(
        z
          .object({
            promptId: architectureDesignIdentifierSchema,
            order: z.number().int().min(1).max(5),
            kind: architectureDesignAssessmentPromptKindSchema,
            prompt: z.string().trim().min(20).max(4_000),
            answer: boundedTextSchema
          })
          .strict()
      )
      .length(5)
  })
  .strict();

export type ArchitectureDesignAssessmentSnapshot = z.infer<
  typeof architectureDesignAssessmentSnapshotSchema
>;
export type ArchitectureDesignAssessmentReport = z.infer<
  typeof architectureDesignAssessmentReportSchema
>;
export type ArchitectureDesignAssessmentEvaluation = z.infer<
  typeof architectureDesignAssessmentEvaluationSchema
>;
export type ArchitectureDesignSafeTranscript = z.infer<
  typeof architectureDesignSafeTranscriptSchema
>;

export function publicArchitectureDesignAssessmentSnapshot(raw: unknown) {
  const snapshot = architectureDesignAssessmentSnapshotSchema.parse(raw);
  return publicArchitectureDesignAssessmentSnapshotSchema.parse({
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
  });
}
