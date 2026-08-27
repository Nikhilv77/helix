import type { PrepPracticeQuestionSummary } from "@/lib/practice/prep-practice";

const DAY_MS = 24 * 60 * 60 * 1_000;
const PASSING_SCORE = 0.72;
const INTERVIEW_GAP_SCORE = 70;

export type PrepRecommendationEvidenceCode =
  | "weak-topic"
  | "verification-needed"
  | "continue-draft"
  | "review-due"
  | "retry-after-skip"
  | "interview-recommendation"
  | "prerequisite"
  | "prerequisite-gap"
  | "increase-difficulty"
  | "reduce-difficulty"
  | "hint-dependence"
  | "retry-dependence"
  | "next-roadmap-question";

export interface PrepRecommendationCandidate {
  question: PrepPracticeQuestionSummary;
  prerequisites: string[];
  selectionReason: string;
  skillEvidenceText: string;
  bestVerifiedScore: number | null;
  latestVerifiedScore: number | null;
  lastVerifiedAt: number | null;
  lastAttemptedAt: number | null;
  completedAt: number | null;
  revealedHintCount: number;
}

export interface PrepInterviewSkillEvidence {
  skillKey: string;
  score: number;
  confidence: number;
  sampleSize: number;
  lastObservedAt: number;
  topicKeys: string[];
}

export interface PrepRecommendationContext {
  now: number;
  masteredQuestionIds: ReadonlySet<string>;
  interviewSkills: PrepInterviewSkillEvidence[];
}

export interface RankedPrepRecommendation {
  questionId: string;
  score: number;
  reason: string;
  evidenceCodes: PrepRecommendationEvidenceCode[];
}

/**
 * Deterministic recommendation policy for the non-DSA Practice sessions.
 *
 * Persisted placement order and question ID are the final tie-breakers, so the
 * same evidence always produces the same result. Only VERIFIED attempt scores
 * are accepted by this boundary; callers are responsible for deriving those
 * values from immutable attempt history.
 */
export function rankPrepRecommendations(
  candidates: PrepRecommendationCandidate[],
  context: PrepRecommendationContext
): RankedPrepRecommendation[] {
  const adaptiveTarget = adaptiveDifficulty(candidates);
  const neededAsPrerequisite = prerequisiteDemand(candidates, context.masteredQuestionIds);

  return candidates
    .flatMap((candidate): Array<RankedPrepRecommendation & { order: number }> => {
      const ranked = scoreCandidate(
        candidate,
        context,
        adaptiveTarget,
        neededAsPrerequisite.get(candidate.question.id) ?? 0
      );
      return ranked ? [{ ...ranked, order: candidate.question.order }] : [];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.order - right.order ||
        left.questionId.localeCompare(right.questionId)
    )
    .map((recommendation) => ({
      questionId: recommendation.questionId,
      score: recommendation.score,
      reason: recommendation.reason,
      evidenceCodes: recommendation.evidenceCodes
    }));
}

function scoreCandidate(
  candidate: PrepRecommendationCandidate,
  context: PrepRecommendationContext,
  adaptiveTarget: {
    difficulty: PrepPracticeQuestionSummary["difficulty"];
    basis: "none" | "weak" | "steady" | "strong";
  },
  prerequisiteDemandCount: number
): RankedPrepRecommendation | null {
  const { question } = candidate;
  const targetDifficulty = adaptiveTarget.difficulty;
  const evidence: Array<{ code: PrepRecommendationEvidenceCode; label: string }> = [];
  const referenceAt =
    candidate.lastVerifiedAt ?? candidate.completedAt ?? candidate.lastAttemptedAt;
  let score = 0;

  if (candidate.latestVerifiedScore !== null && candidate.latestVerifiedScore < PASSING_SCORE) {
    score += 126 + (PASSING_SCORE - candidate.latestVerifiedScore) * 60;
    evidence.push({
      code: "weak-topic",
      label: `Weak-topic retry · latest verified score ${percent(candidate.latestVerifiedScore)}`
    });
  } else if (question.status === "COMPLETED" && candidate.latestVerifiedScore !== null) {
    const interval = reviewIntervalMs(candidate);
    const dueAt = (referenceAt ?? context.now) + interval;
    if (context.now < dueAt) return null;
    const overdueDays = Math.floor((context.now - dueAt) / DAY_MS);
    score += 82 + Math.min(20, overdueDays * 2);
    evidence.push({
      code: "review-due",
      label: `Review due · ${elapsedDays(context.now, referenceAt)} days since verified practice`
    });
  } else if (question.status === "COMPLETED") {
    score += 112;
    evidence.push({
      code: "verification-needed",
      label: "Verification needed · completion has no verified score"
    });
  } else if (question.attemptCount > 0 && candidate.latestVerifiedScore === null) {
    if (
      question.status === "SKIPPED" &&
      candidate.lastAttemptedAt !== null &&
      context.now - candidate.lastAttemptedAt < DAY_MS
    ) {
      return null;
    }
    score += question.status === "SKIPPED" ? 62 : 108;
    evidence.push({
      code: question.status === "SKIPPED" ? "retry-after-skip" : "verification-needed",
      label:
        question.status === "SKIPPED"
          ? "Retry after skip · the one-day cooldown has passed"
          : "Verification needed · no verified score is available"
    });
  } else if (question.status === "IN_PROGRESS") {
    score += 96;
    evidence.push({ code: "continue-draft", label: "Continue saved work" });
  } else if (question.status === "SKIPPED") {
    if (candidate.lastAttemptedAt !== null && context.now - candidate.lastAttemptedAt < DAY_MS) {
      return null;
    }
    score += 58;
    evidence.push({
      code: "retry-after-skip",
      label: "Retry after skip · the one-day cooldown has passed"
    });
  } else {
    score += 66;
    evidence.push({ code: "next-roadmap-question", label: "Next roadmap question" });
  }

  if (candidate.lastAttemptedAt !== null && question.status !== "COMPLETED") {
    score += Math.max(
      0,
      Math.min(10, Math.floor((context.now - candidate.lastAttemptedAt) / DAY_MS))
    );
  }

  const unmetPrerequisites = candidate.prerequisites.filter(
    (questionId) => !context.masteredQuestionIds.has(questionId)
  );
  if (unmetPrerequisites.length) {
    score -= 120 + unmetPrerequisites.length * 5;
    evidence.push({
      code: "prerequisite-gap",
      label: `Prerequisite gap · ${unmetPrerequisites.length} verified prerequisite${unmetPrerequisites.length === 1 ? "" : "s"} remaining`
    });
  } else if (candidate.prerequisites.length) {
    score += 8;
    evidence.push({ code: "prerequisite", label: "Prerequisites verified" });
  }

  if (prerequisiteDemandCount > 0) {
    score += Math.min(36, prerequisiteDemandCount * 18);
    evidence.push({
      code: "prerequisite",
      label: `Prerequisite next · unlocks ${prerequisiteDemandCount} placed question${prerequisiteDemandCount === 1 ? "" : "s"}`
    });
  }

  const interviewGap = strongestInterviewGap(candidate, context.interviewSkills);
  if (interviewGap) {
    score += interviewGap.priority;
    evidence.push({
      code: "interview-recommendation",
      label: `Interview gap · ${humanize(interviewGap.skillKey)} at ${Math.round(interviewGap.score)}%`
    });
  }

  const difficultyDistance = Math.abs(
    difficultyIndex(question.difficulty) - difficultyIndex(targetDifficulty)
  );
  score += difficultyDistance === 0 ? 12 : difficultyDistance === 1 ? 4 : 0;
  if (
    difficultyDistance === 0 &&
    targetDifficulty === "hard" &&
    adaptiveTarget.basis === "strong"
  ) {
    evidence.push({
      code: "increase-difficulty",
      label: "Increase difficulty · recent verified scores are strong"
    });
  } else if (
    difficultyDistance === 0 &&
    targetDifficulty === "easy" &&
    adaptiveTarget.basis === "weak"
  ) {
    evidence.push({
      code: "reduce-difficulty",
      label: "Foundation focus · recent verified scores need reinforcement"
    });
  }

  if (candidate.revealedHintCount > 0 && question.status !== "COMPLETED") {
    score += Math.min(12, candidate.revealedHintCount * 3);
    evidence.push({
      code: "hint-dependence",
      label: `Hint follow-up · ${candidate.revealedHintCount} revealed`
    });
  }
  const retries = Math.max(0, question.attemptCount - 1);
  if (retries > 0 && question.status !== "COMPLETED") {
    score += Math.min(12, retries * 4);
    evidence.push({
      code: "retry-dependence",
      label: `Retry follow-up · ${retries} prior retr${retries === 1 ? "y" : "ies"}`
    });
  }

  const selectionSignals = new Set(candidate.selectionReason.split("+"));
  if (selectionSignals.has("practice-gap")) score += 8;
  if (selectionSignals.has("blueprint") || selectionSignals.has("final-mixed-review")) score += 3;
  if (selectionSignals.has("role")) score += 2;

  const visibleEvidence = evidence.slice(0, 3);
  return {
    questionId: question.id,
    score: Number(score.toFixed(6)),
    reason: visibleEvidence.map((item) => item.label).join(" · "),
    evidenceCodes: visibleEvidence.map((item) => item.code)
  };
}

function adaptiveDifficulty(candidates: PrepRecommendationCandidate[]): {
  difficulty: PrepPracticeQuestionSummary["difficulty"];
  basis: "none" | "weak" | "steady" | "strong";
} {
  const scores = candidates
    .map((candidate) => candidate.latestVerifiedScore)
    .filter((score): score is number => score !== null);
  if (!scores.length) return { difficulty: "easy", basis: "none" };
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  if (scores.length >= 2 && average >= 0.85) return { difficulty: "hard", basis: "strong" };
  if (average < 0.62) return { difficulty: "easy", basis: "weak" };
  return { difficulty: "medium", basis: "steady" };
}

function prerequisiteDemand(
  candidates: PrepRecommendationCandidate[],
  masteredQuestionIds: ReadonlySet<string>
): Map<string, number> {
  const placedQuestionIds = new Set(candidates.map((candidate) => candidate.question.id));
  const demand = new Map<string, number>();
  for (const candidate of candidates) {
    for (const prerequisite of candidate.prerequisites) {
      if (masteredQuestionIds.has(prerequisite) || !placedQuestionIds.has(prerequisite)) continue;
      demand.set(prerequisite, (demand.get(prerequisite) ?? 0) + 1);
    }
  }
  return demand;
}

function strongestInterviewGap(
  candidate: PrepRecommendationCandidate,
  skills: PrepInterviewSkillEvidence[]
): (PrepInterviewSkillEvidence & { priority: number }) | null {
  const questionTokens = new Set(tokenize(candidate.skillEvidenceText));
  return (
    skills
      .filter((skill) => skill.score < INTERVIEW_GAP_SCORE)
      .flatMap((skill) => {
        const skillTokens = new Set(tokenize([skill.skillKey, ...skill.topicKeys].join(" ")));
        let overlap = 0;
        for (const token of skillTokens) if (questionTokens.has(token)) overlap += 1;
        if (!overlap) return [];
        const weakness = (INTERVIEW_GAP_SCORE - skill.score) / INTERVIEW_GAP_SCORE;
        const evidenceConfidence = skill.confidence * Math.min(1, skill.sampleSize / 3);
        return [
          { ...skill, priority: Math.min(30, 10 + weakness * evidenceConfidence * 20 + overlap) }
        ];
      })
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          left.score - right.score ||
          left.skillKey.localeCompare(right.skillKey)
      )[0] ?? null
  );
}

function reviewIntervalMs(candidate: PrepRecommendationCandidate): number {
  const score = candidate.latestVerifiedScore ?? 0;
  const baseDays = score >= 0.9 ? 14 : score >= 0.8 ? 7 : 3;
  const dependence = candidate.revealedHintCount + Math.max(0, candidate.question.attemptCount - 1);
  const multiplier = dependence >= 3 ? 0.5 : dependence > 0 ? 0.75 : 1;
  return Math.max(DAY_MS, Math.round(baseDays * multiplier * DAY_MS));
}

function elapsedDays(now: number, then: number | null): number {
  if (then === null) return 0;
  return Math.max(0, Math.floor((now - then) / DAY_MS));
}

function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function difficultyIndex(difficulty: PrepPracticeQuestionSummary["difficulty"]): number {
  return difficulty === "easy" ? 0 : difficulty === "medium" ? 1 : 2;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function humanize(value: string): string {
  return value.replace(/^dsa-pattern:|^behavioral:/, "").replaceAll("-", " ");
}
