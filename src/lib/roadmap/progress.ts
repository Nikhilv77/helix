import type { RoadmapProgressStatus } from "@prisma/client";
import type { WorkspaceCompetency } from "@/lib/shared/types";

/**
 * The read model behind /progress.
 *
 * Everything here is derived from what the user actually did — roadmap
 * progress rows and their attempt history — so the page never invents a
 * number. Where a value is an estimate rather than a measurement (practice
 * time, which is expected minutes and not a stopwatch) the field says so.
 */
export interface ProgressOverview {
  /** Milliseconds. The page renders relative dates against this. */
  generatedAt: number;
  /** False for users with no seeded roadmap — only interview evidence shows. */
  hasRoadmap: boolean;
  roadmapTitle: string | null;
  totals: ProgressTotals;
  streak: ProgressStreak;
  /** One entry per day, oldest first, covering the whole heatmap window. */
  activity: ProgressDay[];
  /** Solved counts bucketed by week, oldest first. */
  weekly: ProgressWeek[];
  difficulty: ProgressDifficulty[];
  patterns: ProgressPattern[];
  sessions: ProgressSessionRow[];
  chapters: ProgressChapterRow[];
  /** Most recent attempts, newest first. */
  recent: ProgressAttemptRow[];
  interview: ProgressInterview;
  nextUp: ProgressNextUp | null;
}

/** Minimal read model serialized into the client-only progress briefing. */
export interface ProgressBriefingOverview {
  totals: Pick<ProgressTotals, "totalAttempts" | "completedQuestions">;
  streak: ProgressStreak;
  /** The seven daily rows used to explain the candidate's current pace. */
  activity: ProgressDay[];
  interview: Pick<ProgressInterview, "completedSessions">;
}

export interface ProgressTotals {
  totalQuestions: number;
  completedQuestions: number;
  attemptedQuestions: number;
  skippedQuestions: number;
  completionPercent: number;
  totalSessions: number;
  completedSessions: number;
  totalChapters: number;
  completedChapters: number;
  startedChapters: number;
  /** Expected minutes behind the questions already completed. An estimate. */
  minutesPracticed: number;
  /** Expected minutes still ahead. An estimate. */
  minutesRemaining: number;
  /** Every attempt row, including re-opens — the "showed up" count. */
  totalAttempts: number;
  solvedThisWeek: number;
  solvedLastWeek: number;
}

export interface ProgressStreak {
  /** Consecutive days ending today (or yesterday) with at least one solve. */
  currentDays: number;
  longestDays: number;
  /** Distinct days with any activity inside the window. */
  activeDays: number;
  lastActiveAt: number | null;
  lastSolvedAt: number | null;
}

export interface ProgressDay {
  /** `YYYY-MM-DD`, UTC. */
  date: string;
  solved: number;
  attempts: number;
}

export interface ProgressWeek {
  /** `YYYY-MM-DD` of the Monday starting the week, UTC. */
  weekStart: string;
  label: string;
  solved: number;
  attempts: number;
}

export interface ProgressDifficulty {
  difficulty: "easy" | "medium" | "hard";
  total: number;
  completed: number;
  attempted: number;
  percent: number;
}

export interface ProgressPattern {
  pattern: string;
  label: string;
  total: number;
  completed: number;
  attempted: number;
  skipped: number;
  percent: number;
}

export interface ProgressSessionRow {
  id: string;
  order: number;
  title: string;
  status: RoadmapProgressStatus;
  totalQuestions: number;
  completedQuestions: number;
  percent: number;
  href: string;
}

export interface ProgressChapterRow {
  id: string;
  order: number;
  title: string;
  status: RoadmapProgressStatus;
  totalQuestions: number;
  completedQuestions: number;
  percent: number;
  href: string;
}

export type ProgressAttemptStatus = "COMPLETED" | "SKIPPED" | "SUBMITTED" | "STARTED";

export interface ProgressAttemptRow {
  id: string;
  title: string;
  href: string | null;
  status: ProgressAttemptStatus;
  difficulty: string | null;
  pattern: string | null;
  at: number;
}

export interface ProgressInterview {
  readinessScore: number | null;
  completedSessions: number;
  sessionsThisWeek: number;
  answeredQuestions: number;
  competencies: WorkspaceCompetency[];
  strongest: WorkspaceCompetency | null;
  focus: WorkspaceCompetency | null;
}

export interface ProgressNextUp {
  title: string;
  href: string;
  chapterTitle: string | null;
  difficulty: string | null;
  minutes: number | null;
}

/**
 * Slugs whose title-cased form reads wrong. Everything else falls through to
 * plain title case, so a pattern added to the bank still gets a sane label.
 */
const PATTERN_LABELS: Record<string, string> = {
  "arrays-hashing": "Arrays & Hashing",
  "binary-search-tree": "Binary Search Tree",
  "dynamic-programming": "Dynamic Programming",
  "prefix-sum": "Prefix Sum",
  "stack-queue": "Stack & Queue",
  "string-matching": "String Matching",
  "union-find": "Union Find",
  kadane: "Kadane's Algorithm",
  math: "Math & Bit Tricks"
};

/** `arrays-hashing` → `Arrays & Hashing`. */
export function patternLabel(pattern: string): string {
  const known = PATTERN_LABELS[pattern];
  if (known) return known;

  return pattern
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => (part === "and" ? "&" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
