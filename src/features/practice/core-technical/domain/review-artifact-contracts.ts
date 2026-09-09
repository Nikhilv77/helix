import { z } from "zod";

import { coreTechnicalCriticReportSchema } from "./critic-contracts";
import {
  CORE_TECHNICAL_GOLD_SET_VERSION,
  coreTechnicalGoldEvaluationReportSchema,
  coreTechnicalGoldReviewSchema
} from "./gold-evaluation-contracts";
import { frozenQuestionBlockSchema } from "./question-contracts";
import { selectedStorySchema } from "./story-contracts";

export const coreTechnicalStoryReviewArtifactSchema = z.object({
  goldSetVersion: z.literal(CORE_TECHNICAL_GOLD_SET_VERSION),
  caseKey: z
    .string()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  generatedAt: z.string().datetime({ offset: true }),
  story: selectedStorySchema,
  storyReview: coreTechnicalCriticReportSchema,
  questionBlock: frozenQuestionBlockSchema,
  questionBlockReview: coreTechnicalCriticReportSchema,
  evaluation: coreTechnicalGoldEvaluationReportSchema,
  humanReview: coreTechnicalGoldReviewSchema
});

export type CoreTechnicalStoryReviewArtifact = z.infer<
  typeof coreTechnicalStoryReviewArtifactSchema
>;
