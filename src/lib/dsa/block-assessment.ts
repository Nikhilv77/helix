import { z } from "zod";

/** v2 adds immutable server-only transfer runner contracts and public starters. */
export const DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION = 2;
export const DSA_BLOCK_ASSESSMENT_RUBRIC_VERSION = 1;
export const DSA_BLOCK_ASSESSMENT_DURATION_MINUTES = 40;

export const dsaAssessmentMetricSchema = z.enum([
  "pattern-recognition",
  "correctness-edge-cases",
  "efficiency",
  "code-quality",
  "communication"
]);

export const dsaAssessmentGroundingSchema = z.enum([
  "saved-execution-evidence",
  "authored-reference-metadata",
  "deterministic-static-analysis"
]);

const reviewItemSchema = z
  .object({
    id: z.string().min(1),
    family: z.enum([
      "pattern-choice",
      "complexity-target",
      "edge-case",
      "execution-evidence",
      "execution-case",
      "static-code-cue",
      "optimization-review"
    ]),
    sourceAttemptId: z.string().uuid(),
    sourceQuestionSlug: z.string().min(1),
    sourceQuestionTitle: z.string().min(1),
    sourceQuestionPattern: z.string().min(1),
    sourceCode: z.string().min(1),
    /** Exact bounded excerpt from sourceCode used as this prompt's visual anchor. */
    codeSnippet: z.string().min(1).max(1_600),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctOption: z.number().int().nonnegative(),
    rationale: z.string().min(1),
    metric: dsaAssessmentMetricSchema,
    grounding: z.object({
      kind: dsaAssessmentGroundingSchema,
      source: z.string().min(1),
      detail: z.string().min(1),
      evidence: z.record(z.string(), z.unknown())
    })
  })
  .superRefine((item, context) => {
    if (item.correctOption >= item.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctOption"],
        message: "correctOption must reference one of the saved options."
      });
    }
    if (!item.sourceCode.includes(item.codeSnippet)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codeSnippet"],
        message: "codeSnippet must be an exact excerpt of sourceCode."
      });
    }
  });

const transferQuestionSnapshotSchema = z.object({
  slug: z.string().min(1),
  contentVersion: z.number().int().positive(),
  phaseSlug: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  externalUrl: z.string(),
  primaryPattern: z.string().min(1),
  subPatterns: z.array(z.string()),
  difficulty: z.string().min(1),
  expectedTimeMinutes: z.number().int().positive(),
  recommendedOrder: z.number().int().positive(),
  prerequisites: z.array(z.string()),
  conceptsTested: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  interviewSignals: z.array(z.string()),
  followUpPrompts: z.array(z.string()),
  promptSummary: z.string(),
  highLevelApproach: z.string(),
  complexity: z.unknown(),
  problemStatement: z.string().nullable(),
  constraints: z.array(z.string()),
  examples: z.unknown().nullable(),
  keyInsight: z.string().nullable(),
  hints: z.array(z.string()),
  approaches: z.unknown().nullable(),
  edgeCases: z.array(z.string()),
  relatedQuestions: z.array(z.string()),
  phaseNumber: z.number().int().positive(),
  /**
   * Server-only runner material frozen from the authored question at
   * preparation. It is intentionally omitted from the live interview plan and
   * every public API serializer.
   */
  runnerContract: z
    .object({
      version: z.literal(1),
      functionName: z.string().min(1),
      testCases: z.array(z.unknown()).min(1)
    })
    .optional(),
  /** Public blank function signatures, derived from the same frozen question. */
  starterCode: z
    .object({
      javascript: z.string(),
      python: z.string(),
      cpp: z.string(),
      java: z.string()
    })
    .optional(),
  selectionReason: z.enum([
    "primary-pattern-unseen",
    "secondary-pattern-unseen",
    "calibrated-unseen-fallback",
    "previously-seen-fallback"
  ])
});

export const dsaBlockAssessmentSnapshotSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION)]),
    rubricVersion: z.literal(DSA_BLOCK_ASSESSMENT_RUBRIC_VERSION),
    blockId: z.string().uuid(),
    blockOrdinal: z.number().int().positive(),
    blockRecommendationSnapshot: z.unknown(),
    teacher: z.object({
      id: z.string().nullable(),
      source: z.literal("candidate-profile-at-preparation")
    }),
    durationMinutes: z.literal(DSA_BLOCK_ASSESSMENT_DURATION_MINUTES),
    preparedAt: z.string().datetime(),
    reviewItems: z.array(reviewItemSchema).min(5).max(6),
    transferQuestions: z.array(transferQuestionSnapshotSchema).length(2)
  })
  .superRefine((snapshot, context) => {
    const codeDependent = snapshot.reviewItems.filter(
      (item) =>
        item.grounding.kind === "saved-execution-evidence" ||
        item.grounding.kind === "deterministic-static-analysis"
    ).length;
    if (codeDependent < Math.ceil(snapshot.reviewItems.length / 2)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewItems"],
        message:
          "A majority of review items must depend on saved execution or deterministic code analysis."
      });
    }
    if (snapshot.schemaVersion === DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION) {
      snapshot.transferQuestions.forEach((question, index) => {
        if (!question.runnerContract) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["transferQuestions", index, "runnerContract"],
            message: "v2 transfer questions require a frozen runner contract."
          });
        }
        if (!question.starterCode) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["transferQuestions", index, "starterCode"],
            message: "v2 transfer questions require public starter code."
          });
        }
      });
    }
  });

export type DsaBlockAssessmentSnapshot = z.infer<typeof dsaBlockAssessmentSnapshotSchema>;
export type DsaBlockAssessmentReviewItem = z.infer<typeof reviewItemSchema>;
export type DsaBlockAssessmentTransferQuestion = z.infer<typeof transferQuestionSnapshotSchema>;

export function parseDsaBlockAssessmentSnapshot(value: unknown): DsaBlockAssessmentSnapshot {
  return dsaBlockAssessmentSnapshotSchema.parse(value);
}
