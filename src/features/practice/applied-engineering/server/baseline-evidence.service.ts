import { createHash } from "node:crypto";
import { z } from "zod";
import {
  APPLIED_ENGINEERING_BASELINE_EVIDENCE_SCHEMA_VERSION,
  APPLIED_ENGINEERING_BASELINE_REGISTRY_VERSION,
  appliedEngineeringBaselineEvidenceSchema,
  appliedEngineeringProductionSignalSchema,
  type AppliedEngineeringBaselineEvidence,
  type AppliedEngineeringBaselineState,
  type AppliedEngineeringProductionSignal
} from "@/features/practice/applied-engineering/domain";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

type BaselineEvidenceDatabase = {
  candidateProfile: {
    findUnique(args: unknown): Promise<{ preparationOnboarding: unknown } | null>;
  };
};

const onboardingTopicSchema = z
  .object({
    label: z.string().trim().min(2).max(120),
    familiarity: z.enum(["familiar", "needs-refresh", "unknown"])
  })
  .strict();

const onboardingSignalSchema = z
  .object({
    areaId: z.literal("applied-engineering"),
    score: z.null(),
    confidence: z.number().min(0).max(1),
    evidence: z.enum(["baseline", "not-enough-evidence"]),
    topics: z.array(onboardingTopicSchema).optional()
  })
  .passthrough();

const ONBOARDING_SIGNAL_KEYS = [
  "evidence-selection",
  "root-cause-reasoning",
  "customer-impact"
] as const satisfies readonly AppliedEngineeringProductionSignal[];

/** Converts the persisted onboarding pulse into immutable, answer-free evidence. */
export class AppliedEngineeringBaselineEvidenceService {
  constructor(private readonly database: BaselineEvidenceDatabase) {}

  async derive(ownerId: string): Promise<AppliedEngineeringBaselineEvidence> {
    const profile = await this.database.candidateProfile.findUnique({
      where: { ownerId },
      select: { preparationOnboarding: true }
    });
    if (!profile) {
      throw new NotFoundErrorException(
        "APPLIED_ENGINEERING_PROFILE_NOT_FOUND",
        "Your profile could not be found."
      );
    }

    const source = readSource(profile.preparationOnboarding);
    const state = baselineState(source.signal);
    const familiarity = productionReasoningFamiliarity(source.signal);
    const hasEvidence = source.signal?.evidence === "baseline";
    const strongSignalKeys =
      hasEvidence && familiarity === "familiar" ? [...ONBOARDING_SIGNAL_KEYS] : [];
    const weakSignalKeys =
      hasEvidence && familiarity === "needs-refresh" ? [...ONBOARDING_SIGNAL_KEYS] : [];
    const assessed = new Set<AppliedEngineeringProductionSignal>([
      ...strongSignalKeys,
      ...weakSignalKeys
    ]);
    const unassessedSignalKeys = appliedEngineeringProductionSignalSchema.options.filter(
      (key) => !assessed.has(key)
    );
    const normalizedSource = {
      evidenceSchemaVersion: APPLIED_ENGINEERING_BASELINE_EVIDENCE_SCHEMA_VERSION,
      registryVersion: APPLIED_ENGINEERING_BASELINE_REGISTRY_VERSION,
      questionId: source.questionId,
      signal: source.signal
        ? {
            areaId: source.signal.areaId,
            confidence: source.signal.confidence,
            evidence: source.signal.evidence,
            topics: source.signal.topics ?? []
          }
        : null
    };

    const evidence = appliedEngineeringBaselineEvidenceSchema.parse({
      schemaVersion: APPLIED_ENGINEERING_BASELINE_EVIDENCE_SCHEMA_VERSION,
      registryVersion: APPLIED_ENGINEERING_BASELINE_REGISTRY_VERSION,
      sourceFingerprint: fingerprint(JSON.stringify(normalizedSource)),
      source: "initial-baseline",
      state,
      evidence: hasEvidence ? "baseline" : "not-enough-evidence",
      confidence: hasEvidence ? source.signal!.confidence : 0,
      questionId: source.questionId,
      familiarity,
      weakSignalKeys,
      strongSignalKeys,
      unassessedSignalKeys,
      sourceTopicLabels: source.signal?.topics?.map((topic) => topic.label) ?? [],
      sourceAreaId: "applied-engineering"
    });
    return deepFreeze(evidence);
  }
}

function readSource(value: unknown): {
  questionId: string | null;
  signal: z.infer<typeof onboardingSignalSchema> | null;
} {
  if (!isRecord(value)) return { questionId: null, signal: null };
  const questionId =
    isRecord(value.questionIds) && typeof value.questionIds.engineering === "string"
      ? value.questionIds.engineering.slice(0, 180)
      : null;
  if (!isRecord(value.skillProfile) || !Array.isArray(value.skillProfile.signals)) {
    return { questionId, signal: null };
  }
  for (const rawSignal of value.skillProfile.signals) {
    const parsed = onboardingSignalSchema.safeParse(rawSignal);
    if (parsed.success) return { questionId, signal: parsed.data };
  }
  return { questionId, signal: null };
}

function productionReasoningFamiliarity(
  signal: z.infer<typeof onboardingSignalSchema> | null
): "familiar" | "needs-refresh" | "unknown" {
  if (!signal || signal.evidence !== "baseline") return "unknown";
  return (
    signal.topics?.find((topic) => topic.label.toLowerCase() === "production reasoning")
      ?.familiarity ?? "unknown"
  );
}

function baselineState(
  signal: z.infer<typeof onboardingSignalSchema> | null
): AppliedEngineeringBaselineState {
  const familiarity = productionReasoningFamiliarity(signal);
  if (familiarity === "needs-refresh") return "GUIDED";
  // A single onboarding pulse can support standard calibration, never stretch.
  if (familiarity === "familiar") return "STANDARD";
  return "UNKNOWN";
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
