import { createHash } from "node:crypto";
import { z } from "zod";
import {
  APPLIED_ENGINEERING_FOCUS_SCHEMA_VERSION,
  appliedEngineeringConfirmedFocusSchema,
  type AppliedEngineeringConfirmedFocus,
  type AppliedEngineeringProductionSignal
} from "@/lib/practice/applied-engineering";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { AppliedEngineeringBaselineEvidenceService } from "./baseline-evidence.service";

export const appliedEngineeringFocusConfirmationSchema = z
  .object({ language: z.literal("javascript") })
  .strict();

type FocusDatabase = {
  candidateProfile: {
    findUnique(args: unknown): Promise<{
      targetRole: string | null;
      level: string | null;
      targetCompany: string | null;
      targetDate: Date | null;
      headline: string | null;
      resumeAnalysis: unknown;
    } | null>;
  };
};

type FocusDependencies = {
  database: FocusDatabase;
  baselineEvidence: Pick<AppliedEngineeringBaselineEvidenceService, "derive">;
  now?: () => Date;
};

export type AppliedEngineeringFocusConfirmation = z.input<
  typeof appliedEngineeringFocusConfirmationSchema
>;

/** Builds the immutable, server-derived focus that the persistence step will version. */
export class AppliedEngineeringFocusService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: FocusDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async confirm(
    ownerId: string,
    rawConfirmation: AppliedEngineeringFocusConfirmation
  ): Promise<AppliedEngineeringConfirmedFocus> {
    const confirmation = appliedEngineeringFocusConfirmationSchema.parse(rawConfirmation);
    const [profile, baselineEvidence] = await Promise.all([
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
      this.dependencies.baselineEvidence.derive(ownerId)
    ]);
    if (!profile) {
      throw new NotFoundErrorException(
        "APPLIED_ENGINEERING_PROFILE_NOT_FOUND",
        "Your profile could not be found."
      );
    }
    if (profile.targetRole !== "backend" && profile.targetRole !== "fullstack") {
      throw new ConflictErrorException(
        "APPLIED_ENGINEERING_ROLE_UNSUPPORTED",
        "Applied Engineering currently supports Backend and Full-stack profiles."
      );
    }
    const seniority = toSeniority(profile.level);
    if (!seniority) {
      throw new BadRequestErrorException(
        "APPLIED_ENGINEERING_LEVEL_REQUIRED",
        "Choose an experience level before confirming Applied Engineering practice."
      );
    }

    const evidence = deriveResumeEvidence(profile.resumeAnalysis);
    const targetCompany = profile.targetCompany?.trim() || null;
    const targetDate = profile.targetDate?.toISOString().slice(0, 10) ?? null;
    const targetJob = profile.headline?.trim() || defaultTargetJob(profile.targetRole, seniority);
    const content = {
      schemaVersion: APPLIED_ENGINEERING_FOCUS_SCHEMA_VERSION,
      role: profile.targetRole,
      seniority,
      targetJob,
      targetCompany,
      targetDate,
      stack: {
        language: confirmation.language,
        runtime: "nodejs",
        runtimeVersion: "22 LTS",
        framework: deriveFramework(profile.resumeAnalysis)
      },
      excludedIncidentKeys: [],
      resumeEvidence: evidence,
      baselineEvidence
    } as const;
    const focus = appliedEngineeringConfirmedFocusSchema.parse({
      ...content,
      focusFingerprint: fingerprint(JSON.stringify(content)),
      confirmedAt: this.now().toISOString()
    });
    return deepFreeze(focus);
  }
}

const TECHNOLOGY_MATCHERS = {
  javascript: /\bjavascript\b/i,
  typescript: /\btypescript\b/i,
  nodejs: /\bnode(?:\.js|js)?\b/i,
  express: /\bexpress(?:\.js|js)?\b/i,
  nestjs: /\bnest(?:\.js|js)?\b/i,
  fastify: /\bfastify\b/i,
  nextjs: /\bnext(?:\.js|js)?\b/i,
  postgresql: /\b(?:postgres|postgresql)\b/i,
  mysql: /\bmysql\b/i,
  redis: /\bredis\b/i,
  kafka: /\bkafka\b/i,
  rabbitmq: /\brabbitmq\b/i,
  docker: /\bdocker\b/i,
  kubernetes: /\bkubernetes|\bk8s\b/i,
  aws: /\baws\b|amazon web services/i,
  gcp: /\bgcp\b|google cloud/i
} as const;

const SIGNAL_MATCHERS: ReadonlyArray<
  readonly [AppliedEngineeringProductionSignal, readonly RegExp[]]
> = [
  ["evidence-selection", [/\bdiagnos/i, /\bdebug/i, /root cause/i]],
  ["root-cause-reasoning", [/root cause/i, /\bincident/i, /postmortem/i]],
  ["data-integrity", [/data integrity/i, /\btransaction/i, /\bconsisten/i]],
  ["concurrency-control", [/\bconcurren/i, /race condition/i, /\blocking\b/i]],
  ["idempotency", [/idempoten/i, /deduplicat/i, /duplicate event/i]],
  ["bounded-work", [/backpressure/i, /rate limit/i, /bounded/i, /worker pool/i]],
  ["database-performance", [/query plan/i, /\bsql\b/i, /database performance/i, /indexing/i]],
  ["caching", [/\bcach(?:e|ing)\b/i, /\bredis\b/i]],
  ["retry-safety", [/\bretr(?:y|ies|ied)\b/i, /dead.?letter/i]],
  ["failure-isolation", [/circuit breaker/i, /graceful degradation/i, /fallback/i]],
  ["testing-verification", [/\btest/i, /quality assurance/i, /verification/i]],
  ["observability", [/observab/i, /\bmetrics?\b/i, /\btrac(?:e|ing)\b/i, /monitor/i]],
  ["security", [/\bsecur/i, /authorization/i, /authentication/i]],
  ["rollout-safety", [/\bcanary\b/i, /feature flag/i, /rollout/i, /deployment/i]],
  ["rollback-readiness", [/\brollback\b/i, /revert/i]],
  ["customer-impact", [/customer impact/i, /\bslo\b/i, /error budget/i]]
];

function deriveResumeEvidence(value: unknown): AppliedEngineeringConfirmedFocus["resumeEvidence"] {
  const text = resumeEvidenceText(value);
  const lower = text.toLowerCase();
  const technologyKeys = Object.entries(TECHNOLOGY_MATCHERS)
    .filter(([, matcher]) => matcher.test(lower))
    .map(([key]) => key)
    .sort();
  const productionSignalKeys = SIGNAL_MATCHERS.filter(([, matchers]) =>
    matchers.some((matcher) => matcher.test(lower))
  )
    .map(([key]) => key)
    .sort();
  const projectKeywords = [
    ...technologyKeys,
    ...productionSignalKeys,
    ...["api", "payment", "checkout", "order", "queue", "latency", "performance"].filter(
      (keyword) => lower.includes(keyword)
    )
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 30);
  return { technologyKeys, projectKeywords, productionSignalKeys };
}

function deriveFramework(value: unknown): string | null {
  const text = resumeEvidenceText(value);
  const candidates = ["nestjs", "express", "fastify", "nextjs"] as const;
  return candidates.find((key) => TECHNOLOGY_MATCHERS[key].test(text)) ?? null;
}

function resumeEvidenceText(value: unknown): string {
  if (!isRecord(value)) return "";
  return ["headline", "summary", "skills", "focusAreas", "experience", "projects", "achievements"]
    .flatMap((key) => collectStrings(value[key]))
    .join(" ")
    .slice(0, 40_000);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value.slice(0, 1_000)];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(collectStrings);
}

function toSeniority(value: string | null): AppliedEngineeringConfirmedFocus["seniority"] | null {
  if (value === "fresher" || value === "0-2") return "junior";
  if (value === "3-5") return "mid";
  if (value === "5-plus") return "senior";
  return null;
}

function defaultTargetJob(
  role: AppliedEngineeringConfirmedFocus["role"],
  seniority: AppliedEngineeringConfirmedFocus["seniority"]
): string {
  const level = seniority === "junior" ? "Junior" : seniority === "senior" ? "Senior" : "Mid-level";
  return `${level} ${role === "backend" ? "Backend" : "Full-stack"} Engineer`;
}

function fingerprint(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
