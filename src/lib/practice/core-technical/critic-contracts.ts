import { z } from "zod";

export const CORE_TECHNICAL_CRITIC_VERSION = 1 as const;

export const coreTechnicalCriticDimensionSchema = z.enum([
  "technical-correctness",
  "interview-relevance",
  "story-continuity",
  "answer-quality",
  "difficulty"
]);

export const coreTechnicalCriticTargetSchema = z.enum(["story", "question-block"]);

const criticIssueSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  message: z.string().min(20).max(700),
  stageKey: z.string().min(2).max(140).nullable(),
  questionKey: z.string().min(2).max(140).nullable()
});

export const coreTechnicalCriticVerdictSchema = z.object({
  criticVersion: z.literal(CORE_TECHNICAL_CRITIC_VERSION),
  target: coreTechnicalCriticTargetSchema,
  dimension: coreTechnicalCriticDimensionSchema,
  verdict: z.enum(["pass", "fail"]),
  score: z.number().int().min(0).max(100),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string().min(20).max(700),
  evidenceChecks: z
    .array(
      z.object({
        claim: z.string().min(20).max(500),
        evidence: z.string().min(20).max(700),
        passed: z.boolean()
      })
    )
    .min(2)
    .max(8),
  blockingIssues: z.array(criticIssueSchema).max(12),
  requiredChanges: z.array(z.string().min(20).max(700)).max(12)
});

export const coreTechnicalCriticReportSchema = z.object({
  criticVersion: z.literal(CORE_TECHNICAL_CRITIC_VERSION),
  target: coreTechnicalCriticTargetSchema,
  approved: z.boolean(),
  verdicts: z.array(coreTechnicalCriticVerdictSchema).min(4).max(5)
});

export type CoreTechnicalCriticDimension = z.infer<typeof coreTechnicalCriticDimensionSchema>;
export type CoreTechnicalCriticTarget = z.infer<typeof coreTechnicalCriticTargetSchema>;
export type CoreTechnicalCriticVerdict = z.infer<typeof coreTechnicalCriticVerdictSchema>;
export type CoreTechnicalCriticReport = z.infer<typeof coreTechnicalCriticReportSchema>;
