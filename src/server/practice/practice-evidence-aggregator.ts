import { createHash } from "node:crypto";
import {
  CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION,
  PRACTICE_MASTERY_SCORE,
  PRACTICE_WEAK_SCORE,
  parseCandidatePracticeEvidence,
  type CandidatePracticeEvidence,
  type PracticeCodeEvidence,
  type PracticeSkillEvidence,
  type PracticeTopicEvidence,
  type RecentPracticeQuestionEvidence
} from "@/lib/practice/practice-evidence";

export interface VerifiedPracticeAttemptInput {
  id: string;
  questionId: string;
  sourceType: "PREP" | "DSA";
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "NOT_APPLICABLE" | null;
  title: string;
  format: "mcq" | "typed" | "spoken" | "diagram" | "code";
  score: number;
  difficulty: "easy" | "medium" | "hard";
  observedAt: number;
  questionContentVersion: number;
  evaluatorVersion: string;
  skillKeys: string[];
  topicKeys: string[];
  hintsUsed: number;
  language?: string | null;
  accepted?: boolean | null;
  testsPassed?: number | null;
  testCount?: number | null;
}

export interface AggregateCandidatePracticeEvidenceInput {
  id: string;
  revision: number;
  attempts: VerifiedPracticeAttemptInput[];
  generatedAt?: number;
  sourceAttemptFingerprint?: string;
}

interface Observation {
  attemptId: string;
  questionId: string;
  score: number;
  observedAt: number;
  hintsUsed: number;
  attemptOrdinal: number;
  topicKeys: string[];
  difficulty: VerifiedPracticeAttemptInput["difficulty"];
}

/** Fingerprints only immutable, verified attempt fields; input order cannot change it. */
export function practiceEvidenceSourceFingerprint(
  attempts: VerifiedPracticeAttemptInput[],
  asOf = Date.now()
): string {
  const sources = {
    // Monthly bucketing lets recency decay without churning a plan on every read.
    recencyBucket: new Date(asOf).toISOString().slice(0, 7),
    attempts: verifiedAttempts(attempts)
      .map((attempt) => ({
        id: attempt.id,
        questionId: attempt.questionId,
        sourceType: attempt.sourceType,
        score: roundScore(attempt.score),
        difficulty: attempt.difficulty,
        observedAt: attempt.observedAt,
        questionContentVersion: attempt.questionContentVersion,
        evaluatorVersion: attempt.evaluatorVersion,
        skillKeys: unique(attempt.skillKeys).sort(),
        topicKeys: unique(attempt.topicKeys).sort(),
        hintsUsed: Math.max(0, Math.floor(attempt.hintsUsed)),
        language: attempt.language ?? null,
        accepted: attempt.accepted ?? null,
        testsPassed: attempt.testsPassed ?? null,
        testCount: attempt.testCount ?? null
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  };
  return `sha256-${createHash("sha256").update(JSON.stringify(sources)).digest("hex")}`;
}

/** Builds the read-only, versioned signal consumed by future plan revisions. */
export function aggregateCandidatePracticeEvidence(
  input: AggregateCandidatePracticeEvidenceInput
): CandidatePracticeEvidence | null {
  const attempts = verifiedAttempts(input.attempts).sort(
    (left, right) => left.observedAt - right.observedAt || left.id.localeCompare(right.id)
  );
  if (!attempts.length) return null;
  const generatedAt = input.generatedAt ?? Date.now();

  const attemptOrdinals = new Map<string, number>();
  const normalized = attempts.map((attempt) => {
    const attemptOrdinal = (attemptOrdinals.get(attempt.questionId) ?? 0) + 1;
    attemptOrdinals.set(attempt.questionId, attemptOrdinal);
    return { attempt, attemptOrdinal };
  });
  const skillObservations = new Map<string, Observation[]>();
  const topicObservations = new Map<string, Observation[]>();

  for (const { attempt, attemptOrdinal } of normalized) {
    const observation: Observation = {
      attemptId: attempt.id,
      questionId: attempt.questionId,
      score: clampScore(attempt.score),
      observedAt: attempt.observedAt,
      hintsUsed: Math.max(0, Math.floor(attempt.hintsUsed)),
      attemptOrdinal,
      topicKeys: unique(attempt.topicKeys),
      difficulty: attempt.difficulty
    };
    for (const skillKey of unique(attempt.skillKeys)) {
      append(skillObservations, skillKey, observation);
    }
    for (const topicKey of observation.topicKeys) {
      append(topicObservations, topicKey, observation);
    }
  }

  const topics = [...topicObservations.entries()]
    .map(([topicKey, values]) => topicEvidence(topicKey, values, generatedAt))
    .sort((left, right) => left.topicKey.localeCompare(right.topicKey));
  const recentQuestions: RecentPracticeQuestionEvidence[] = normalized
    .slice()
    .sort((left, right) =>
      right.attempt.observedAt - left.attempt.observedAt ||
      right.attempt.id.localeCompare(left.attempt.id)
    )
    .slice(0, 25)
    .map(({ attempt, attemptOrdinal }) => ({
      attemptId: attempt.id,
      questionId: attempt.questionId,
      sourceType: attempt.sourceType,
      title: attempt.title,
      format: attempt.format,
      score: clampScore(attempt.score),
      observedAt: attempt.observedAt,
      hintsUsed: Math.max(0, Math.floor(attempt.hintsUsed)),
      attemptOrdinal,
      topicKeys: unique(attempt.topicKeys)
    }));
  const codeEvidence: PracticeCodeEvidence[] = normalized
    .filter(({ attempt }) => attempt.format === "code" && Boolean(attempt.language))
    .sort((left, right) => right.attempt.observedAt - left.attempt.observedAt)
    .slice(0, 25)
    .map(({ attempt }) => ({
      attemptId: attempt.id,
      questionId: attempt.questionId,
      language: attempt.language!,
      score: clampScore(attempt.score),
      accepted: attempt.accepted === true,
      testsPassed: Math.max(0, Math.floor(attempt.testsPassed ?? 0)),
      testCount: Math.max(0, Math.floor(attempt.testCount ?? 0)),
      observedAt: attempt.observedAt
    }));

  return parseCandidatePracticeEvidence({
    schemaVersion: CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION,
    id: input.id,
    revision: input.revision,
    sourceAttemptFingerprint:
      input.sourceAttemptFingerprint ?? practiceEvidenceSourceFingerprint(attempts, generatedAt),
    generatedAt,
    verifiedAttemptCount: attempts.length,
    verifiedQuestionCount: new Set(attempts.map((attempt) => attempt.questionId)).size,
    sourceAttemptIds: attempts.map((attempt) => attempt.id),
    skills: [...skillObservations.entries()]
      .map(([skillKey, values]) => skillEvidence(skillKey, values, generatedAt))
      .sort((left, right) => left.skillKey.localeCompare(right.skillKey)),
    masteryTopics: topics.filter((topic) => topic.score >= PRACTICE_MASTERY_SCORE),
    weakTopics: topics.filter((topic) => topic.score < PRACTICE_WEAK_SCORE),
    recentQuestions,
    codeEvidence
  });
}

function verifiedAttempts(attempts: VerifiedPracticeAttemptInput[]): VerifiedPracticeAttemptInput[] {
  return attempts.filter(
    (attempt) =>
      attempt.verificationStatus === "VERIFIED" &&
      Number.isFinite(attempt.score) &&
      attempt.questionContentVersion > 0 &&
      attempt.evaluatorVersion.trim().length > 0 &&
      attempt.skillKeys.length > 0 &&
      attempt.topicKeys.length > 0
  );
}

function skillEvidence(
  skillKey: string,
  values: Observation[],
  generatedAt: number
): PracticeSkillEvidence {
  const chronological = values.slice().sort((left, right) => left.observedAt - right.observedAt);
  const first = chronological[0]!;
  const last = chronological.at(-1)!;
  const hinted = values.filter((value) => value.hintsUsed > 0).length;
  const repeated = values.filter((value) => value.attemptOrdinal > 1).length;
  return {
    skillKey,
    score: demonstratedMasteryScore(values, generatedAt),
    confidence: roundRate(Math.min(1, 0.4 + values.length * 0.12)),
    sampleSize: values.length,
    lastObservedAt: Math.max(...values.map((value) => value.observedAt)),
    trend: values.length > 1 ? roundScore(last.score - first.score) : null,
    topicKeys: unique(values.flatMap((value) => value.topicKeys)).sort(),
    hintsUsed: values.reduce((total, value) => total + value.hintsUsed, 0),
    hintDependenceRate: roundRate(hinted / values.length),
    repeatedAttemptCount: repeated,
    retryDependenceRate: roundRate(repeated / values.length)
  };
}

function topicEvidence(
  topicKey: string,
  values: Observation[],
  generatedAt: number
): PracticeTopicEvidence {
  return {
    topicKey,
    score: demonstratedMasteryScore(values, generatedAt),
    sampleSize: values.length,
    lastObservedAt: Math.max(...values.map((value) => value.observedAt))
  };
}

/**
 * Mastery is intentionally stricter than one raw score: sparse, stale,
 * hint-dependent, or retry-dependent evidence is discounted, while harder
 * questions receive a small bounded credit.
 */
function demonstratedMasteryScore(values: Observation[], generatedAt: number): number {
  const rawScore = average(values.map((value) => value.score));
  const sampleFactor = Math.min(1, 0.88 + Math.max(0, values.length - 1) * 0.04);
  const latest = Math.max(...values.map((value) => value.observedAt));
  const ageDays = Math.max(0, generatedAt - latest) / (24 * 60 * 60 * 1_000);
  const recencyFactor = Math.max(0.75, 1 - ageDays / (2 * 365) * 0.25);
  const hintDependence = values.filter((value) => value.hintsUsed > 0).length / values.length;
  const retryDependence =
    values.filter((value) => value.attemptOrdinal > 1).length / values.length;
  const difficultyBonus = average(
    values.map((value) =>
      value.difficulty === "hard" ? 4 : value.difficulty === "easy" ? -2 : 0
    )
  );
  return clampScore(
    rawScore * sampleFactor * recencyFactor +
      difficultyBonus -
      hintDependence * 10 -
      retryDependence * 6
  );
}

function append(map: Map<string, Observation[]>, key: string, value: Observation): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function average(values: number[]): number {
  return roundScore(values.reduce((total, value) => total + value, 0) / values.length);
}

function clampScore(value: number): number {
  return roundScore(Math.max(0, Math.min(100, value)));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1_000) / 1_000;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
