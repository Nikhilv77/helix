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

const productWorkspaceSchema = z.object({
  idea: z.object({
    name: z.string().min(1),
    summary: z.string().min(1),
    targetUsers: z.string().min(1),
    primaryValue: z.string().min(1)
  }),
  requirements: z.array(
    z.object({
      label: z.string().min(1),
      detail: z.string().min(1),
      priority: z.string().min(1)
    })
  ),
  userFlow: z.array(
    z.object({
      step: z.string().min(1),
      actor: z.string().min(1),
      action: z.string().min(1),
      systemResponse: z.string().min(1)
    })
  ),
  uiSurfaces: z.array(
    z.object({
      name: z.string().min(1),
      purpose: z.string().min(1),
      keyElements: z.array(z.string().min(1))
    })
  ),
  backendServices: z.array(
    z.object({
      name: z.string().min(1),
      responsibility: z.string().min(1),
      trigger: z.string().min(1)
    })
  ),
  databasePlan: z.array(
    z.object({
      name: z.string().min(1),
      stores: z.string().min(1),
      accessPattern: z.string().min(1)
    })
  ),
  apiPlan: z.array(
    z.object({
      method: z.string().min(1),
      path: z.string().min(1),
      purpose: z.string().min(1)
    })
  ),
  architectureHighlights: z.array(namedDescriptionSchema),
  roadmap: z.array(
    z.object({
      phase: z.string().min(1),
      goal: z.string().min(1),
      deliverables: z.array(z.string().min(1))
    })
  ),
  exportArtifacts: z.array(
    z.object({
      name: z.string().min(1),
      format: z.string().min(1),
      contents: z.array(z.string().min(1))
    })
  )
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
  productWorkspace: productWorkspaceSchema.optional(),
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
