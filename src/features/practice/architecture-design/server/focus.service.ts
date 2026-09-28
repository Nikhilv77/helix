import { isArchitectureDesignRole } from "@/features/practice/architecture-design/domain/contracts";
import { z } from "zod";
import {
  ARCHITECTURE_DESIGN_FOCUS_SCHEMA_VERSION,
  architectureDesignConfirmedFocusSchema,
  architectureDesignFocusConfirmationSchema,
  type ArchitectureDesignConfirmedFocus
} from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { storyPracticeFingerprint } from "@/features/practice/shared/server/practice-orchestrator";
import type { PrismaService } from "@/server/database/prisma.service";
import type { ArchitectureDesignBaselineEvidenceService } from "./baseline-evidence.service";

type FocusDatabase = {
  candidateProfile: Pick<PrismaService["candidateProfile"], "findUnique">;
  personalizedInterviewPlanVersion: Pick<
    PrismaService["personalizedInterviewPlanVersion"],
    "findFirst"
  >;
};

type FocusDependencies = {
  database: FocusDatabase;
  baselineEvidence: Pick<ArchitectureDesignBaselineEvidenceService, "derive">;
  now?: () => Date;
};

type FocusPlan = {
  id: string;
  sessionBlueprints: Array<{ id: string; blueprint: unknown }>;
} | null;

export type ArchitectureDesignFocusConfirmation = z.input<
  typeof architectureDesignFocusConfirmationSchema
>;

/** Freezes a minimized Architecture focus from owner-scoped server evidence. */
export class ArchitectureDesignFocusService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: FocusDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async confirm(
    ownerId: string,
    rawConfirmation: ArchitectureDesignFocusConfirmation
  ): Promise<ArchitectureDesignConfirmedFocus> {
    const confirmation = architectureDesignFocusConfirmationSchema.parse(rawConfirmation);
    const [profile, baselineEvidence, plan] = await Promise.all([
      this.dependencies.database.candidateProfile.findUnique({
        where: { ownerId },
        select: {
          targetRole: true,
          level: true,
          targetCompany: true,
          targetDate: true,
          headline: true,
          resumeAnalysis: true
        }
      }),
      this.dependencies.baselineEvidence.derive(ownerId),
      this.dependencies.database.personalizedInterviewPlanVersion.findFirst({
        where: { ownerId, status: "READY" },
        orderBy: { revision: "desc" },
        select: {
          id: true,
          sessionBlueprints: {
            where: { kind: "ARCHITECTURE_SYSTEM_DESIGN" },
            take: 1,
            select: { id: true, blueprint: true }
          }
        }
      })
    ]);
    if (!profile) {
      throw new NotFoundErrorException(
        "ARCHITECTURE_DESIGN_PROFILE_NOT_FOUND",
        "Your profile could not be found."
      );
    }
    if (!isArchitectureDesignRole(profile.targetRole)) {
      throw new ConflictErrorException(
        "ARCHITECTURE_DESIGN_ROLE_UNSUPPORTED",
        "Architecture & Design currently supports Backend, Full-stack, Frontend, Data, and AI/ML profiles."
      );
    }
    const seniority = toSeniority(profile.level);
    if (!seniority) {
      throw new BadRequestErrorException(
        "ARCHITECTURE_DESIGN_LEVEL_REQUIRED",
        "Choose an experience level before confirming Architecture & Design practice."
      );
    }

    const content = {
      schemaVersion: ARCHITECTURE_DESIGN_FOCUS_SCHEMA_VERSION,
      path: confirmation.path,
      role: profile.targetRole,
      seniority,
      targetJob: profile.headline?.trim() || defaultTargetJob(profile.targetRole, seniority),
      targetCompany: profile.targetCompany?.trim() || null,
      targetDate: profile.targetDate?.toISOString().slice(0, 10) ?? null,
      excludedScenarioKeys: [],
      resumeEvidence: deriveResumeEvidence(profile.resumeAnalysis),
      planEvidence: derivePlanEvidence(plan),
      baselineEvidence
    } as const;
    return deepFreeze(
      architectureDesignConfirmedFocusSchema.parse({
        ...content,
        focusFingerprint: storyPracticeFingerprint(content),
        confirmedAt: this.now().toISOString()
      })
    );
  }
}

const ARCHITECTURE_SKILL_MATCHERS = {
  "system-design": /system design|architecture/i,
  "distributed-systems": /distributed systems?/i,
  "api-design": /\bapi\b|graphql|grpc/i,
  "data-modeling": /data model|schema design/i,
  databases: /postgres|mysql|database|dynamodb|mongodb/i,
  caching: /cache|redis|memcached/i,
  messaging: /kafka|rabbitmq|queue|event-driven|pub.?sub/i,
  reliability: /reliab|resilien|fault.?toler|high availability/i,
  observability: /observab|monitor|metrics|tracing/i,
  security: /secur|authentication|authorization|privacy/i,
  scalability: /scalab|throughput|high.?volume/i,
  cloud: /\baws\b|\bgcp\b|azure|kubernetes|\bk8s\b/i,
  // Frontend system design evidence.
  "frontend-architecture": /\breact\b|\bvue\b|angular|svelte|next\.?js|frontend/i,
  "web-performance": /core web vitals|lighthouse|performance budget|\blcp\b|\binp\b|bundle size/i,
  accessibility: /accessib|\ba11y\b|wcag|\baria\b/i,
  "offline-first": /service worker|\bpwa\b|offline|indexeddb/i,
  "realtime-ui": /websocket|socket\.io|real.?time/i,
  "design-systems": /design system|storybook|component library/i,
  "client-state": /redux|zustand|mobx|react query|tanstack|apollo|state management/i,
  // Data system design evidence, named after the Data scenario topics.
  "event-ingestion": /clickstream|event tracking|segment|snowplow|ingestion/i,
  "stream-processing":
    /flink|spark streaming|structured streaming|kafka streams|stream processing|streaming pipeline/i,
  "batch-orchestration": /airflow|dagster|prefect|\betl\b|\belt\b|batch pipeline|data pipeline/i,
  "warehouse-modeling":
    /snowflake|bigquery|redshift|data warehouse|dimensional model|star schema|\bdbt\b/i,
  "change-data-capture": /\bcdc\b|change data capture|debezium/i,
  "lakehouse-tables": /lakehouse|iceberg|delta lake|\bhudi\b|databricks|parquet/i,
  "data-quality": /data quality|great expectations|data contract|data observability|\bsoda\b/i,
  "data-lineage": /lineage|openlineage|data catalog/i,
  "feature-store": /feature store|\bfeast\b|feature pipeline/i,
  "experiment-metrics": /a\/b test|experimentation|experiment platform/i
} as const;

function deriveResumeEvidence(value: unknown): ArchitectureDesignConfirmedFocus["resumeEvidence"] {
  const text = collectResumeText(value).toLowerCase();
  const architectureSkillKeys = Object.entries(ARCHITECTURE_SKILL_MATCHERS)
    .filter(([, matcher]) => matcher.test(text))
    .map(([key]) => key)
    .sort();
  const projectKeywords = [
    ...architectureSkillKeys,
    ...[
      "webhooks",
      "notifications",
      "payments",
      "multi-tenancy",
      "migration",
      "latency",
      "cost",
      "infinite scroll",
      "autocomplete",
      "dashboard",
      "chat",
      "ecommerce",
      "clickstream",
      "revenue",
      "fraud",
      "reporting",
      "backfill"
    ].filter((keyword) => text.includes(keyword))
  ].filter(uniqueValue);
  return { architectureSkillKeys, projectKeywords: projectKeywords.slice(0, 30) };
}

function derivePlanEvidence(plan: FocusPlan): ArchitectureDesignConfirmedFocus["planEvidence"] {
  const session = plan?.sessionBlueprints[0];
  if (!session || !isRecord(session.blueprint)) {
    return { blueprintId: null, topicKeys: [], skillKeys: [] };
  }
  const topics = Array.isArray(session.blueprint.topics) ? session.blueprint.topics : [];
  const topicKeys: string[] = [];
  const skillKeys: string[] = [];
  for (const topic of topics) {
    if (!isRecord(topic)) continue;
    if (isIdentifier(topic.key)) topicKeys.push(topic.key);
    if (Array.isArray(topic.skillKeys)) {
      skillKeys.push(...topic.skillKeys.filter(isIdentifier));
    }
  }
  return {
    blueprintId: session.id,
    topicKeys: topicKeys.filter(uniqueValue).sort(),
    skillKeys: skillKeys.filter(uniqueValue).sort()
  };
}

function collectResumeText(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 1_000);
  if (Array.isArray(value)) return value.map(collectResumeText).join(" ");
  if (!isRecord(value)) return "";
  return ["headline", "summary", "skills", "focusAreas", "experience", "projects", "achievements"]
    .map((key) => collectResumeText(value[key]))
    .join(" ")
    .slice(0, 40_000);
}

function toSeniority(value: string | null): ArchitectureDesignConfirmedFocus["seniority"] | null {
  if (value === "fresher" || value === "0-2") return "junior";
  if (value === "3-5") return "mid";
  if (value === "5-plus") return "senior";
  return null;
}

function defaultTargetJob(
  role: ArchitectureDesignConfirmedFocus["role"],
  seniority: ArchitectureDesignConfirmedFocus["seniority"]
): string {
  const level = seniority === "junior" ? "Junior" : seniority === "senior" ? "Senior" : "Mid-level";
  const roleLabel =
    role === "backend"
      ? "Backend"
      : role === "ai-ml"
        ? "AI/ML"
        : role === "frontend"
          ? "Frontend"
          : role === "data"
            ? "Data"
            : "Full-stack";
  return `${level} ${roleLabel} Engineer`;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueValue(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
