import { z } from "zod";
import {
  ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_SCHEMA_VERSION,
  ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION,
  architectureDesignBaselineEvidenceSchema,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignBaselineState
} from "@/lib/practice/architecture-design/baseline-evidence-contracts";
import {
  architectureDesignDimensionSchema,
  type ArchitectureDesignDimension
} from "@/lib/practice/architecture-design/contracts";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import {
  fingerprintArchitectureDesignBaselineQuestion,
  hashArchitectureDesignBaselineSource,
  resolveArchitectureDesignBaselineRegistryEntry
} from "./baseline-evidence-registry";

type BaselineEvidenceDatabase = {
  candidateProfile: {
    findUnique(args: unknown): Promise<{ preparationOnboarding: unknown } | null>;
  };
  preparationBaselineQuestion: {
    findMany(
      args: unknown
    ): Promise<Array<{ section: string; questionId: string; question: unknown }>>;
  };
};

const privateQuestionSchema = z
  .object({
    section: z.literal("architecture"),
    eyebrow: z.string(),
    title: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict()).min(2),
    correctOptionId: z.string().min(1)
  })
  .strict();

const savedAnswerSchema = z
  .object({ choiceId: z.string().min(1), answeredAt: z.number().finite().nonnegative() })
  .strict();

const publicSignalSchema = z
  .object({
    areaId: z.literal("architecture-design"),
    score: z.null(),
    confidence: z.number().min(0).max(1),
    evidence: z.enum(["baseline", "not-enough-evidence"]),
    topics: z
      .array(
        z
          .object({
            label: z.literal("System design judgment"),
            familiarity: z.enum(["familiar", "needs-refresh", "unknown"])
          })
          .strict()
      )
      .optional()
  })
  .passthrough();

/** Resolves the owner-scoped private snapshot into immutable, answer-free Architecture evidence. */
export class ArchitectureDesignBaselineEvidenceService {
  constructor(private readonly database: BaselineEvidenceDatabase) {}

  async derive(ownerId: string): Promise<ArchitectureDesignBaselineEvidence> {
    const [profile, rows] = await Promise.all([
      this.database.candidateProfile.findUnique({
        where: { ownerId },
        select: { preparationOnboarding: true }
      }),
      this.database.preparationBaselineQuestion.findMany({
        where: { ownerId, section: "architecture" },
        select: { section: true, questionId: true, question: true }
      })
    ]);
    if (!profile) {
      throw new NotFoundErrorException(
        "ARCHITECTURE_DESIGN_PROFILE_NOT_FOUND",
        "Your profile could not be found."
      );
    }

    const source = readOnboardingSource(profile.preparationOnboarding);
    const resolved = resolvePrivateEvidence(rows, source.answer);
    const state = calibrate(resolved.resolution, resolved.correctness);
    const signalConsistency = compareSignal(source.signal, state);
    const weakDimensionKeys = resolved.correctness === "INCORRECT" ? resolved.dimensionKeys : [];
    const strongDimensionKeys = resolved.correctness === "CORRECT" ? resolved.dimensionKeys : [];
    const assessed = new Set<ArchitectureDesignDimension>([
      ...weakDimensionKeys,
      ...strongDimensionKeys
    ]);
    const unassessedDimensionKeys = architectureDesignDimensionSchema.options.filter(
      (key) => !assessed.has(key)
    );
    const sourceFingerprint = hashArchitectureDesignBaselineSource(
      JSON.stringify({
        evidenceSchemaVersion: ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_SCHEMA_VERSION,
        registryVersion: ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION,
        questionId: resolved.questionId,
        questionFingerprint: resolved.questionFingerprint,
        resolution: resolved.resolution,
        correctness: resolved.correctness,
        signalConsistency
      })
    );

    return deepFreeze(
      architectureDesignBaselineEvidenceSchema.parse({
        schemaVersion: ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_SCHEMA_VERSION,
        registryVersion: ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION,
        sourceFingerprint,
        ...resolved,
        state,
        weakDimensionKeys,
        strongDimensionKeys,
        unassessedDimensionKeys,
        signalConsistency
      })
    );
  }
}

function resolvePrivateEvidence(
  rows: Array<{ section: string; questionId: string; question: unknown }>,
  answer: SavedAnswer
) {
  if (rows.length === 0) return unresolved("MISSING");
  if (rows.length !== 1) return unresolved("UNRESOLVABLE");
  const row = rows[0]!;
  const question = privateQuestionSchema.safeParse(row.question);
  if (!question.success || row.section !== "architecture") {
    return unresolved("UNRESOLVABLE", row.questionId);
  }
  const questionFingerprint = fingerprintArchitectureDesignBaselineQuestion(question.data);
  const registry = resolveArchitectureDesignBaselineRegistryEntry({
    questionId: row.questionId,
    questionFingerprint
  });
  const correctOptionExists = question.data.options.some(
    ({ id }) => id === question.data.correctOptionId
  );
  const chosenOptionExists =
    answer.status === "valid"
      ? question.data.options.some(({ id }) => id === answer.value.choiceId)
      : false;
  if (
    !registry ||
    !correctOptionExists ||
    answer.status === "invalid" ||
    (answer.status === "valid" && !chosenOptionExists)
  ) {
    return unresolved("UNRESOLVABLE", row.questionId, questionFingerprint);
  }
  return {
    questionId: row.questionId,
    questionFingerprint,
    resolution: "RESOLVED" as const,
    correctness:
      answer.status === "missing"
        ? ("UNKNOWN" as const)
        : answer.value.choiceId === question.data.correctOptionId
          ? ("CORRECT" as const)
          : ("INCORRECT" as const),
    dimensionKeys: [...registry.dimensionKeys]
  };
}

function unresolved(
  resolution: "MISSING" | "UNRESOLVABLE",
  questionId: string | null = null,
  questionFingerprint: string | null = null
) {
  return {
    questionId,
    questionFingerprint,
    resolution,
    correctness: "UNKNOWN" as const,
    dimensionKeys: [] as ArchitectureDesignDimension[]
  };
}

function readOnboardingSource(value: unknown): {
  answer: SavedAnswer;
  signal: z.infer<typeof publicSignalSchema> | null;
} {
  if (!isRecord(value)) return { answer: { status: "missing" }, signal: null };
  const rawAnswer = isRecord(value.answers) ? value.answers.architecture : undefined;
  const parsedAnswer = rawAnswer === undefined ? null : savedAnswerSchema.safeParse(rawAnswer);
  const answer: SavedAnswer =
    parsedAnswer === null
      ? { status: "missing" }
      : parsedAnswer.success
        ? { status: "valid", value: parsedAnswer.data }
        : { status: "invalid" };
  const rawSignals =
    isRecord(value.skillProfile) && Array.isArray(value.skillProfile.signals)
      ? value.skillProfile.signals
      : [];
  const signal = rawSignals
    .map((candidate) => publicSignalSchema.safeParse(candidate))
    .find((candidate) => candidate.success);
  return {
    answer,
    signal: signal?.success ? signal.data : null
  };
}

type SavedAnswer =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "valid"; value: z.infer<typeof savedAnswerSchema> };

function calibrate(
  resolution: ArchitectureDesignBaselineEvidence["resolution"],
  correctness: ArchitectureDesignBaselineEvidence["correctness"]
): ArchitectureDesignBaselineState {
  if (resolution !== "RESOLVED") return "UNKNOWN";
  if (correctness === "CORRECT") return "STANDARD";
  if (correctness === "INCORRECT") return "GUIDED";
  return "UNKNOWN";
}

function compareSignal(
  signal: z.infer<typeof publicSignalSchema> | null,
  state: ArchitectureDesignBaselineState
): "CONSISTENT" | "INCONSISTENT" | "UNAVAILABLE" {
  const familiarity = signal?.topics?.[0]?.familiarity;
  if (!signal || !familiarity || familiarity === "unknown") return "UNAVAILABLE";
  return (state === "STANDARD" && familiarity === "familiar") ||
    (state === "GUIDED" && familiarity === "needs-refresh")
    ? "CONSISTENT"
    : "INCONSISTENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
