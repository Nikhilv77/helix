import type { ProgressDay, ProgressNextUp } from "@/features/progress/contracts/progress";

export interface AppliedEngineeringPracticeAnalytics {
  totalQuestions: number;
  completedQuestions: number;
  totalAttempts: number;
  solvedThisWeek: number;
  currentStreakDays: number;
  lastActiveAt: number | null;
  activity: ProgressDay[];
  nextUp: ProgressNextUp | null;
}
