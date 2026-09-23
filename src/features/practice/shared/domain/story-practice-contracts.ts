import { z } from "zod";
import { interactiveWorkSchema } from "./interactive-response";

const boundedTextSchema = z.string().trim().min(1).max(12_000);
const genuineAnswerSchema = z.string().trim().min(8).max(12_000);

export const storyPracticeDraftWorkSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ kind: z.literal("text"), text: boundedTextSchema }).strict(),
  z.object({ kind: z.literal("code"), code: boundedTextSchema }).strict()
]);

export const storyPracticeAttemptWorkSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ kind: z.literal("text"), text: genuineAnswerSchema }).strict(),
  z
    .object({
      kind: z.literal("code"),
      code: boundedTextSchema,
      runId: z.string().uuid()
    })
    .strict()
]);

export const storyPracticeSaveDraftInputSchema = z
  .object({
    questionId: z.string().uuid(),
    draft: storyPracticeDraftWorkSchema.nullable()
  })
  .strict();

export const storyPracticeRevealHintInputSchema = z
  .object({
    questionId: z.string().uuid(),
    hintNumber: z.union([z.literal(1), z.literal(2), z.literal(3)])
  })
  .strict();

export const storyPracticeRunInputSchema = z
  .object({
    questionId: z.string().uuid(),
    requestId: z.string().uuid(),
    code: boundedTextSchema
  })
  .strict();

export const storyPracticeAttemptInputSchema = z
  .object({
    questionId: z.string().uuid(),
    requestId: z.string().uuid(),
    work: storyPracticeAttemptWorkSchema
  })
  .strict();

export const storyPracticeLearnInputSchema = z
  .object({
    questionId: z.string().uuid(),
    confirmed: z.literal(true)
  })
  .strict();

export const storyPracticeAttemptFeedbackSchema = z
  .object({
    schemaVersion: z.literal(1),
    score: z.number().min(0).max(10),
    result: z.string().trim().min(1).max(500),
    mechanism: z.string().trim().min(1).max(700),
    didWell: z.string().trim().min(1).max(500),
    missingOrIncorrect: z.string().trim().min(1).max(700),
    productionConsequence: z.string().trim().min(1).max(500),
    transferExample: z.string().trim().min(1).max(500),
    interviewerFollowUp: z.string().trim().min(1).max(500),
    missedEdgeCases: z.array(z.string().trim().min(1).max(300)).max(5).default([])
  })
  .strict();

export const interactivePracticeSaveDraftInputSchema = storyPracticeSaveDraftInputSchema.extend({
  draft: z.union([storyPracticeDraftWorkSchema, interactiveWorkSchema]).nullable()
});
export const interactivePracticeAttemptInputSchema = storyPracticeAttemptInputSchema.extend({
  work: z.union([storyPracticeAttemptWorkSchema, interactiveWorkSchema])
});
