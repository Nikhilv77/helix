import { z } from "zod";

export const ARCHITECTURE_DESIGN_KEY = "architecture-design" as const;
export const ARCHITECTURE_DESIGN_LABEL = "Architecture & Design" as const;
export const ARCHITECTURE_DESIGN_ROUTE_BASE = "/practice/architecture-design" as const;
export const ARCHITECTURE_DESIGN_API_BASE = "/api/practice/architecture-design" as const;
export const ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION = 1 as const;

export const architectureDesignIdentifierSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const architectureDesignFingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const architectureDesignDifficultySchema = z.enum(["guided", "standard", "stretch"]);
export const architectureDesignPublicationStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "retired"
]);
export const architectureDesignRoleSchema = z.enum([
  "backend",
  "fullstack",
  "ai-ml",
  "frontend",
  "data"
]);
export const architectureDesignSenioritySchema = z.enum(["junior", "mid", "senior"]);
export const architectureDesignFamilySchema = z.enum([
  "asynchronous-delivery",
  "transactional-workflow",
  "realtime-collaboration",
  "media-storage-delivery",
  "search-indexing",
  // Frontend system design: the client is the system under design.
  "client-data-rendering",
  "interactive-client-component",
  "offline-first-client",
  "realtime-client",
  "frontend-platform",
  // Data system design: pipelines and tables are the system under design.
  "event-analytics-pipeline",
  "change-data-capture",
  "batch-analytics-pipeline",
  "streaming-feature-pipeline",
  "data-platform-governance"
]);

/** Version 1 deliberately excludes executable and diagram-only presentation modes. */
export const architectureDesignQuestionFormatSchema = z.enum([
  "mcq",
  "written",
  "artifact-diagnosis",
  "production-decision"
]);

/** Every version-1 artifact can be rendered by the existing read-only evidence surface. */
export const architectureDesignArtifactKindSchema = z.enum([
  "scenario",
  "metrics",
  "config",
  "trace",
  "logs"
]);

export const architectureDesignDimensionSchema = z.enum([
  "requirements-framing",
  "capacity-estimation",
  "api-event-contracts",
  "data-modeling",
  "storage-access-patterns",
  "component-boundaries",
  "consistency-transactions",
  "caching-contention",
  "async-work-backpressure",
  "partitioning-hotspots",
  "reliability-failure-isolation",
  "observability-slos",
  "security-privacy",
  "cost-efficiency",
  "tradeoff-communication",
  "migration-evolution"
]);

export type ArchitectureDesignDifficulty = z.infer<typeof architectureDesignDifficultySchema>;
export type ArchitectureDesignPublicationStatus = z.infer<
  typeof architectureDesignPublicationStatusSchema
>;
export type ArchitectureDesignRole = z.infer<typeof architectureDesignRoleSchema>;

/**
 * Roles with reviewed Architecture & Design content. Practice, eligibility,
 * and the System Design interview all read this one list.
 */
export function isArchitectureDesignRole(
  role: string | null | undefined
): role is ArchitectureDesignRole {
  return architectureDesignRoleSchema.safeParse(role).success;
}

/**
 * Which kind of system a role designs. Server rounds design services and
 * storage; frontend rounds design the browser client; data rounds design
 * pipelines and tables. Interview acts, Live rules, report labels, and
 * checkpoint prompts all branch on this one value.
 */
export type ArchitectureDesignTrack = "server" | "frontend" | "data";

export function architectureDesignTrackForRole(
  role: string | null | undefined
): ArchitectureDesignTrack {
  if (role === "frontend") return "frontend";
  if (role === "data") return "data";
  return "server";
}
export type ArchitectureDesignSeniority = z.infer<typeof architectureDesignSenioritySchema>;
export type ArchitectureDesignFamily = z.infer<typeof architectureDesignFamilySchema>;
export type ArchitectureDesignQuestionFormat = z.infer<
  typeof architectureDesignQuestionFormatSchema
>;
export type ArchitectureDesignArtifactKind = z.infer<typeof architectureDesignArtifactKindSchema>;
export type ArchitectureDesignDimension = z.infer<typeof architectureDesignDimensionSchema>;
export type ArchitectureDesignWorkKind = "choice" | "text";

type ArchitectureDesignStageDefinition = {
  order: number;
  key: string;
  title: string;
  formats: readonly ArchitectureDesignQuestionFormat[];
  dimensionKeys: readonly ArchitectureDesignDimension[];
};

/** The fixed interview arc shared by every reviewed Architecture scenario. */
export const ARCHITECTURE_DESIGN_STAGES = [
  {
    order: 1,
    key: "requirements-and-scale",
    title: "Requirements and scale",
    formats: ["written", "mcq"],
    dimensionKeys: ["requirements-framing", "capacity-estimation"]
  },
  {
    order: 2,
    key: "contracts-and-data",
    title: "Contracts and data",
    formats: ["production-decision", "artifact-diagnosis", "written"],
    dimensionKeys: [
      "api-event-contracts",
      "data-modeling",
      "storage-access-patterns",
      "consistency-transactions"
    ]
  },
  {
    order: 3,
    key: "architecture-and-failure",
    title: "Architecture and failure",
    formats: ["written", "artifact-diagnosis"],
    dimensionKeys: [
      "component-boundaries",
      "caching-contention",
      "async-work-backpressure",
      "partitioning-hotspots",
      "reliability-failure-isolation"
    ]
  },
  {
    order: 4,
    key: "quality-and-evolution",
    title: "Quality and evolution",
    formats: ["production-decision", "written"],
    dimensionKeys: [
      "observability-slos",
      "security-privacy",
      "cost-efficiency",
      "tradeoff-communication",
      "migration-evolution"
    ]
  }
] as const satisfies readonly ArchitectureDesignStageDefinition[];

export const ARCHITECTURE_DESIGN_V1_SCOPE = {
  roles: architectureDesignRoleSchema.options,
  scenarioCount: 2,
  questionsPerScenario: ARCHITECTURE_DESIGN_STAGES.length,
  assessmentPromptCount: 5,
  requiresRunner: false,
  supportsDiagramEditor: false
} as const;

export function architectureDesignWorkKind(
  format: ArchitectureDesignQuestionFormat
): ArchitectureDesignWorkKind {
  switch (format) {
    case "mcq":
      return "choice";
    case "written":
    case "artifact-diagnosis":
    case "production-decision":
      return "text";
    default:
      return assertNever(format);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Architecture & Design format: ${String(value)}`);
}
