import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CORE_TECHNICAL_FOCUS_SCHEMA_VERSION,
  coreTechnicalConfirmedFocusSchema,
  type CoreTechnicalConfirmedFocus
} from "@/lib/practice/core-technical/focus-ranking-contracts";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/lib/practice/core-technical/domain-map";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { CoreTechnicalBaselineEvidenceService } from "./baseline-evidence.service";

export const coreTechnicalFocusConfirmationSchema = z
  .object({
    language: z.literal("javascript")
  })
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
  prisma: FocusDatabase;
  baselineEvidence: Pick<CoreTechnicalBaselineEvidenceService, "derive">;
  now?: () => Date;
};

export type CoreTechnicalFocusConfirmation = z.input<typeof coreTechnicalFocusConfirmationSchema>;

/** Builds the immutable focus payload that Step 10 persists as a revision. */
export class CoreTechnicalFocusService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: FocusDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async confirm(
    ownerId: string,
    rawConfirmation: CoreTechnicalFocusConfirmation
  ): Promise<CoreTechnicalConfirmedFocus> {
    const confirmation = coreTechnicalFocusConfirmationSchema.parse(rawConfirmation);
    const [profile, baselineEvidence] = await Promise.all([
      this.dependencies.prisma.candidateProfile.findUnique({
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
        "CORE_TECHNICAL_PROFILE_NOT_FOUND",
        "Your profile could not be found."
      );
    }
    if (profile.targetRole !== "backend" && profile.targetRole !== "fullstack") {
      throw new ConflictErrorException(
        "CORE_TECHNICAL_ROLE_UNSUPPORTED",
        "Core Technical practice currently supports Backend and Full-stack profiles."
      );
    }

    const seniority = toSeniority(profile.level);
    if (!seniority) {
      throw new BadRequestErrorException(
        "CORE_TECHNICAL_LEVEL_REQUIRED",
        "Choose an experience level before confirming Core Technical practice."
      );
    }

    const resumeEvidence = deriveResumeEvidence(profile.resumeAnalysis);
    const targetCompany = profile.targetCompany?.trim() || null;
    const targetDate = profile.targetDate?.toISOString().slice(0, 10) ?? null;
    const targetJob = profile.headline?.trim() || defaultTargetJob(profile.targetRole, seniority);
    const content = {
      schemaVersion: CORE_TECHNICAL_FOCUS_SCHEMA_VERSION,
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
      excludedTopicKeys: [],
      resumeEvidence,
      baselineEvidence
    } as const;
    const focusFingerprint = fingerprint(JSON.stringify(content));
    const focus = coreTechnicalConfirmedFocusSchema.parse({
      ...content,
      focusFingerprint,
      confirmedAt: this.now().toISOString()
    });
    return deepFreeze(focus);
  }
}

function deriveFramework(value: unknown): string | null {
  const text = resumeEvidenceText(value).toLowerCase();
  const frameworks = [
    ["nestjs", /\bnest(?:\.js|js)?\b/i],
    ["express", /\bexpress(?:\.js|js)?\b/i],
    ["fastify", /\bfastify\b/i],
    ["koa", /\bkoa(?:\.js|js)?\b/i],
    ["nextjs", /\bnext(?:\.js|js)?\b/i]
  ] as const;
  return frameworks.find(([, matcher]) => matcher.test(text))?.[0] ?? null;
}

function deriveResumeEvidence(value: unknown): CoreTechnicalConfirmedFocus["resumeEvidence"] {
  const text = resumeEvidenceText(value).toLowerCase();
  const topicKeys = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics
    .filter((topic) => TOPIC_MATCHERS[topic.key]?.some((matcher) => matcher.test(text)))
    .map((topic) => topic.key)
    .sort();
  const selected = new Set(topicKeys);
  const mechanismKeys = [
    ...new Set(
      NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics
        .filter((topic) => selected.has(topic.key))
        .flatMap((topic) => topic.mechanismKeys)
    )
  ].sort();
  return { topicKeys, mechanismKeys };
}

const TOPIC_MATCHERS: Record<string, readonly RegExp[]> = {
  "javascript-values-and-mutation": [/\bjavascript\b/i, /\btypescript\b/i, /\bstate management\b/i],
  "javascript-scope-and-closures": [/\bclosure/i, /\blexical scope\b/i],
  "javascript-modules": [/\bcommonjs\b/i, /\besm\b/i, /\bmodule/i, /\bpackage exports\b/i],
  "async-scheduling": [/\basync/i, /\bpromise/i, /\bconcurren/i, /\bevent loop\b/i],
  "errors-and-cancellation": [
    /\bcancel/i,
    /\btimeout/i,
    /\bretr(?:y|ies|ied)/i,
    /\berror handling\b/i
  ],
  "nodejs-event-loop-health": [/\bevent loop\b/i, /\blatency\b/i, /\bperformance\b/i],
  "nodejs-streams-and-io": [/\bstream/i, /\bbackpressure\b/i, /\bbuffer/i, /\bfile upload/i],
  "nodejs-resource-lifecycle": [
    /\bmemory leak\b/i,
    /\bresource cleanup\b/i,
    /\blistener/i,
    /\btimer/i
  ],
  "nodejs-work-isolation": [/\bworker thread/i, /\bworker pool/i, /\bcpu-bound\b/i],
  "nodejs-testing-and-diagnostics": [/\btest/i, /\bdebug/i, /\bobservab/i, /\btrace/i, /\bmonitor/i]
};

function resumeEvidenceText(value: unknown): string {
  if (!isRecord(value)) return "";
  const allowed = [
    "headline",
    "summary",
    "skills",
    "focusAreas",
    "stories",
    "experience",
    "projects",
    "achievements"
  ];
  return allowed
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

function toSeniority(value: string | null): CoreTechnicalConfirmedFocus["seniority"] | null {
  if (value === "fresher" || value === "0-2") return "junior";
  if (value === "3-5") return "mid";
  if (value === "5-plus") return "senior";
  return null;
}

function defaultTargetJob(
  role: CoreTechnicalConfirmedFocus["role"],
  seniority: CoreTechnicalConfirmedFocus["seniority"]
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
