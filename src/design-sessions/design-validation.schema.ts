import { z } from "zod";

export const designValidationCategorySchema = z.enum([
  "functionalRequirements",
  "scalability",
  "availability",
  "reliability",
  "dataConsistency",
  "security",
  "observability",
  "disasterRecovery",
  "costAwareness",
  "operationalComplexity"
]);

export const designValidationFindingSchema = z.object({
  category: designValidationCategorySchema,
  message: z.string().min(1),
  recommendation: z.string().min(1)
});

export const categoryScoreSchema = z.object({
  category: designValidationCategorySchema,
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1)
});

export const designValidationReviewSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  categoryScores: z.array(categoryScoreSchema),
  criticalIssues: z.array(designValidationFindingSchema),
  warnings: z.array(designValidationFindingSchema),
  missingAreas: z.array(designValidationFindingSchema),
  improvementSuggestions: z.array(designValidationFindingSchema),
  strengths: z.array(designValidationFindingSchema),
  unresolvedAssumptions: z.array(z.string().min(1))
});

export const deterministicDesignValidationSchema = designValidationReviewSchema.extend({
  checks: z.array(
    z.object({
      category: designValidationCategorySchema,
      passed: z.boolean(),
      message: z.string().min(1)
    })
  )
});

export const persistedDesignValidationSchema = designValidationReviewSchema.extend({
  deterministicReview: deterministicDesignValidationSchema,
  aiReview: designValidationReviewSchema,
  validatedAt: z.string().datetime()
});

export type DesignValidationCategory = z.infer<typeof designValidationCategorySchema>;
export type DesignValidationFinding = z.infer<typeof designValidationFindingSchema>;
export type DesignValidationReview = z.infer<typeof designValidationReviewSchema>;
export type DeterministicDesignValidation = z.infer<typeof deterministicDesignValidationSchema>;
export type PersistedDesignValidation = z.infer<typeof persistedDesignValidationSchema>;

