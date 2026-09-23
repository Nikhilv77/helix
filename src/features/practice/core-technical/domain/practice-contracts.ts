import { z } from "zod";
import { coreTechnicalLearningGuideSchema } from "./question-contracts";

import {
  storyPracticeDraftWorkSchema as coreTechnicalDraftWorkSchema,
  storyPracticeAttemptWorkSchema as coreTechnicalAttemptWorkSchema,
  storyPracticeSaveDraftInputSchema as coreTechnicalSaveDraftInputSchema,
  storyPracticeRevealHintInputSchema as coreTechnicalRevealHintInputSchema,
  storyPracticeRunInputSchema as coreTechnicalRunInputSchema,
  storyPracticeAttemptInputSchema as coreTechnicalAttemptInputSchema,
  storyPracticeLearnInputSchema as coreTechnicalLearnInputSchema,
  storyPracticeAttemptFeedbackSchema as coreTechnicalAttemptFeedbackSchema
} from "@/features/practice/shared/domain/story-practice-contracts";
const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export {
  coreTechnicalDraftWorkSchema,
  coreTechnicalAttemptWorkSchema,
  coreTechnicalSaveDraftInputSchema,
  coreTechnicalRevealHintInputSchema,
  coreTechnicalRunInputSchema,
  coreTechnicalAttemptInputSchema,
  coreTechnicalLearnInputSchema,
  coreTechnicalAttemptFeedbackSchema
};

export const coreTechnicalPrepareInputSchema = z
  .object({
    requestId: z.string().uuid(),
    focusRevisionId: z.string().uuid(),
    /** Generate and freeze a candidate-specific block instead of copying a release artifact. */
    personalized: z.boolean().optional().default(false)
  })
  .strict();

export const coreTechnicalStartPathInputSchema = z
  .object({
    requestId: z.string().uuid(),
    storyKey: z
      .string()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
  .strict();

export const coreTechnicalAuthorizedAnswerSchema = z
  .object({
    concise: z.string().min(1).max(4_000),
    explanation: z.string().min(1).max(4_000),
    learningGuide: coreTechnicalLearningGuideSchema,
    referenceSolution: z.string().min(1).max(12_000).optional()
  })
  .strict();

export const coreTechnicalPublicRunResultSchema = z
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
    codeFingerprint: fingerprintSchema,
    testSuiteFingerprint: fingerprintSchema,
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

export type CoreTechnicalDraftWork = z.infer<typeof coreTechnicalDraftWorkSchema>;
export type CoreTechnicalAttemptWork = z.infer<typeof coreTechnicalAttemptWorkSchema>;
export type CoreTechnicalAttemptFeedback = z.infer<typeof coreTechnicalAttemptFeedbackSchema>;
export type CoreTechnicalAuthorizedAnswer = z.infer<typeof coreTechnicalAuthorizedAnswerSchema>;
