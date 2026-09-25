/** The Practice landing page needs counts and seven solved-day buckets only. */
export interface PracticeEntrySummary {
  totalQuestions: number;
  completedQuestions: number;
  activity: Array<{ date: string; solved: number }>;
}

export function practiceEntrySummary<Status extends string>(
  questions: Array<{
    status: Status;
    completedAt: Date | null;
    learnedAt: Date | null;
  }>,
  terminalStatuses: ReadonlySet<Status>,
  days = 7,
  now = new Date()
): PracticeEntrySummary {
  const dayCount = Math.max(1, Math.min(days, 126));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowStart = today - (dayCount - 1) * 86_400_000;
  const solvedByDay = new Map<string, number>();
  let completedQuestions = 0;

  for (const question of questions) {
    if (!terminalStatuses.has(question.status)) continue;
    completedQuestions += 1;
    const terminalAt = question.completedAt ?? question.learnedAt;
    if (!terminalAt || terminalAt.getTime() < windowStart) continue;
    const date = terminalAt.toISOString().slice(0, 10);
    solvedByDay.set(date, (solvedByDay.get(date) ?? 0) + 1);
  }

  return {
    totalQuestions: questions.length,
    completedQuestions,
    activity: Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(windowStart + index * 86_400_000).toISOString().slice(0, 10);
      return { date, solved: solvedByDay.get(date) ?? 0 };
    })
  };
}
