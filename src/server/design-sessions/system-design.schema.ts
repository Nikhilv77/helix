import { z } from "zod";

const namedDescriptionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1)
});

const recommendationSchema = z.object({
  name: z.string().min(1),
  recommendation: z.string().min(1),
  reasoning: z.string().min(1)
});

const technologyChoiceSchema = z.object({
  category: z.string().min(1),
  choice: z.string().min(1),
  reasoning: z.string().min(1),
  alternativesConsidered: z.array(z.string().min(1))
});

export const retrievedSourceReferenceSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  sourceUrl: z.string().nullable(),
  similarity: z.number().min(0).max(1),
  usedFor: z.string().min(1)
});

export const generatedSystemDesignSchema = z.object({
  architectureSummary: z.string().min(1),
  majorComponents: z.array(
    z.object({
      name: z.string().min(1),
      responsibilities: z.array(z.string().min(1))
    })
  ),
  apiRecommendations: z.array(recommendationSchema),
  databaseChoices: z.array(recommendationSchema),
  cachingStrategy: z.array(recommendationSchema),
  messagingAndAsyncProcessing: z.array(recommendationSchema),
  storageStrategy: z.array(recommendationSchema),
  scalabilityApproach: z.array(namedDescriptionSchema),
  reliabilityAndFailureHandling: z.array(namedDescriptionSchema),
  security: z.array(namedDescriptionSchema),
  observability: z.array(namedDescriptionSchema),
  deploymentApproach: z.array(namedDescriptionSchema),
  technologyChoices: z.array(technologyChoiceSchema),
  assumptions: z.array(z.string().min(1)),
  tradeOffs: z.array(namedDescriptionSchema),
  risks: z.array(namedDescriptionSchema),
  retrievedSourceReferences: z.array(retrievedSourceReferenceSchema)
});

export type GeneratedSystemDesign = z.infer<typeof generatedSystemDesignSchema>;
export type RetrievedSourceReference = z.infer<typeof retrievedSourceReferenceSchema>;

