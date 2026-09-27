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

describe("cross-track streaks", () => {
  it("counts a streak longer than a week when the full window is merged", () => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10);
      return { date, solved: 0, attempts: 0 };
    });
    // Ten days in a row, alternating tracks: neither track alone has a streak.
    const dsa = days.map((day, index) => ({ ...day, solved: index >= 4 && index % 2 === 0 ? 1 : 0 }));
    const core = days.map((day, index) => ({ ...day, solved: index >= 4 && index % 2 === 1 ? 1 : 0 }));
    const briefing = mergeBriefingPractice(
      {
        totals: { totalAttempts: 5, completedQuestions: 5 },
        streak: { currentDays: 1, longestDays: 1, activeDays: 5, lastActiveAt: null, lastSolvedAt: null },
        activity: dsa,
        interview: { completedSessions: 0 }
      },
      {
        totalQuestions: 20,
        completedQuestions: 5,
        totalAttempts: 5,
        solvedThisWeek: 3,
        currentStreakDays: 1,
        lastActiveAt: null,
        activity: core,
        nextUp: null
      }
    );
    expect(briefing.streak.currentDays).toBe(10);
    expect(briefing.streak.longestDays).toBe(10);
  });
});
