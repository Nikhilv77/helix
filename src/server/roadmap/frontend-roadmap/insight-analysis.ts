import { Prisma, RoadmapQuestionAttemptStatus } from "@prisma/client";

type InsightAttempt = Prisma.UserQuestionAttemptGetPayload<{
  include: {
    questionProgress: {
      include: {
        dsaQuestion: {
          select: {
            title: true;
            commonMistakes: true;
            interviewSignals: true;
            primaryPattern: true;
          };
        };
        roadmapQuestionTemplate: {
          select: {
            titleSnapshot: true;
            difficulty: true;
          };
        };
      };
    };
  };
}>;

interface AttemptPatternSignal {
  pattern: string;
  weakAttempts: number;
  totalAttempts: number;
  lastQuestionTitle: string | null;
}

interface AttemptHistoryAnalysis {
  weakestPattern: AttemptPatternSignal | null;
  lastCompletedTitle: string | null;
  lastCompletedPattern: string | null;
  completionStreakDays: number;
  activeAttemptDays: number;
}

export function analyzeAttemptHistory(attempts: InsightAttempt[]): AttemptHistoryAnalysis {
  const patternSignals = new Map<string, AttemptPatternSignal>();
  const completedDayKeys = new Set<string>();
  const activeDayKeys = new Set<string>();
  let lastCompletedTitle: string | null = null;
  let lastCompletedPattern: string | null = null;

  for (const attempt of attempts) {
    activeDayKeys.add(dayKey(attempt.createdAt));

    const question = attempt.questionProgress;
    const pattern = question.dsaQuestion?.primaryPattern ?? "frontend-dsa";
    const title =
      question.dsaQuestion?.title ?? question.roadmapQuestionTemplate?.titleSnapshot ?? null;
    const signal = patternSignals.get(pattern) ?? {
      pattern,
      weakAttempts: 0,
      totalAttempts: 0,
      lastQuestionTitle: null
    };

    signal.totalAttempts += 1;
    if (isWeakAttempt(attempt)) {
      signal.weakAttempts += 1;
      signal.lastQuestionTitle ??= title;
    }
    patternSignals.set(pattern, signal);

    if (attempt.status === RoadmapQuestionAttemptStatus.COMPLETED) {
      completedDayKeys.add(dayKey(attempt.createdAt));
      lastCompletedTitle ??= title;
      lastCompletedPattern ??= pattern;
    }
  }

  const weakestPattern =
    [...patternSignals.values()]
      .filter((signal) => signal.weakAttempts >= 2)
      .sort(
        (a, b) =>
          b.weakAttempts - a.weakAttempts ||
          b.weakAttempts / b.totalAttempts - a.weakAttempts / a.totalAttempts
      )[0] ?? null;

  return {
    weakestPattern,
    lastCompletedTitle,
    lastCompletedPattern,
    completionStreakDays: consecutiveDayCount(completedDayKeys),
    activeAttemptDays: activeDayKeys.size
  };
}

function isWeakAttempt(attempt: InsightAttempt): boolean {
  if (attempt.status === RoadmapQuestionAttemptStatus.SKIPPED) return true;
  if (typeof attempt.score === "number" && attempt.score < 0.55) return true;

  const correctness = attempt.correctness?.toLowerCase() ?? "";
  return ["incorrect", "miss", "weak", "failed", "skipped"].some((token) =>
    correctness.includes(token)
  );
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function consecutiveDayCount(dayKeys: Set<string>): number {
  if (dayKeys.size === 0) return 0;

  const sortedKeys = [...dayKeys].sort((a, b) => b.localeCompare(a));
  const current = new Date(`${sortedKeys[0]}T00:00:00.000Z`);
  let streak = 0;

  for (const key of sortedKeys) {
    if (key !== dayKey(current)) break;
    streak += 1;
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return streak;
}

export function displayPattern(pattern: string): string {
  return pattern
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function streakInsightBody(streakDays: number, completedQuestions: number): string {
  if (completedQuestions === 0) return "Not started. Your first solved question begins the streak.";
  if (streakDays <= 1) {
    return `${completedQuestions} question${completedQuestions === 1 ? "" : "s"} completed. Solve one more today to make the streak visible.`;
  }
  return `${streakDays}-day solve streak. Keep one focused question in the loop before switching topics.`;
}
