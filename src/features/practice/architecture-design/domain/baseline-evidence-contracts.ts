import { z } from "zod";
import {
  architectureDesignDimensionSchema,
  architectureDesignFingerprintSchema
} from "./contracts";

export const ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION = 1 as const;
export const ARCHITECTURE_DESIGN_BASELINE_SECTION = "architecture" as const;

export const architectureDesignBaselineStateSchema = z.enum(["GUIDED", "STANDARD", "UNKNOWN"]);
export const architectureDesignBaselineResolutionSchema = z.enum([
  "RESOLVED",
  "MISSING",
  "UNRESOLVABLE"
]);
export const architectureDesignBaselineCorrectnessSchema = z.enum([
  "CORRECT",
  "INCORRECT",
  "UNKNOWN"
]);

/** Answer-free evidence derived from the one frozen Architecture onboarding question. */
export const architectureDesignBaselineEvidenceSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_SCHEMA_VERSION),
    registryVersion: z.literal(ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION),
    sourceFingerprint: architectureDesignFingerprintSchema,
    questionId: z.string().min(1).max(180).nullable(),
    questionFingerprint: architectureDesignFingerprintSchema.nullable(),
    resolution: architectureDesignBaselineResolutionSchema,
    correctness: architectureDesignBaselineCorrectnessSchema,
    state: architectureDesignBaselineStateSchema,
    dimensionKeys: z.array(architectureDesignDimensionSchema),
    weakDimensionKeys: z.array(architectureDesignDimensionSchema),
    strongDimensionKeys: z.array(architectureDesignDimensionSchema),
    unassessedDimensionKeys: z.array(architectureDesignDimensionSchema),
    signalConsistency: z.enum(["CONSISTENT", "INCONSISTENT", "UNAVAILABLE"])
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.resolution !== "RESOLVED" && evidence.correctness !== "UNKNOWN") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctness"],
        message: "Unresolved Architecture evidence cannot contain a grade"
      });
    }
    if (evidence.state === "STANDARD" && evidence.correctness !== "CORRECT") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: "Only one resolved correct answer can calibrate the standard path"
      });
    }
    if (evidence.state === "GUIDED" && evidence.correctness !== "INCORRECT") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: "Only one resolved incorrect answer can calibrate the guided path"
      });
    }
  });

export type ArchitectureDesignBaselineState = z.infer<typeof architectureDesignBaselineStateSchema>;
export type ArchitectureDesignBaselineEvidence = z.infer<
  typeof architectureDesignBaselineEvidenceSchema
>;
