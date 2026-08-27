import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION,
  parseCandidatePracticeEvidence,
  type CandidatePracticeEvidence
} from "@/lib/practice/practice-evidence";
import {
  PROBLEM_SOLVING_SKILL_KEY,
  dsaPatternSkillKey
} from "@/lib/interviews/performance-profile";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import type { PrismaService } from "../database/prisma.service";
import {
  aggregateCandidatePracticeEvidence,
  practiceEvidenceSourceFingerprint,
  type VerifiedPracticeAttemptInput
} from "./practice-evidence-aggregator";

const attemptSelect = {
  id: true,
  sourceType: true,
  dsaQuestionSlug: true,
  prepQuestionTemplateId: true,
  language: true,
  score: true,
  correctness: true,
  questionContentVersion: true,
  evaluatorVersion: true,
  verificationStatus: true,
  feedback: true,
  createdAt: true,
  dsaQuestion: {
    select: {
      slug: true,
      title: true,
      primaryPattern: true,
      subPatterns: true,
      difficulty: true
    }
  },
  prepQuestionTemplate: {
    select: {
      id: true,
      title: true,
      format: true,
      difficulty: true,
      competency: true,
      chapterKey: true,
      tags: true,
      whatItTests: true
    }
  }
} as const;

type AttemptRecord = Prisma.UserQuestionAttemptGetPayload<{ select: typeof attemptSelect }>;

/** Immutable Practice evidence boundary. Consumers can refresh or read; attempts remain untouched. */
export class PracticeEvidenceStore {
  constructor(private readonly prisma: PrismaService) {}

  async refresh(ownerId: string, now = Date.now()): Promise<CandidatePracticeEvidence | null> {
    const records = await this.prisma.userQuestionAttempt.findMany({
      where: {
        ownerId,
        sourceType: { in: ["PREP", "DSA"] },
        verificationStatus: "VERIFIED",
        score: { not: null },
        questionContentVersion: { not: null },
        evaluatorVersion: { not: null }
      },
      select: attemptSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const attempts = records.flatMap(normalizeAttempt);
    if (!attempts.length) return null;

    const sourceAttemptFingerprint = practiceEvidenceSourceFingerprint(attempts, now);
    const existing = await this.prisma.candidatePracticeEvidenceVersion.findUnique({
      where: {
        ownerId_sourceAttemptFingerprint_schemaVersion: {
          ownerId,
          sourceAttemptFingerprint,
          schemaVersion: CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION
        }
      }
    });
    if (existing) return evidenceFromRecord(existing);

    try {
      const stored = await this.prisma.$transaction(async (transaction) => {
        const duplicate = await transaction.candidatePracticeEvidenceVersion.findUnique({
          where: {
            ownerId_sourceAttemptFingerprint_schemaVersion: {
              ownerId,
              sourceAttemptFingerprint,
              schemaVersion: CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION
            }
          }
        });
        if (duplicate) return duplicate;

        const latest = await transaction.candidatePracticeEvidenceVersion.findFirst({
          where: { ownerId },
          orderBy: { revision: "desc" },
          select: { revision: true }
        });
        const evidence = aggregateCandidatePracticeEvidence({
          id: randomUUID(),
          revision: (latest?.revision ?? 0) + 1,
          attempts,
          generatedAt: now,
          sourceAttemptFingerprint
        });
        if (!evidence) return null;

        return transaction.candidatePracticeEvidenceVersion.create({
          data: {
            id: evidence.id,
            ownerId,
            revision: evidence.revision,
            schemaVersion: evidence.schemaVersion,
            sourceAttemptFingerprint: evidence.sourceAttemptFingerprint,
            verifiedAttemptCount: evidence.verifiedAttemptCount,
            verifiedQuestionCount: evidence.verifiedQuestionCount,
            evidence: toJson(evidence),
            generatedAt: new Date(evidence.generatedAt)
          }
        });
      });
      return stored ? evidenceFromRecord(stored) : null;
    } catch (error) {
      const winner = await this.prisma.candidatePracticeEvidenceVersion
        .findUnique({
          where: {
            ownerId_sourceAttemptFingerprint_schemaVersion: {
              ownerId,
              sourceAttemptFingerprint,
              schemaVersion: CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION
            }
          }
        })
        .catch(() => null);
      if (winner) return evidenceFromRecord(winner);
      throw error;
    }
  }

  async latest(ownerId: string): Promise<CandidatePracticeEvidence | null> {
    const stored = await this.prisma.candidatePracticeEvidenceVersion.findFirst({
      where: { ownerId },
      orderBy: { revision: "desc" }
    });
    return stored ? evidenceFromRecord(stored) : null;
  }
}

function normalizeAttempt(record: AttemptRecord): VerifiedPracticeAttemptInput[] {
  if (
    record.verificationStatus !== "VERIFIED" ||
    record.score === null ||
    record.questionContentVersion === null ||
    !record.evaluatorVersion
  ) {
    return [];
  }
  const feedback = jsonObject(record.feedback);
  const hintsUsed = nonNegativeInteger(feedback?.hintsUsed);
  const testsPassed = nonNegativeInteger(feedback?.testsPassed);
  const testCount = nonNegativeInteger(feedback?.testCount);

  if (record.sourceType === "DSA" && record.dsaQuestion) {
    const pattern = slug(record.dsaQuestion.primaryPattern);
    return [
      {
        id: record.id,
        questionId: record.dsaQuestion.slug,
        sourceType: "DSA",
        verificationStatus: "VERIFIED",
        title: record.dsaQuestion.title,
        format: record.language ? "code" : "typed",
        score: record.score * 100,
        difficulty: practiceDifficulty(record.dsaQuestion.difficulty),
        observedAt: record.createdAt.getTime(),
        questionContentVersion: record.questionContentVersion,
        evaluatorVersion: record.evaluatorVersion,
        skillKeys: [PROBLEM_SOLVING_SKILL_KEY, dsaPatternSkillKey(pattern)],
        topicKeys: unique([
          `dsa:${pattern}`,
          ...record.dsaQuestion.subPatterns.map((value) => `dsa:${slug(value)}`)
        ]),
        hintsUsed,
        language: record.language,
        accepted: record.correctness === "accepted",
        testsPassed,
        testCount
      }
    ];
  }

  if (record.sourceType === "PREP" && record.prepQuestionTemplate) {
    const question = record.prepQuestionTemplate;
    const competency = slug(question.competency);
    const tags = question.tags.map(slug).filter(isUsefulSkillTag);
    return [
      {
        id: record.id,
        questionId: question.id,
        sourceType: "PREP",
        verificationStatus: "VERIFIED",
        title: question.title,
        format: practiceFormat(question.format),
        score: record.score * 100,
        difficulty: practiceDifficulty(question.difficulty),
        observedAt: record.createdAt.getTime(),
        questionContentVersion: record.questionContentVersion,
        evaluatorVersion: record.evaluatorVersion,
        skillKeys: unique([competency, ...tags]),
        topicKeys: unique([
          competency,
          `chapter:${slug(question.chapterKey)}`,
          ...question.tags.map(slug),
          ...question.whatItTests.map(slug)
        ]),
        hintsUsed
      }
    ];
  }
  return [];
}

function evidenceFromRecord(record: {
  id: string;
  revision: number;
  schemaVersion: number;
  sourceAttemptFingerprint: string;
  verifiedAttemptCount: number;
  verifiedQuestionCount: number;
  evidence: Prisma.JsonValue;
  generatedAt: Date;
}): CandidatePracticeEvidence {
  const evidence = parseCandidatePracticeEvidence(record.evidence);
  if (
    evidence.id !== record.id ||
    evidence.revision !== record.revision ||
    evidence.schemaVersion !== record.schemaVersion ||
    evidence.sourceAttemptFingerprint !== record.sourceAttemptFingerprint ||
    evidence.verifiedAttemptCount !== record.verifiedAttemptCount ||
    evidence.verifiedQuestionCount !== record.verifiedQuestionCount ||
    evidence.generatedAt !== record.generatedAt.getTime()
  ) {
    throw new ConflictErrorException(
      "PRACTICE_EVIDENCE_SNAPSHOT_MISMATCH",
      "Stored Practice evidence metadata does not match its immutable snapshot.",
      { practiceEvidenceVersionId: record.id }
    );
  }
  return evidence;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, Prisma.JsonValue>;
}

function nonNegativeInteger(value: Prisma.JsonValue | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function practiceFormat(value: string): VerifiedPracticeAttemptInput["format"] {
  if (["mcq", "typed", "spoken", "diagram", "code"].includes(value)) {
    return value as VerifiedPracticeAttemptInput["format"];
  }
  return "typed";
}

function practiceDifficulty(value: string): VerifiedPracticeAttemptInput["difficulty"] {
  const normalized = value.trim().toLowerCase();
  if (["easy", "beginner", "foundational"].includes(normalized)) return "easy";
  if (["hard", "advanced"].includes(normalized)) return "hard";
  return "medium";
}

const GENERIC_SKILL_TAGS = new Set([
  "core",
  "frontend",
  "backend",
  "fullstack",
  "medium",
  "hard",
  "easy",
  "fundamental",
  "applied-engineering",
  "system-design"
]);

function isUsefulSkillTag(value: string): boolean {
  return value.length > 1 && !GENERIC_SKILL_TAGS.has(value);
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:+]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
