import { z } from "zod";
import {
  CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION,
  CORE_TECHNICAL_BASELINE_REGISTRY_VERSION,
  CORE_TECHNICAL_BASELINE_SECTIONS,
  coreTechnicalBaselineEvidenceSchema,
  type CoreTechnicalBaselineEvidence,
  type CoreTechnicalBaselineQuestionEvidence,
  type CoreTechnicalBaselineState
} from "@/lib/practice/core-technical/baseline-evidence-contracts";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/lib/practice/core-technical/domain-map";
import {
  fingerprintCoreTechnicalBaselineQuestion,
  hashCoreTechnicalBaselineSource,
  resolveCoreTechnicalBaselineRegistryEntry
} from "./baseline-evidence-registry";

type TechnicalSection = (typeof CORE_TECHNICAL_BASELINE_SECTIONS)[number];

type BaselineEvidenceDatabase = {
  candidateProfile: {
    findUnique(args: unknown): Promise<{ preparationOnboarding: unknown } | null>;
  };
  preparationBaselineQuestion: {
    findMany(args: unknown): Promise<Array<{ section: string; questionId: string; question: unknown }>>;
  };
};

const privateQuestionSchema = z.object({
  section: z.enum(CORE_TECHNICAL_BASELINE_SECTIONS),
  eyebrow: z.string(),
  title: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict()).min(2),
  correctOptionId: z.string().min(1),
  code: z.object({ value: z.string(), language: z.string().min(1) }).strict().optional()
}).strict();

const savedAnswerSchema = z.object({
  choiceId: z.string().min(1),
  answeredAt: z.number().finite().nonnegative()
}).strict();

/**
 * Reads private onboarding snapshots and returns only immutable, non-answer-bearing evidence.
 * The caller persists this object unchanged in the confirmed focus revision in Step 9/10.
 */
export class CoreTechnicalBaselineEvidenceService {
  constructor(private readonly prisma: BaselineEvidenceDatabase) {}

  async derive(ownerId: string): Promise<CoreTechnicalBaselineEvidence> {
    const [profile, rows] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { ownerId },
        select: { preparationOnboarding: true }
      }),
      this.prisma.preparationBaselineQuestion.findMany({
        where: { ownerId, section: { in: [...CORE_TECHNICAL_BASELINE_SECTIONS] } },
        select: { section: true, questionId: true, question: true }
      })
    ]);

    if (!profile) {
      throw new NotFoundErrorException(
        "CORE_TECHNICAL_PROFILE_NOT_FOUND",
        "Your profile could not be found."
      );
    }

    const answers = readAnswers(profile.preparationOnboarding);
    const rowsBySection = new Map<TechnicalSection, typeof rows>();
    for (const section of CORE_TECHNICAL_BASELINE_SECTIONS) {
      rowsBySection.set(section, rows.filter((row) => row.section === section));
    }

    const sourceRecords: unknown[] = [];
    const questions = CORE_TECHNICAL_BASELINE_SECTIONS.map((section) => {
      const sectionRows = rowsBySection.get(section) ?? [];
      const answer = answers.get(section);
      if (sectionRows.length === 0) {
        sourceRecords.push({ section, status: "MISSING", answer: answer ?? null });
        return unresolvedQuestion(section, "MISSING");
      }
      if (sectionRows.length !== 1) {
        sourceRecords.push({ section, status: "DUPLICATE", answer: answer ?? null });
        return unresolvedQuestion(section, "UNRESOLVABLE");
      }

      const row = sectionRows[0]!;
      const parsed = privateQuestionSchema.safeParse(row.question);
      if (!parsed.success || parsed.data.section !== section) {
        sourceRecords.push({ section, questionId: row.questionId, status: "INVALID", answer: answer ?? null });
        return unresolvedQuestion(section, "UNRESOLVABLE", row.questionId);
      }

      const questionFingerprint = fingerprintCoreTechnicalBaselineQuestion(parsed.data);
      const registryEntry = resolveCoreTechnicalBaselineRegistryEntry({
        section,
        questionId: row.questionId,
        questionFingerprint
      });
      const correctOptionExists = parsed.data.options.some(
        (option) => option.id === parsed.data.correctOptionId
      );
      const chosenOptionExists = answer
        ? parsed.data.options.some((option) => option.id === answer.choiceId)
        : false;

      if (!registryEntry || !correctOptionExists || (answer !== undefined && !chosenOptionExists)) {
        sourceRecords.push({
          section,
          questionId: row.questionId,
          questionFingerprint,
          status: "UNRESOLVABLE",
          answer: answer ?? null
        });
        return unresolvedQuestion(section, "UNRESOLVABLE", row.questionId, questionFingerprint);
      }

      const correctness = answer === undefined
        ? "UNANSWERED"
        : answer.choiceId === parsed.data.correctOptionId
          ? "CORRECT"
          : "INCORRECT";
      // Include only the derived grade in the source digest. This notices an
      // answer-key change that affects evidence without putting an enumerable
      // private option ID into either public fingerprint.
      sourceRecords.push({
        section,
        questionId: row.questionId,
        questionFingerprint,
        answer: answer ?? null,
        correctness
      });

      return {
        section,
        resolution: "RESOLVED",
        questionId: row.questionId,
        questionFingerprint,
        conceptKeys: [...registryEntry.conceptKeys],
        mechanismKeys: [...registryEntry.mechanismKeys],
        correctness
      } satisfies CoreTechnicalBaselineQuestionEvidence;
    });

    const validAnswerCount = questions.filter(
      (question) => question.correctness === "CORRECT" || question.correctness === "INCORRECT"
    ).length;
    const correctAnswerCount = questions.filter(
      (question) => question.correctness === "CORRECT"
    ).length;
    const state = calibrate(questions, validAnswerCount, correctAnswerCount);
    const aggregates = aggregateSignals(questions);
    const sourceFingerprint = hashCoreTechnicalBaselineSource(JSON.stringify({
      evidenceSchemaVersion: CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION,
      registryVersion: CORE_TECHNICAL_BASELINE_REGISTRY_VERSION,
      records: sourceRecords
    }));

    const evidence = coreTechnicalBaselineEvidenceSchema.parse({
      schemaVersion: CORE_TECHNICAL_BASELINE_EVIDENCE_SCHEMA_VERSION,
      registryVersion: CORE_TECHNICAL_BASELINE_REGISTRY_VERSION,
      sourceFingerprint,
      state,
      validAnswerCount,
      correctAnswerCount,
      questions,
      ...aggregates
    });
    return deepFreeze(evidence);
  }
}

function readAnswers(value: unknown): Map<TechnicalSection, z.infer<typeof savedAnswerSchema>> {
  const output = new Map<TechnicalSection, z.infer<typeof savedAnswerSchema>>();
  if (!isRecord(value) || !isRecord(value.answers)) return output;
  for (const section of CORE_TECHNICAL_BASELINE_SECTIONS) {
    const answer = savedAnswerSchema.safeParse(value.answers[section]);
    if (answer.success) output.set(section, answer.data);
  }
  return output;
}

function unresolvedQuestion(
  section: TechnicalSection,
  resolution: "MISSING" | "UNRESOLVABLE",
  questionId: string | null = null,
  questionFingerprint: string | null = null
): CoreTechnicalBaselineQuestionEvidence {
  return {
    section,
    resolution,
    questionId,
    questionFingerprint,
    conceptKeys: [],
    mechanismKeys: [],
    correctness: "UNKNOWN"
  };
}

function calibrate(
  questions: CoreTechnicalBaselineQuestionEvidence[],
  validAnswerCount: number,
  correctAnswerCount: number
): CoreTechnicalBaselineState {
  if (
    validAnswerCount !== CORE_TECHNICAL_BASELINE_SECTIONS.length ||
    questions.some((question) => question.resolution !== "RESOLVED")
  ) return "UNKNOWN";
  if (correctAnswerCount <= 1) return "GUIDED";
  if (correctAnswerCount === 2) return "STANDARD";
  return "STRETCH";
}

function aggregateSignals(questions: CoreTechnicalBaselineQuestionEvidence[]) {
  const weakConcepts = collect(questions, "INCORRECT", "conceptKeys");
  const strongConcepts = collect(questions, "CORRECT", "conceptKeys");
  const weakMechanisms = collect(questions, "INCORRECT", "mechanismKeys");
  const strongMechanisms = collect(questions, "CORRECT", "mechanismKeys");
  const domainConcepts = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key).sort();
  const domainMechanisms = [...new Set(
    NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys)
  )].sort();
  return {
    weakConceptKeys: weakConcepts,
    strongConceptKeys: without(strongConcepts, weakConcepts),
    unassessedConceptKeys: without(domainConcepts, [...weakConcepts, ...strongConcepts]),
    weakMechanismKeys: weakMechanisms,
    strongMechanismKeys: without(strongMechanisms, weakMechanisms),
    unassessedMechanismKeys: without(domainMechanisms, [...weakMechanisms, ...strongMechanisms])
  };
}

function collect(
  questions: CoreTechnicalBaselineQuestionEvidence[],
  correctness: CoreTechnicalBaselineQuestionEvidence["correctness"],
  key: "conceptKeys" | "mechanismKeys"
): string[] {
  return [...new Set(questions.filter((question) => question.correctness === correctness).flatMap((question) => question[key]))].sort();
}

function without(values: string[], excluded: string[]): string[] {
  const excludedSet = new Set(excluded);
  return values.filter((value) => !excludedSet.has(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
