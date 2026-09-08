import { z } from "zod";
import {
  appliedEngineeringFingerprintSchema,
  appliedEngineeringIdentifierSchema,
  appliedEngineeringProductionSignalSchema
} from "./contracts";

export const APPLIED_ENGINEERING_BASELINE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const APPLIED_ENGINEERING_BASELINE_REGISTRY_VERSION = 1 as const;

export const appliedEngineeringBaselineStateSchema = z.enum([
  "GUIDED",
  "STANDARD",
  "STRETCH",
  "UNKNOWN"
]);

/** Frozen server-side projection of the onboarding engineering pulse. */
export const appliedEngineeringBaselineEvidenceSchema = z
  .object({
    schemaVersion: z.literal(APPLIED_ENGINEERING_BASELINE_EVIDENCE_SCHEMA_VERSION),
    registryVersion: z.literal(APPLIED_ENGINEERING_BASELINE_REGISTRY_VERSION),
    sourceFingerprint: appliedEngineeringFingerprintSchema,
    source: z.literal("initial-baseline"),
    state: appliedEngineeringBaselineStateSchema,
    evidence: z.enum(["baseline", "not-enough-evidence"]),
    confidence: z.number().min(0).max(1),
    questionId: z.string().min(1).max(180).nullable(),
    familiarity: z.enum(["familiar", "needs-refresh", "unknown"]),
    weakSignalKeys: z.array(appliedEngineeringProductionSignalSchema),
    strongSignalKeys: z.array(appliedEngineeringProductionSignalSchema),
    unassessedSignalKeys: z.array(appliedEngineeringProductionSignalSchema),
    sourceTopicLabels: z.array(z.string().min(2).max(120)),
    sourceAreaId: appliedEngineeringIdentifierSchema
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.sourceAreaId !== "applied-engineering") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceAreaId"],
        message: "Applied Engineering baseline evidence must come from its onboarding area"
      });
    }
    if (evidence.evidence === "not-enough-evidence" && evidence.confidence !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confidence"],
        message: "Missing baseline evidence must have zero confidence"
      });
    }
  });

export type AppliedEngineeringBaselineState = z.infer<typeof appliedEngineeringBaselineStateSchema>;
export type AppliedEngineeringBaselineEvidence = z.infer<
  typeof appliedEngineeringBaselineEvidenceSchema
>;
