type DashboardCoachingState =
  | "interview-in-progress"
  | "interview-with-practice"
  | "interview-needs-practice"
  | "practice-returning"
  | "practice-momentum"
  | "practice-started"
  | "baseline-priority"
  | "resume-priority"
  | "evidence-unavailable";

export interface DashboardCoaching {
  state: DashboardCoachingState;
  eyebrow: string;
  title: string;
  body: string;
  spokenSummary: string;
  actionLabel: string;
  actionHref: string;
}

export interface DashboardReadiness {
  status: "scored" | "forming" | "unavailable";
  score: number | null;
  delta: number | null;
  scoredRounds: number;
  label: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
}

export interface DashboardPracticeContinuation {
  state: "start" | "continue" | "complete" | "unavailable";
  statusLabel: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  teacherAdvice: string;
  completedQuestions: number;
  totalQuestions: number;
  progressPercent: number;
  solvedThisWeek: number;
}

export interface DashboardInterviewContinuation {
  state: "start" | "next" | "resume" | "unavailable";
  statusLabel: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  completedRounds: number;
  latestScore: number | null;
}

export interface DashboardContinuation {
  practice: DashboardPracticeContinuation;
  interviews: DashboardInterviewContinuation;
}

export interface DashboardProgressSummary {
  state: "active" | "empty" | "unavailable";
  title: string;
  detail: string;
  completedQuestions: number;
  totalQuestions: number;
  progressPercent: number;
  streakDays: number;
  recentActivity: number[];
  actionHref: string;
}

export interface DashboardReportsSummary {
  state: "available" | "empty" | "unavailable";
  title: string;
  detail: string;
  latestScore: number | null;
  completedRounds: number;
  actionHref: string;
}

export interface DashboardTrailmateSummary {
  state: "active" | "established" | "new" | "unavailable";
  title: string;
  detail: string;
  peopleHelped: number;
  helpReceived: number;
  actionLabel: string;
  actionHref: string;
}

export interface DashboardExplore {
  progress: DashboardProgressSummary;
  reports: DashboardReportsSummary;
  trailmate: DashboardTrailmateSummary;
}

interface DashboardRhythmDay {
  date: string;
  label: string;
  solved: number;
  attempts: number;
  level: number;
}

export interface DashboardWeeklyRhythm {
  state: "active" | "empty" | "unavailable";
  title: string;
  detail: string;
  solved: number;
  attempts: number;
  activeDays: number;
  days: DashboardRhythmDay[];
  actionHref: string;
}

export interface DashboardNextFocus {
  state: "interview" | "practice" | "baseline" | "profile" | "empty" | "unavailable";
  sourceLabel: string;
  title: string;
  detail: string;
  itemLabel: string | null;
  supportingLabel: string | null;
  actionLabel: string;
  actionHref: string;
}

export interface DashboardDirection {
  rhythm: DashboardWeeklyRhythm;
  focus: DashboardNextFocus;
}

export interface DashboardOverviewData {
  coaching: DashboardCoaching;
  readiness: DashboardReadiness;
  continuation: DashboardContinuation;
  explore: DashboardExplore;
  direction: DashboardDirection;
}
