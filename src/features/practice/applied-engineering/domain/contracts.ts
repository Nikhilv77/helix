import { z } from "zod";

export const APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION = 1 as const;

export const appliedEngineeringIdentifierSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const appliedEngineeringFingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const appliedEngineeringDifficultySchema = z.enum(["guided", "standard", "stretch"]);

export const appliedEngineeringPublicationStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "retired"
]);

export const appliedEngineeringQuestionFormatSchema = z.enum([
  "mcq",
  "written",
  "artifact-diagnosis",
  "debug-repair",
  "micro-implementation",
  "production-decision"
]);

export const appliedEngineeringArtifactKindSchema = z.enum([
  "scenario",
  "code",
  "logs",
  "trace",
  "metrics",
  "waterfall",
  "query-plan",
  "config"
]);

export const appliedEngineeringProductionSignalSchema = z.enum([
  "evidence-selection",
  "root-cause-reasoning",
  "data-integrity",
  "concurrency-control",
  "idempotency",
  "bounded-work",
  "database-performance",
  "caching",
  "retry-safety",
  "failure-isolation",
  "testing-verification",
  "observability",
  "security",
  "rollout-safety",
  "rollback-readiness",
  "customer-impact"
]);

export type AppliedEngineeringDifficulty = z.infer<typeof appliedEngineeringDifficultySchema>;
export type AppliedEngineeringQuestionFormat = z.infer<
  typeof appliedEngineeringQuestionFormatSchema
>;
export type AppliedEngineeringArtifactKind = z.infer<typeof appliedEngineeringArtifactKindSchema>;
export type AppliedEngineeringProductionSignal = z.infer<
  typeof appliedEngineeringProductionSignalSchema
>;
