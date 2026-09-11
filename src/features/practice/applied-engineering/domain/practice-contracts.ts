import { z } from "zod";
import { appliedEngineeringFingerprintSchema } from "./contracts";

const boundedTextSchema = z.string().trim().min(1).max(12_000);
const genuineAnswerSchema = z.string().trim().min(8).max(12_000);

export const appliedEngineeringDraftWorkSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ kind: z.literal("text"), text: boundedTextSchema }).strict(),
  z.object({ kind: z.literal("code"), code: boundedTextSchema }).strict()
]);

export const appliedEngineeringAttemptWorkSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) })
    .strict(),
  z.object({ kind: z.literal("text"), text: genuineAnswerSchema }).strict(),
  z.object({ kind: z.literal("code"), code: boundedTextSchema, runId: z.string().uuid() }).strict()
]);

export const appliedEngineeringSaveDraftInputSchema = z
  .object({
    questionId: z.string().uuid(),
    draft: appliedEngineeringDraftWorkSchema.nullable()
  })
  .strict();

export const appliedEngineeringRevealHintInputSchema = z
  .object({
    questionId: z.string().uuid(),
    hintNumber: z.union([z.literal(1), z.literal(2), z.literal(3)])
  })
  .strict();

export const appliedEngineeringRunInputSchema = z
  .object({
    questionId: z.string().uuid(),
    requestId: z.string().uuid(),
    code: boundedTextSchema
  })
  .strict();

export const appliedEngineeringAttemptInputSchema = z
  .object({
    questionId: z.string().uuid(),
    requestId: z.string().uuid(),
    work: appliedEngineeringAttemptWorkSchema
  })
  .strict();

export const appliedEngineeringLearnInputSchema = z
  .object({ questionId: z.string().uuid(), confirmed: z.literal(true) })
  .strict();

export const appliedEngineeringPrepareInputSchema = z
  .object({ requestId: z.string().uuid(), focusRevisionId: z.string().uuid() })
  .strict();

export const appliedEngineeringStartPathInputSchema = z
  .object({
    requestId: z.string().uuid(),
    storyKey: z
      .string()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
  .strict();

export const appliedEngineeringAttemptFeedbackSchema = z
  .object({
    schemaVersion: z.literal(1),
    score: z.number().min(0).max(10),
    result: z.string().trim().min(1).max(500),
    evidenceUse: z.string().trim().min(1).max(700),
    rootCauseReasoning: z.string().trim().min(1).max(700),
    repairQuality: z.string().trim().min(1).max(700),
    verificationQuality: z.string().trim().min(1).max(700),
    productionConsequence: z.string().trim().min(1).max(500),
    saferDelivery: z.string().trim().min(1).max(500),
    interviewerFollowUp: z.string().trim().min(1).max(500),
    missedEdgeCases: z.array(z.string().trim().min(1).max(300)).max(5).default([])
  })
  .strict();

export const appliedEngineeringAuthorizedAnswerSchema = z
  .object({
    concise: z.string().min(1).max(4_000),
    explanation: z.string().min(1).max(4_000),
    referenceSolution: z.string().min(1).max(12_000).optional()
  })
  .strict();

export const appliedEngineeringPublicRunResultSchema = z
  .object({
    accepted: z.boolean(),
    status: z.enum([
      "accepted",
      "tests-failed",
      "compile-error",
      "runtime-error",
      "timeout",
      "memory-limit",
      "output-limit",
      "process-limit"
    ]),
    codeFingerprint: appliedEngineeringFingerprintSchema,
    testSuiteFingerprint: appliedEngineeringFingerprintSchema,
    runnerIdentity: z.string().min(1).max(240),
    runnerVersion: z.string().min(1).max(160),
    runtimeVersion: z.string().min(1).max(40),
    limits: z
      .object({
        timeoutMs: z.number().int().positive(),
        memoryMb: z.number().int().positive(),
        outputBytes: z.number().int().positive(),
        filesystem: z.literal("read-only-submission"),
        processes: z.literal(1),
        network: z.literal(false)
      })
      .strict(),
    publicTests: z
      .array(
        z
          .object({
            name: z.string().max(120),
            input: z.string().max(2_000),
            expected: z.string().max(2_000),
            passed: z.boolean(),
            diagnostic: z.string().max(500).optional()
          })
          .strict()
      )
      .max(12),
    hiddenTests: z
      .object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative() })
      .strict(),
    durationMs: z.number().nonnegative(),
    peakMemoryMb: z.number().nonnegative().nullable(),
    diagnostic: z.string().max(1_000).optional()
  })
  .strict();

export type AppliedEngineeringDraftWork = z.infer<typeof appliedEngineeringDraftWorkSchema>;
export type AppliedEngineeringAttemptWork = z.infer<typeof appliedEngineeringAttemptWorkSchema>;
export type AppliedEngineeringAttemptFeedback = z.infer<
  typeof appliedEngineeringAttemptFeedbackSchema
>;
export type AppliedEngineeringAuthorizedAnswer = z.infer<
  typeof appliedEngineeringAuthorizedAnswerSchema
>;
