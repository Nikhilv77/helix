import { notFound } from "next/navigation";
import { ProgressView } from "@/components/workspace/progress-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { patternLabel, type ProgressDay, type ProgressOverview } from "@/lib/progress";
import { privatePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Progress Preview",
  "Internal Trailgrad progress preview for design review."
);

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 126;

/** Deterministic, so the preview looks the same on every render. */
function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

function mockActivity(now: number): ProgressDay[] {
  const start = new Date(now - (WINDOW_DAYS - 1) * DAY_MS);
  const days: ProgressDay[] = [];

  for (let index = 0; index < WINDOW_DAYS; index += 1) {
    const date = new Date(start.getTime() + index * DAY_MS);
    const weekday = date.getUTCDay();
    const roll = pseudoRandom(index + 1);
    // Ramps up over the window, quieter at weekends, with a gap in the middle.
    const intensity = index < 30 ? 0.25 : index > 70 && index < 84 ? 0 : 0.45 + index / 260;
    const weekendPenalty = weekday === 0 || weekday === 6 ? 0.45 : 1;
    const solved = roll < intensity * weekendPenalty ? Math.ceil(roll * 5) : 0;

    days.push({
      date: date.toISOString().slice(0, 10),
      solved,
      attempts: solved > 0 ? solved + Math.round(roll * 3) : roll < 0.12 ? 1 : 0
    });
  }

  return days;
}

function mockOverview(): ProgressOverview {
  const now = Date.now();
  const activity = mockActivity(now);
  const weekly = Object.values(
    activity.reduce<Record<string, { weekStart: string; solved: number; attempts: number }>>(
      (weeks, day) => {
        const date = new Date(`${day.date}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
        const key = date.toISOString().slice(0, 10);
        const week = weeks[key] ?? { weekStart: key, solved: 0, attempts: 0 };
        week.solved += day.solved;
        week.attempts += day.attempts;
        weeks[key] = week;
        return weeks;
      },
      {}
    )
  )
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart))
    .map((week) => ({
      ...week,
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }).format(new Date(`${week.weekStart}T00:00:00.000Z`))
    }));

  const patterns = [
    ["arrays-hashing", 4, 4],
    ["two-pointers", 11, 9],
    ["sliding-window", 11, 7],
    ["binary-search", 12, 6],
    ["linked-list", 12, 5],
    ["stack", 10, 4],
    ["tree", 15, 3],
    ["heap", 7, 1],
    ["graph", 9, 0],
    ["dynamic-programming", 10, 0],
    ["trie", 5, 0],
    ["backtracking", 6, 0]
  ] as const;

  return {
    generatedAt: now,
    hasRoadmap: true,
    roadmapTitle: "Frontend Interview Roadmap",
    totals: {
      totalQuestions: 123,
      completedQuestions: 39,
      attemptedQuestions: 46,
      skippedQuestions: 4,
      completionPercent: 32,
      totalSessions: 6,
      completedSessions: 0,
      totalChapters: 12,
      completedChapters: 3,
      startedChapters: 4,
      minutesPracticed: 612,
      minutesRemaining: 2303,
      totalAttempts: 118,
      solvedThisWeek: 7,
      solvedLastWeek: 4
    },
    streak: {
      currentDays: 5,
      longestDays: 11,
      activeDays: 41,
      lastActiveAt: now - 2 * 3_600_000,
      lastSolvedAt: now - 5 * 3_600_000
    },
    activity,
    weekly,
    difficulty: [
      { difficulty: "easy", total: 39, completed: 24, attempted: 3, percent: 62 },
      { difficulty: "medium", total: 73, completed: 14, attempted: 4, percent: 19 },
      { difficulty: "hard", total: 11, completed: 1, attempted: 0, percent: 9 }
    ],
    patterns: patterns
      .map(([pattern, total, completed]) => ({
        pattern,
        label: patternLabel(pattern),
        total,
        completed,
        attempted: completed < total ? 1 : 0,
        skipped: pattern === "tree" ? 2 : 0,
        percent: Math.round((completed / total) * 100)
      }))
      .sort((left, right) => right.percent - left.percent || right.total - left.total),
    sessions: [
      {
        id: "frontend-dsa",
        order: 1,
        title: "Frontend DSA",
        status: "IN_PROGRESS",
        totalQuestions: 123,
        completedQuestions: 39,
        percent: 32,
        href: "/practice"
      },
      {
        id: "javascript-react-core",
        order: 2,
        title: "JavaScript and React Core",
        status: "LOCKED",
        totalQuestions: 0,
        completedQuestions: 0,
        percent: 0,
        href: "/interview?focus=JavaScript+and+React+Core"
      },
      {
        id: "build-real-ui-features",
        order: 3,
        title: "Build Real UI Features",
        status: "LOCKED",
        totalQuestions: 0,
        completedQuestions: 0,
        percent: 0,
        href: "/interview?focus=Build+Real+UI+Features"
      },
      {
        id: "production-ui-quality",
        order: 4,
        title: "Production UI Quality",
        status: "LOCKED",
        totalQuestions: 0,
        completedQuestions: 0,
        percent: 0,
        href: "/interview?focus=Production+UI+Quality"
      },
      {
        id: "resume-behavioral-defense",
        order: 5,
        title: "Resume and Behavioral Defense",
        status: "LOCKED",
        totalQuestions: 0,
        completedQuestions: 0,
        percent: 0,
        href: "/interview?focus=Resume+and+Behavioral+Defense"
      },
      {
        id: "final-frontend-mock",
        order: 6,
        title: "Final Frontend Mock",
        status: "LOCKED",
        totalQuestions: 0,
        completedQuestions: 0,
        percent: 0,
        href: "/interview?focus=Final+Frontend+Mock"
      }
    ],
    chapters: [
      ["arrays-hashing", "Arrays & Hashing", 10, 10],
      ["two-pointers", "Two Pointers", 11, 11],
      ["sliding-window", "Sliding Window", 11, 8],
      ["stack-queue", "Stack & Queue", 12, 6],
      ["binary-search", "Binary Search", 12, 4],
      ["linked-list", "Linked List", 12, 0],
      ["trees", "Trees", 15, 0],
      ["heap", "Heap & Priority Queue", 7, 0]
    ].map(([id, title, total, completed], index) => ({
      id: String(id),
      order: index + 1,
      title: String(title),
      status: completed === total ? "COMPLETED" : completed ? "IN_PROGRESS" : "LOCKED",
      totalQuestions: Number(total),
      completedQuestions: Number(completed),
      percent: Math.round((Number(completed) / Number(total)) * 100),
      href: `/practice/${id}`
    })),
    recent: [
      ["Longest Substring Without Repeating", "COMPLETED", "medium", "sliding-window", 5],
      ["Binary Search", "COMPLETED", "easy", "binary-search", 26],
      ["Trapping Rain Water", "SKIPPED", "hard", "two-pointers", 30],
      ["Valid Parentheses", "COMPLETED", "easy", "stack", 51],
      ["Merge Two Sorted Lists", "STARTED", "easy", "linked-list", 74]
    ].map(([title, status, difficulty, pattern, hoursAgo], index) => ({
      id: `mock-${index}`,
      title: String(title),
      href: "/practice",
      status: status as "COMPLETED" | "SKIPPED" | "STARTED",
      difficulty: String(difficulty),
      pattern: String(pattern),
      at: now - Number(hoursAgo) * 3_600_000
    })),
    interview: {
      readinessScore: 68,
      completedSessions: 4,
      sessionsThisWeek: 1,
      answeredQuestions: 23,
      competencies: [
        { label: "Technical depth", score: 74, attempts: 6, trend: 5 },
        { label: "Ownership", score: 68, attempts: 5, trend: 0 },
        { label: "System design", score: 61, attempts: 4, trend: -3 },
        { label: "Communication", score: 55, attempts: 4, trend: 2 }
      ],
      strongest: { label: "Technical depth", score: 74, attempts: 6, trend: 5 },
      focus: { label: "Communication", score: 55, attempts: 4, trend: 2 }
    },
    nextUp: {
      title: "Search in Rotated Sorted Array",
      href: "/dsa-questions/search-in-rotated-sorted-array",
      chapterTitle: "Binary Search",
      difficulty: "medium",
      minutes: 25
    }
  } satisfies ProgressOverview;
}

/** Dev-only harness so the Progress layout can be reviewed without a session. */
export default function ProgressPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <WorkspaceShell>
      <ProgressView overview={mockOverview()} firstName="Nikhil" />
    </WorkspaceShell>
  );
}
