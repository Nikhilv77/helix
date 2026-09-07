import { z } from "zod";

export const CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const CORE_TECHNICAL_BASELINE_REGISTRY_VERSION = 1 as const;
export const CORE_TECHNICAL_BASELINE_SECTIONS = [
  "technical-1",
  "technical-2",
  "technical-3"
] as const;

export const coreTechnicalBaselineStateSchema = z.enum([
  "GUIDED",
  "STANDARD",
  "STRETCH",
  "UNKNOWN"
]);

export const coreTechnicalBaselineQuestionEvidenceSchema = z.object({
  section: z.enum(CORE_TECHNICAL_BASELINE_SECTIONS),
  resolution: z.enum(["RESOLVED", "MISSING", "UNRESOLVABLE"]),
  questionId: z.string().min(1).nullable(),
  questionFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
  conceptKeys: z.array(z.string().min(1)),
  mechanismKeys: z.array(z.string().min(1)),
  correctness: z.enum(["CORRECT", "INCORRECT", "UNANSWERED", "UNKNOWN"])
}).strict();

export const coreTechnicalBaselineEvidenceSchema = z.object({
  schemaVersion: z.literal(CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION),
  registryVersion: z.literal(CORE_TECHNICAL_BASELINE_REGISTRY_VERSION),
  sourceFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  state: coreTechnicalBaselineStateSchema,
  validAnswerCount: z.number().int().min(0).max(3),
  correctAnswerCount: z.number().int().min(0).max(3),
  questions: z.array(coreTechnicalBaselineQuestionEvidenceSchema).length(3),
  weakConceptKeys: z.array(z.string().min(1)),
  strongConceptKeys: z.array(z.string().min(1)),
  unassessedConceptKeys: z.array(z.string().min(1)),
  weakMechanismKeys: z.array(z.string().min(1)),
  strongMechanismKeys: z.array(z.string().min(1)),
  unassessedMechanismKeys: z.array(z.string().min(1))
}).strict();

export type CoreTechnicalBaselineState = z.infer<typeof coreTechnicalBaselineStateSchema>;
export type CoreTechnicalBaselineQuestionEvidence = z.infer<
  typeof coreTechnicalBaselineQuestionEvidenceSchema
>;
export type CoreTechnicalBaselineEvidence = z.infer<typeof coreTechnicalBaselineEvidenceSchema>;
