import { describe, expect, it } from "vitest";
import type { ProgressBriefingOverview } from "@/features/progress/contracts/progress";
import { mergeBriefingPractice, type CoreTechnicalPracticeAnalytics } from "./workspace-analytics";

const days = (solved: number[]) =>
  solved.map((count, index) => ({
    date: `2026-09-${String(18 + index).padStart(2, "0")}`,
    solved: count,
    attempts: count
  }));

describe("mergeBriefingPractice", () => {
  it("adds AI/ML practice to an empty roadmap briefing", () => {
    const briefing: ProgressBriefingOverview = {
      totals: { totalAttempts: 0, completedQuestions: 0 },
      streak: {
        currentDays: 0,
        longestDays: 0,
        activeDays: 0,
        lastActiveAt: null,
        lastSolvedAt: null
      },
      activity: days([0, 0, 0, 0, 0, 0, 0]),
      interview: { completedSessions: 0 }
    };
    const practice: CoreTechnicalPracticeAnalytics = {
      totalQuestions: 40,
      completedQuestions: 4,
      totalAttempts: 5,
      solvedThisWeek: 3,
      currentStreakDays: 2,
      lastActiveAt: 1_000,
      activity: days([1, 0, 0, 1, 1, 0, 1]),
      nextUp: null
    };

    const merged = mergeBriefingPractice(briefing, practice);

    expect(merged.totals).toEqual({ totalAttempts: 5, completedQuestions: 4 });
    expect(merged.activity.map((day) => day.solved)).toEqual([1, 0, 0, 1, 1, 0, 1]);
    expect(merged.streak).toMatchObject({ currentDays: 2, longestDays: 2, lastActiveAt: 1_000 });
  });
});
