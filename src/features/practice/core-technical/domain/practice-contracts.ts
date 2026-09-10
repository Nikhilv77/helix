import { z } from "zod";
import { coreTechnicalLearningGuideSchema } from "./question-contracts";

const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const boundedTextSchema = z.string().trim().min(1).max(12_000);
const genuineAnswerSchema = z.string().trim().min(8).max(12_000);

export const coreTechnicalDraftWorkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) }).strict(),
  z.object({ kind: z.literal("text"), text: boundedTextSchema }).strict(),
  z.object({ kind: z.literal("code"), code: boundedTextSchema }).strict()
]);

export const coreTechnicalAttemptWorkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), selectedChoiceIndex: z.number().int().min(0).max(4) }).strict(),
  z.object({ kind: z.literal("text"), text: genuineAnswerSchema }).strict(),
  z.object({
    kind: z.literal("code"),
    code: boundedTextSchema,
    runId: z.string().uuid()
  }).strict()
]);

export const coreTechnicalSaveDraftInputSchema = z.object({
  questionId: z.string().uuid(),
  draft: coreTechnicalDraftWorkSchema.nullable()
}).strict();

export const coreTechnicalRevealHintInputSchema = z.object({
  questionId: z.string().uuid(),
  hintNumber: z.union([z.literal(1), z.literal(2), z.literal(3)])
}).strict();

export const coreTechnicalRunInputSchema = z.object({
  questionId: z.string().uuid(),
  requestId: z.string().uuid(),
  code: boundedTextSchema
}).strict();

export const coreTechnicalAttemptInputSchema = z.object({
  questionId: z.string().uuid(),
  requestId: z.string().uuid(),
  work: coreTechnicalAttemptWorkSchema
}).strict();

export const coreTechnicalLearnInputSchema = z.object({
  questionId: z.string().uuid(),
  confirmed: z.literal(true)
}).strict();

export const coreTechnicalPrepareInputSchema = z.object({
  requestId: z.string().uuid(),
  focusRevisionId: z.string().uuid(),
  /** Generate and freeze a candidate-specific block instead of copying a release artifact. */
  personalized: z.boolean().optional().default(false)
}).strict();

export const coreTechnicalAttemptFeedbackSchema = z.object({
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
}).strict();

export const coreTechnicalAuthorizedAnswerSchema = z.object({
  concise: z.string().min(1).max(4_000),
  explanation: z.string().min(1).max(4_000),
  learningGuide: coreTechnicalLearningGuideSchema,
  referenceSolution: z.string().min(1).max(12_000).optional()
}).strict();

export const coreTechnicalPublicRunResultSchema = z.object({
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
  limits: z.object({
    timeoutMs: z.number().int().positive(),
    memoryMb: z.number().int().positive(),
    outputBytes: z.number().int().positive(),
    filesystem: z.literal("read-only-submission"),
    processes: z.literal(1),
    network: z.literal(false)
  }).strict(),
  publicTests: z.array(z.object({
    name: z.string().max(120),
    input: z.string().max(2_000),
    expected: z.string().max(2_000),
    passed: z.boolean(),
    diagnostic: z.string().max(500).optional()
  }).strict()).max(12),
  hiddenTests: z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict(),
  durationMs: z.number().nonnegative(),
  peakMemoryMb: z.number().nonnegative().nullable(),
  diagnostic: z.string().max(1_000).optional()
}).strict();

export type CoreTechnicalDraftWork = z.infer<typeof coreTechnicalDraftWorkSchema>;
export type CoreTechnicalAttemptWork = z.infer<typeof coreTechnicalAttemptWorkSchema>;
export type CoreTechnicalAttemptFeedback = z.infer<typeof coreTechnicalAttemptFeedbackSchema>;
export type CoreTechnicalAuthorizedAnswer = z.infer<typeof coreTechnicalAuthorizedAnswerSchema>;
