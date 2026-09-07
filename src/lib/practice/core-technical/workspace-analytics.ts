import type {
  ProgressDashboardOverview,
  ProgressDay,
  ProgressNextUp
} from "@/lib/roadmap/progress";

export interface CoreTechnicalPracticeAnalytics {
  totalQuestions: number;
  completedQuestions: number;
  totalAttempts: number;
  solvedThisWeek: number;
  currentStreakDays: number;
  lastActiveAt: number | null;
  activity: ProgressDay[];
  nextUp: ProgressNextUp | null;
}

/** Adds Core Technical practice to the existing DSA/roadmap dashboard projection. */
export function mergeDashboardPractice(
  roadmap: ProgressDashboardOverview | null,
  coreTechnical: CoreTechnicalPracticeAnalytics
): ProgressDashboardOverview {
  const completedQuestions =
    (roadmap?.totals.completedQuestions ?? 0) + coreTechnical.completedQuestions;
  const totalQuestions = (roadmap?.totals.totalQuestions ?? 0) + coreTechnical.totalQuestions;
  const activity = mergePracticeActivity(roadmap?.activity ?? [], coreTechnical.activity);

  return {
    totals: {
      completedQuestions,
      totalQuestions,
      completionPercent: totalQuestions
        ? Math.round((completedQuestions / totalQuestions) * 100)
        : 0,
      totalAttempts: (roadmap?.totals.totalAttempts ?? 0) + coreTechnical.totalAttempts,
      solvedThisWeek: (roadmap?.totals.solvedThisWeek ?? 0) + coreTechnical.solvedThisWeek
    },
    streak: {
      currentDays: Math.max(
        mergedCurrentStreak(activity),
        roadmap?.streak.currentDays ?? 0,
        coreTechnical.currentStreakDays
      ),
      lastActiveAt: latestTimestamp(roadmap?.streak.lastActiveAt, coreTechnical.lastActiveAt)
    },
    activity,
    nextUp: roadmap?.nextUp ?? coreTechnical.nextUp
  };
}

/**
 * Adds Core Technical counts to the existing activity slots.
 *
 * The roadmap payload owns the chart shape (seven slots on Practice). Core
 * Technical may use a slightly different date window, so taking the union
 * would add DOM columns and make the existing chart wrap. When no roadmap
 * payload exists, the Core Technical window becomes the fallback shape.
 */
export function mergePracticeActivity(
  roadmap: Array<{ date: string; solved: number; attempts?: number }>,
  coreTechnical: Array<{ date: string; solved: number; attempts?: number }>
): ProgressDay[] {
  const slots = roadmap.length > 0 ? roadmap : coreTechnical;
  const coreByDate = new Map(coreTechnical.map((day) => [day.date, day]));

  return slots.map((day) => {
    const coreDay = roadmap.length > 0 ? coreByDate.get(day.date) : undefined;
    return {
      date: day.date,
      solved: day.solved + (coreDay?.solved ?? 0),
      attempts: (day.attempts ?? 0) + (coreDay?.attempts ?? 0)
    };
  });
}

function mergedCurrentStreak(activity: ProgressDay[]): number {
  let streak = 0;
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    const day = activity[index];
    if (!day) continue;
    if (day.solved > 0) {
      streak += 1;
      continue;
    }
    // Today may still be in progress. Only the newest empty day is ignored.
    if (index === activity.length - 1) continue;
    break;
  }
  return streak;
}

function latestTimestamp(left: number | null | undefined, right: number | null): number | null {
  if (left === null || left === undefined) return right;
  if (right === null) return left;
  return Math.max(left, right);
}
