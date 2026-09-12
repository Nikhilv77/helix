import { z } from "zod";
import { architectureDesignFingerprintSchema } from "./contracts";

const boundedTextSchema = z.string().trim().min(1).max(12_000);
const genuineAnswerSchema = z.string().trim().min(8).max(12_000);

export const architectureDesignDraftWorkSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ kind: z.literal("text"), text: boundedTextSchema }).strict()
]);

export const architectureDesignAttemptWorkSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ kind: z.literal("text"), text: genuineAnswerSchema }).strict()
]);

export const architectureDesignSaveDraftInputSchema = z
  .object({ questionId: z.string().uuid(), draft: architectureDesignDraftWorkSchema.nullable() })
  .strict();

export const architectureDesignRevealHintInputSchema = z
  .object({
    questionId: z.string().uuid(),
    hintNumber: z.union([z.literal(1), z.literal(2), z.literal(3)])
  })
  .strict();

export const architectureDesignAttemptInputSchema = z
  .object({
    questionId: z.string().uuid(),
    requestId: z.string().uuid(),
    work: architectureDesignAttemptWorkSchema
  })
  .strict();

export const architectureDesignLearnInputSchema = z
  .object({ questionId: z.string().uuid(), confirmed: z.literal(true) })
  .strict();

export const architectureDesignPrepareInputSchema = z
  .object({ requestId: z.string().uuid(), focusRevisionId: z.string().uuid() })
  .strict();

export const architectureDesignStartPathInputSchema = z
  .object({
    requestId: z.string().uuid(),
    storyKey: z
      .string()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
  .strict();

export const architectureDesignAttemptFeedbackSchema = z
  .object({
    schemaVersion: z.literal(1),
    score: z.number().min(0).max(10),
    result: z.string().trim().min(1).max(500),
    constraintUse: z.string().trim().min(1).max(700),
    designReasoning: z.string().trim().min(1).max(700),
    tradeoffQuality: z.string().trim().min(1).max(700),
    operationalSafety: z.string().trim().min(1).max(700),
    communicationQuality: z.string().trim().min(1).max(500),
    interviewerFollowUp: z.string().trim().min(1).max(500),
    missedConsiderations: z.array(z.string().trim().min(1).max(300)).max(5).default([])
  })
  .strict();

export const architectureDesignAuthorizedAnswerSchema = z
  .object({ summary: z.string().min(1).max(4_000), explanation: z.string().min(1).max(12_000) })
  .strict();

export const architectureDesignAttemptIdentitySchema = z
  .object({
    evaluatorVersion: z.string().trim().min(1).max(160),
    evaluatorFingerprint: architectureDesignFingerprintSchema
  })
  .strict();

export type ArchitectureDesignDraftWork = z.infer<typeof architectureDesignDraftWorkSchema>;
export type ArchitectureDesignAttemptWork = z.infer<typeof architectureDesignAttemptWorkSchema>;
export type ArchitectureDesignAttemptFeedback = z.infer<
  typeof architectureDesignAttemptFeedbackSchema
>;
export type ArchitectureDesignAuthorizedAnswer = z.infer<
  typeof architectureDesignAuthorizedAnswerSchema
>;
