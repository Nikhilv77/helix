import { z } from "zod";

const prioritizedRequirementSchema = z.object({
  id: z.string().min(1),
  requirement: z.string().min(1),
  priority: z.enum(["MUST", "SHOULD", "COULD"])
});

const nonFunctionalRequirementSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  requirement: z.string().min(1),
  target: z.string().nullable()
});

const scaleInputsSchema = z.object({
  expectedUsers: z.string().nullable(),
  requestRate: z.string().nullable(),
  storage: z.string().nullable(),
  regions: z.string().nullable(),
  availabilityTarget: z.string().nullable(),
  latencyTarget: z.string().nullable(),
  notes: z.array(z.string().min(1))
});

export const clarificationQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  reason: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4).optional()
});

export const requirementAnalysisSchema = z.object({
  productSummary: z.string().min(1),
  functionalRequirements: z.array(prioritizedRequirementSchema),
  nonFunctionalRequirements: z.array(nonFunctionalRequirementSchema),
  assumptions: z.array(z.string().min(1)),
  scaleInputs: scaleInputsSchema,
  constraints: z.array(z.string().min(1)),
  missingInformation: z.array(z.string().min(1)),
  clarificationQuestions: z.array(clarificationQuestionSchema).max(5)
});

export const storedClarificationAnswerSchema = z.object({
  questionId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  answeredAt: z.string().datetime()
});

export const storedClarificationAnswersSchema = z.array(storedClarificationAnswerSchema);

export type RequirementAnalysis = z.infer<typeof requirementAnalysisSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type StoredClarificationAnswer = z.infer<typeof storedClarificationAnswerSchema>;
