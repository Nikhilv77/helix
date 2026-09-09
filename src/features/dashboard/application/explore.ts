import type {
  DashboardExplore,
  DashboardProgressSummary,
  DashboardReportsSummary,
  DashboardTrailmateSummary
} from "@/features/dashboard/contracts/dashboard-overview";
import type { HelpDashboardOverview } from "@/features/peer-help/contracts/help-history";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import type { ProgressDashboardOverview } from "@/features/progress/contracts/progress";
import type { CandidateProfile } from "@/lib/shared/types";
import { currentCycleLatest, currentCycleRounds } from "./evidence-cycle";

export function buildExplore(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null,
  trailmate: HelpDashboardOverview | null
): DashboardExplore {
  return {
    progress: buildProgressSummary(practice),
    reports: buildReportsSummary(profile, reports),
    trailmate: buildTrailmateSummary(trailmate)
  };
}

function buildProgressSummary(
  practice: ProgressDashboardOverview | null
): DashboardProgressSummary {
  if (!practice) {
    return {
      state: "unavailable",
      title: "Progress is temporarily unavailable.",
      detail: "Your saved activity is safe. Open Progress directly or check back shortly.",
      completedQuestions: 0,
      totalQuestions: 0,
      progressPercent: 0,
      streakDays: 0,
      recentActivity: Array.from({ length: 7 }, () => 0),
      actionHref: "/progress"
    };
  }

  const totals = practice.totals;
  const hasActivity = totals.totalAttempts > 0 || totals.completedQuestions > 0;
  const streakDays = practice.streak.currentDays ?? 0;
  const recent = (practice.activity ?? []).slice(-7);
  const activity = recent.map((day) => Math.min(4, day.solved * 2 + Math.min(day.attempts, 2)));
  const recentActivity = [
    ...Array.from({ length: Math.max(0, 7 - activity.length) }, () => 0),
    ...activity
  ];

  return {
    state: hasActivity ? "active" : "empty",
    title: hasActivity
      ? `${totals.completedQuestions} ${plural(totals.completedQuestions, "question")} completed`
      : "Start building your progress signal.",
    detail: hasActivity
      ? streakDays > 0
        ? `${streakDays}-day rhythm active. Keep the next session focused and repeatable.`
        : "Your path is moving. A small, repeatable week matters more than one long session."
      : "Your activity, completion pace, and consistency will appear here after your first attempt.",
    completedQuestions: totals.completedQuestions,
    totalQuestions: totals.totalQuestions,
    progressPercent: clampPercent(totals.completionPercent),
    streakDays,
    recentActivity,
    actionHref: "/progress"
  };
}

function buildReportsSummary(
  profile: CandidateProfile,
  reports: ReportsOverview | null
): DashboardReportsSummary {
  if (!reports) {
    return {
      state: "unavailable",
      title: "Reports are temporarily unavailable.",
      detail: "Your interview evidence is safe. Open Reports directly or check back shortly.",
      latestScore: null,
      completedRounds: 0,
      actionHref: "/reports"
    };
  }

  const latest = currentCycleLatest(profile, reports);
  const currentRounds = currentCycleRounds(profile, reports);
  const completedRounds = currentRounds.filter((round) => round.status === "completed").length;
  if (!latest) {
    return {
      state: "empty",
      title: "Your first report starts with one round.",
      detail: "Complete an interview to turn your answers into strengths, gaps, and next steps.",
      latestScore: null,
      completedRounds,
      actionHref: "/reports"
    };
  }

  const latestScore = latest.evidenceScore;
  const focus = latest.recommendedFocus;
  return {
    state: "available",
    title: latestScore === null ? "Your latest report is ready." : `${latestScore}% latest signal`,
    detail: focus
      ? `Your clearest next focus is ${focus.toLowerCase()}.`
      : "Review the evidence from your latest round and choose the next skill to strengthen.",
    latestScore,
    completedRounds,
    actionHref: "/reports"
  };
}

function buildTrailmateSummary(trailmate: HelpDashboardOverview | null): DashboardTrailmateSummary {
  if (!trailmate) {
    return {
      state: "unavailable",
      title: "Trailmate is temporarily unavailable.",
      detail: "Open the community hub directly to see conversations and available peers.",
      peopleHelped: 0,
      helpReceived: 0,
      actionLabel: "Open Trailmate",
      actionHref: "/trailmate"
    };
  }

  const active = trailmate.activeConversation;
  if (active) {
    return {
      state: "active",
      title: `Continue with ${active.peer.label}.`,
      detail: active.started
        ? `Your ${active.title} session is in progress.`
        : `Your private room for ${active.title} is ready.`,
      peopleHelped: trailmate.peopleHelped,
      helpReceived: trailmate.helpReceived,
      actionLabel: active.started ? "Resume room" : "Join room",
      actionHref: `/trailmate/room/${encodeURIComponent(active.requestId)}`
    };
  }

  const established = trailmate.peopleHelped > 0 || trailmate.helpReceived > 0;
  return {
    state: established ? "established" : "new",
    title: established
      ? trailmate.peopleHelped > 0
        ? `${trailmate.peopleHelped} ${plural(trailmate.peopleHelped, "peer")} supported`
        : `${trailmate.helpReceived} ${plural(trailmate.helpReceived, "peer")} showed up for you`
      : "Solve with someone beside you.",
    detail: established
      ? "Keep building the circle that helps everyone get unstuck faster."
      : "Ask for another perspective or help a peer through a problem you know.",
    peopleHelped: trailmate.peopleHelped,
    helpReceived: trailmate.helpReceived,
    actionLabel: "Open Trailmate",
    actionHref: "/trailmate"
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
