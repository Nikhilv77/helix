import { z } from "zod";

export const DSA_BLOCK_ASSESSMENT_REPORT_VERSION = 1;
export const DSA_BLOCK_ASSESSMENT_SCORING_VERSION = 1;

export const dsaBlockAssessmentMetricSchema = z.enum([
  "pattern-recognition",
  "correctness-edge-cases",
  "efficiency",
  "code-quality",
  "communication"
]);

export type DsaBlockAssessmentMetric = z.infer<typeof dsaBlockAssessmentMetricSchema>;

const evidenceSchema = z.object({
  questionIndex: z.number().int().nonnegative(),
  kind: z.enum(["review-mcq", "transfer-code", "transfer-evaluation", "skipped", "unanswered"]),
  score: z.number().min(0).max(100),
  status: z.enum(["grounded", "stale-execution", "insufficient", "skipped", "unanswered"]),
  reference: z.string().min(1)
});

export const dsaBlockAssessmentReportSchema = z.object({
  reportVersion: z.literal(DSA_BLOCK_ASSESSMENT_REPORT_VERSION),
  scoringVersion: z.literal(DSA_BLOCK_ASSESSMENT_SCORING_VERSION),
  rubricVersion: z.number().int().positive(),
  blockId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  completedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  completion: z.object({
    answered: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative().default(0),
    total: z.number().int().positive(),
    partial: z.boolean()
  }),
  metrics: z.object({
    "pattern-recognition": z.number().min(0).max(100),
    "correctness-edge-cases": z.number().min(0).max(100),
    efficiency: z.number().min(0).max(100),
    "code-quality": z.number().min(0).max(100),
    communication: z.number().min(0).max(100)
  }),
  overall: z.number().min(0).max(100),
  evidence: z.object({
    review: z.array(evidenceSchema),
    transfer: z.array(evidenceSchema),
    byPattern: z.record(z.string(), z.array(evidenceSchema))
  }),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  teacherSummary: z.string().min(1),
  nextRecommendationSignals: z.object({
    weakestMetric: dsaBlockAssessmentMetricSchema,
    strongestMetric: dsaBlockAssessmentMetricSchema,
    weakPatterns: z.array(z.string()),
    strongPatterns: z.array(z.string()),
    evidencePrecedence: z.literal("assessment-complements-verified-practice")
  })
});

export type DsaBlockAssessmentReport = z.infer<typeof dsaBlockAssessmentReportSchema>;

export function parseDsaBlockAssessmentReport(value: unknown): DsaBlockAssessmentReport {
  return dsaBlockAssessmentReportSchema.parse(value);
}
