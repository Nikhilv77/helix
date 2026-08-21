import { RoadmapProgressStatus, RoadmapQuestionAttemptStatus, type Prisma } from "@prisma/client";
import {
  patternLabel,
  type ProgressAttemptRow,
  type ProgressAttemptStatus,
  type ProgressChapterRow,
  type ProgressDay,
  type ProgressDifficulty,
  type ProgressInterview,
  type ProgressNextUp,
  type ProgressOverview,
  type ProgressPattern,
  type ProgressSessionRow,
  type ProgressStreak,
  type ProgressWeek
} from "@/lib/roadmap/progress";
import type { PrismaService } from "../database/prisma.service";

const FRONTEND_ROADMAP_ROLE = "fullstack";
const DAY_MS = 86_400_000;
/** 18 weeks of heatmap: wide enough to show a habit, short enough to stay dense. */
const WINDOW_DAYS = 126;

/**
 * Reads the /progress page's data. Strictly read-only — unlike
 * `FrontendRoadmapService.home`, opening this page can never seed a roadmap,
 * so viewing your progress is not itself a state change.
 */
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    ownerId: string,
    interview: ProgressInterview,
    now: Date = new Date()
  ): Promise<ProgressOverview> {
    const windowStart = startOfUtcDay(new Date(now.getTime() - (WINDOW_DAYS - 1) * DAY_MS));

    const roadmap = await this.prisma.userRoadmap.findUnique({
      where: { ownerId_role: { ownerId, role: FRONTEND_ROADMAP_ROLE } },
      include: {
        sessionProgress: {
          orderBy: { order: "asc" },
          include: { sessionTemplate: { select: { slug: true, title: true } } }
        },
        chapterProgress: {
          orderBy: { order: "asc" },
          include: { chapterTemplate: { select: { slug: true, title: true } } }
        },
        questionProgress: {
          orderBy: { order: "asc" },
          include: {
            dsaQuestion: {
              select: {
                slug: true,
                title: true,
                difficulty: true,
                primaryPattern: true,
                expectedTimeMinutes: true
              }
            },
            roadmapQuestionTemplate: {
              select: { titleSnapshot: true, difficulty: true, expectedMinutes: true }
            },
            chapterProgress: { select: { chapterTemplate: { select: { title: true } } } }
          }
        }
      }
    });

    // Attempts are read for the whole window regardless of the roadmap, so a
    // user whose roadmap was rebuilt still sees the days they showed up.
    const attempts = await this.prisma.userQuestionAttempt.findMany({
      where: { ownerId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        dsaQuestionSlug: true,
        questionProgressId: true
      }
    });

    const questions = roadmap?.questionProgress ?? [];
    const questionMeta = buildQuestionMeta(questions);
    const activity = buildActivity(attempts, windowStart, now);
    const streak = buildStreak(attempts, now);
    const totals = buildTotals(roadmap, questions, activity, attempts.length, now);

    return {
      generatedAt: now.getTime(),
      hasRoadmap: Boolean(roadmap),
      roadmapTitle: roadmap?.title ?? null,
      totals,
      streak,
      activity,
      weekly: buildWeekly(activity),
      difficulty: buildDifficulty(questions),
      patterns: buildPatterns(questions),
      sessions: buildSessions(roadmap),
      chapters: buildChapters(roadmap),
      recent: buildRecent(attempts, questionMeta),
      interview,
      nextUp: buildNextUp(roadmap, questions)
    };
  }
}

type QuestionRow = Prisma.UserQuestionProgressGetPayload<{
  include: {
    dsaQuestion: {
      select: {
        slug: true;
        title: true;
        difficulty: true;
        primaryPattern: true;
        expectedTimeMinutes: true;
      };
    };
    roadmapQuestionTemplate: {
      select: { titleSnapshot: true; difficulty: true; expectedMinutes: true };
    };
    chapterProgress: { select: { chapterTemplate: { select: { title: true } } } };
  };
}>;

type RoadmapRow = Prisma.UserRoadmapGetPayload<{
  include: {
    sessionProgress: { include: { sessionTemplate: { select: { slug: true; title: true } } } };
    chapterProgress: { include: { chapterTemplate: { select: { slug: true; title: true } } } };
  };
}> | null;

interface AttemptRow {
  id: string;
  status: RoadmapQuestionAttemptStatus;
  createdAt: Date;
  dsaQuestionSlug: string | null;
  questionProgressId: string;
}

interface QuestionMeta {
  title: string;
  slug: string | null;
  difficulty: string | null;
  pattern: string | null;
}

function buildQuestionMeta(questions: QuestionRow[]): Map<string, QuestionMeta> {
  return new Map(
    questions.map((question) => [
      question.id,
      {
        title:
          question.dsaQuestion?.title ??
          question.roadmapQuestionTemplate?.titleSnapshot ??
          "Practice question",
        slug: question.dsaQuestion?.slug ?? question.dsaQuestionSlug,
        difficulty: difficultyOf(question),
        pattern: question.dsaQuestion?.primaryPattern ?? null
      }
    ])
  );
}

/**
 * One row per day across the whole window, including the empty ones — the
 * heatmap needs a continuous calendar, not just the days that have data.
 */
function buildActivity(attempts: AttemptRow[], windowStart: Date, now: Date): ProgressDay[] {
  const solvedByDay = new Map<string, number>();
  const attemptsByDay = new Map<string, number>();

  for (const attempt of attempts) {
    const key = dayKey(attempt.createdAt);
    attemptsByDay.set(key, (attemptsByDay.get(key) ?? 0) + 1);
    if (attempt.status === RoadmapQuestionAttemptStatus.COMPLETED) {
      solvedByDay.set(key, (solvedByDay.get(key) ?? 0) + 1);
    }
  }

  const days: ProgressDay[] = [];
  const cursor = new Date(windowStart);
  const end = startOfUtcDay(now);

  while (cursor.getTime() <= end.getTime()) {
    const key = dayKey(cursor);
    days.push({
      date: key,
      solved: solvedByDay.get(key) ?? 0,
      attempts: attemptsByDay.get(key) ?? 0
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function buildStreak(attempts: AttemptRow[], now: Date): ProgressStreak {
  const solvedDays = new Set<string>();
  const activeDays = new Set<string>();
  let lastActiveAt: number | null = null;
  let lastSolvedAt: number | null = null;

  // Attempts arrive newest first, so the first of each kind is the latest.
  for (const attempt of attempts) {
    activeDays.add(dayKey(attempt.createdAt));
    lastActiveAt ??= attempt.createdAt.getTime();
    if (attempt.status === RoadmapQuestionAttemptStatus.COMPLETED) {
      solvedDays.add(dayKey(attempt.createdAt));
      lastSolvedAt ??= attempt.createdAt.getTime();
    }
  }

  return {
    currentDays: currentStreak(solvedDays, now),
    longestDays: longestStreak(solvedDays),
    activeDays: activeDays.size,
    lastActiveAt,
    lastSolvedAt
  };
}

/**
 * Counts back from today. A day with no solve yet does not break the streak —
 * it is still in progress — so the walk starts at yesterday in that case.
 */
function currentStreak(solvedDays: Set<string>, now: Date): number {
  if (solvedDays.size === 0) return 0;

  const cursor = startOfUtcDay(now);
  if (!solvedDays.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!solvedDays.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (solvedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function longestStreak(solvedDays: Set<string>): number {
  const sorted = [...solvedDays].sort();
  let longest = 0;
  let run = 0;
  let previous: number | null = null;

  for (const key of sorted) {
    const time = Date.parse(`${key}T00:00:00.000Z`);
    run = previous !== null && time - previous === DAY_MS ? run + 1 : 1;
    previous = time;
    if (run > longest) longest = run;
  }

  return longest;
}

function buildTotals(
  roadmap: RoadmapRow,
  questions: QuestionRow[],
  activity: ProgressDay[],
  totalAttempts: number,
  now: Date
): ProgressOverview["totals"] {
  const completedQuestions = questions.filter(
    (question) => question.status === RoadmapProgressStatus.COMPLETED
  ).length;
  const skippedQuestions = questions.filter(
    (question) => question.status === RoadmapProgressStatus.SKIPPED
  ).length;
  const attemptedQuestions = questions.filter(
    (question) =>
      question.attemptCount > 0 ||
      question.status === RoadmapProgressStatus.IN_PROGRESS ||
      question.status === RoadmapProgressStatus.COMPLETED
  ).length;

  let minutesPracticed = 0;
  let minutesRemaining = 0;
  for (const question of questions) {
    const minutes = expectedMinutesOf(question);
    if (question.status === RoadmapProgressStatus.COMPLETED) minutesPracticed += minutes;
    else minutesRemaining += minutes;
  }

  const thisWeekStart = startOfUtcWeek(now).getTime();
  const lastWeekStart = thisWeekStart - 7 * DAY_MS;
  let solvedThisWeek = 0;
  let solvedLastWeek = 0;
  for (const day of activity) {
    const time = Date.parse(`${day.date}T00:00:00.000Z`);
    if (time >= thisWeekStart) solvedThisWeek += day.solved;
    else if (time >= lastWeekStart) solvedLastWeek += day.solved;
  }

  const chapters = roadmap?.chapterProgress ?? [];

  return {
    totalQuestions: questions.length,
    completedQuestions,
    attemptedQuestions,
    skippedQuestions,
    completionPercent: percent(completedQuestions, questions.length),
    totalSessions: roadmap?.sessionProgress.length ?? 0,
    completedSessions:
      roadmap?.sessionProgress.filter(
        (session) => session.status === RoadmapProgressStatus.COMPLETED
      ).length ?? 0,
    totalChapters: chapters.length,
    completedChapters: chapters.filter(
      (chapter) => chapter.status === RoadmapProgressStatus.COMPLETED
    ).length,
    startedChapters: chapters.filter(
      (chapter) =>
        chapter.status !== RoadmapProgressStatus.LOCKED &&
        chapter.status !== RoadmapProgressStatus.COMPLETED
    ).length,
    minutesPracticed,
    minutesRemaining,
    totalAttempts,
    solvedThisWeek,
    solvedLastWeek
  };
}

function buildWeekly(activity: ProgressDay[]): ProgressWeek[] {
  const weeks = new Map<string, ProgressWeek>();

  for (const day of activity) {
    const start = startOfUtcWeek(new Date(`${day.date}T00:00:00.000Z`));
    const key = dayKey(start);
    const week = weeks.get(key) ?? {
      weekStart: key,
      label: shortDate(start),
      solved: 0,
      attempts: 0
    };
    week.solved += day.solved;
    week.attempts += day.attempts;
    weeks.set(key, week);
  }

  return [...weeks.values()].sort((left, right) => left.weekStart.localeCompare(right.weekStart));
}

function buildDifficulty(questions: QuestionRow[]): ProgressDifficulty[] {
  const order: ProgressDifficulty["difficulty"][] = ["easy", "medium", "hard"];
  const buckets = new Map<string, ProgressDifficulty>(
    order.map((difficulty) => [
      difficulty,
      { difficulty, total: 0, completed: 0, attempted: 0, percent: 0 }
    ])
  );

  for (const question of questions) {
    const bucket = buckets.get(difficultyOf(question) ?? "medium");
    if (!bucket) continue;

    bucket.total += 1;
    if (question.status === RoadmapProgressStatus.COMPLETED) bucket.completed += 1;
    else if (question.attemptCount > 0) bucket.attempted += 1;
  }

  return order
    .map((difficulty) => {
      const bucket = buckets.get(difficulty);
      if (!bucket) return null;
      return { ...bucket, percent: percent(bucket.completed, bucket.total) };
    })
    .filter((bucket): bucket is ProgressDifficulty => bucket !== null && bucket.total > 0);
}

function buildPatterns(questions: QuestionRow[]): ProgressPattern[] {
  const buckets = new Map<string, ProgressPattern>();

  for (const question of questions) {
    const pattern = question.dsaQuestion?.primaryPattern;
    if (!pattern) continue;

    const bucket = buckets.get(pattern) ?? {
      pattern,
      label: patternLabel(pattern),
      total: 0,
      completed: 0,
      attempted: 0,
      skipped: 0,
      percent: 0
    };

    bucket.total += 1;
    if (question.status === RoadmapProgressStatus.COMPLETED) bucket.completed += 1;
    else if (question.status === RoadmapProgressStatus.SKIPPED) bucket.skipped += 1;
    else if (question.attemptCount > 0) bucket.attempted += 1;
    buckets.set(pattern, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, percent: percent(bucket.completed, bucket.total) }))
    .sort(
      (left, right) =>
        right.percent - left.percent ||
        right.total - left.total ||
        left.label.localeCompare(right.label)
    );
}

function buildSessions(roadmap: RoadmapRow): ProgressSessionRow[] {
  return (roadmap?.sessionProgress ?? []).map((session) => ({
    id: session.sessionTemplate.slug,
    order: session.order,
    title: session.sessionTemplate.title,
    status: session.status,
    totalQuestions: session.totalQuestions,
    completedQuestions: session.completedQuestions,
    percent: percent(session.completedQuestions, session.totalQuestions),
    href: sessionHref(session.sessionTemplate.slug, session.sessionTemplate.title)
  }));
}

function buildChapters(roadmap: RoadmapRow): ProgressChapterRow[] {
  return (roadmap?.chapterProgress ?? []).map((chapter) => ({
    id: chapter.chapterTemplate.slug,
    order: chapter.order,
    title: chapter.chapterTemplate.title,
    status: chapter.status,
    totalQuestions: chapter.totalQuestions,
    completedQuestions: chapter.completedQuestions,
    percent: percent(chapter.completedQuestions, chapter.totalQuestions),
    href: `/practice/${chapter.chapterTemplate.slug}`
  }));
}

/**
 * The last thing that happened to each question, newest first. Opening a
 * question writes an attempt on every visit, so the raw rows repeat the same
 * question many times; collapsing them keeps the feed readable.
 */
function buildRecent(
  attempts: AttemptRow[],
  questionMeta: Map<string, QuestionMeta>
): ProgressAttemptRow[] {
  const seen = new Set<string>();
  const rows: ProgressAttemptRow[] = [];

  for (const attempt of attempts) {
    if (seen.has(attempt.questionProgressId)) continue;
    seen.add(attempt.questionProgressId);

    const meta = questionMeta.get(attempt.questionProgressId);
    const slug = meta?.slug ?? attempt.dsaQuestionSlug;
    rows.push({
      id: attempt.id,
      title: meta?.title ?? "Practice question",
      href: slug ? `/dsa-questions/${slug}` : null,
      status: attempt.status as ProgressAttemptStatus,
      difficulty: meta?.difficulty ?? null,
      pattern: meta?.pattern ?? null,
      at: attempt.createdAt.getTime()
    });

    if (rows.length >= 10) break;
  }

  return rows;
}

function buildNextUp(roadmap: RoadmapRow, questions: QuestionRow[]): ProgressNextUp | null {
  if (!roadmap) return null;

  const next =
    questions.find(
      (question) =>
        question.dsaQuestionSlug === roadmap.nextQuestionKey ||
        question.roadmapQuestionTemplateId === roadmap.nextQuestionKey
    ) ??
    questions.find(
      (question) =>
        question.status !== RoadmapProgressStatus.COMPLETED &&
        question.status !== RoadmapProgressStatus.SKIPPED
    );

  if (!next) return null;

  const slug = next.dsaQuestion?.slug ?? next.dsaQuestionSlug;
  return {
    title:
      next.dsaQuestion?.title ?? next.roadmapQuestionTemplate?.titleSnapshot ?? "Next question",
    href: slug ? `/dsa-questions/${slug}` : "/practice",
    chapterTitle: next.chapterProgress?.chapterTemplate.title ?? null,
    difficulty: difficultyOf(next),
    minutes: expectedMinutesOf(next) || null
  };
}

function difficultyOf(question: QuestionRow): ProgressDifficulty["difficulty"] | null {
  const value = (
    question.roadmapQuestionTemplate?.difficulty ??
    question.dsaQuestion?.difficulty ??
    ""
  ).toLowerCase();
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return null;
}

function expectedMinutesOf(question: QuestionRow): number {
  return (
    question.roadmapQuestionTemplate?.expectedMinutes ??
    question.dsaQuestion?.expectedTimeMinutes ??
    0
  );
}

function sessionHref(slug: string, title: string): string {
  if (slug === "frontend-dsa") return "/practice";
  return `/interview?${new URLSearchParams({ focus: title }).toString()}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday-first, matching how the heatmap columns are laid out. */
function startOfUtcWeek(date: Date): Date {
  const start = startOfUtcDay(date);
  const weekday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - weekday);
  return start;
}

function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    date
  );
}

function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}
