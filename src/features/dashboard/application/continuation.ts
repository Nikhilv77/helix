import type {
  DashboardContinuation,
  DashboardInterviewContinuation,
  DashboardPracticeContinuation
} from "@/features/dashboard/contracts/dashboard-overview";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import type { ProgressDashboardOverview } from "@/features/progress/contracts/progress";
import { roundShortLabel } from "@/lib/shared/labels";
import type { CandidateProfile } from "@/lib/shared/types";
import {
  currentCycleLatest,
  currentCycleRounds,
  isActionableInterview,
  isBaselineCalibrationPhase
} from "./evidence-cycle";

const PRACTICE_TEACHER_ADVICE = [
  "Read the constraints carefully, choose one invariant, and let it guide every decision.",
  "Explain the simplest correct approach first, then improve only the expensive part.",
  "Name the state you need to preserve before writing the first line.",
  "Test one ordinary case and one awkward edge case before you commit.",
  "Spend two quiet minutes planning; clear structure usually beats fast typing.",
  "Choose the data structure for its operations, not because it feels familiar.",
  "Say the time and space trade-off aloud before locking in your approach.",
  "Keep the invariant visible; every update should make it easier to defend.",
  "Start from brute force, identify repeated work, then remove only that waste.",
  "Use a tiny example to verify your state changes before handling scale.",
  "Separate what must be remembered from what can be computed on demand.",
  "Before coding, decide exactly what each variable means at every step.",
  "Treat boundary cases as design inputs, not cleanup after the main solution.",
  "Prefer one clear pass with explicit state over several clever hidden assumptions.",
  "If the explanation feels tangled, simplify the state before touching the code.",
  "Write the stopping condition first; it often reveals the correct loop shape.",
  "Ask what changes between neighboring steps and store only that difference.",
  "Make correctness obvious first; optimize only after the reasoning is stable.",
  "Trace the smallest failing example and watch exactly where the invariant breaks.",
  "Keep mutation local and predictable so every intermediate state stays explainable.",
  "Use the constraints to rule out approaches before comparing implementation details.",
  "Describe the expected complexity before coding, then verify the code actually matches.",
  "Look for duplicated work; that is usually where the better approach begins.",
  "Finish with one adversarial example that challenges your strongest assumption.",
  "When two approaches work, choose the one you can explain under pressure."
] as const;

export function buildContinuation(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): DashboardContinuation {
  return {
    practice: buildPracticeContinuation(profile, reports, practice),
    interviews: buildInterviewContinuation(profile, reports, practice)
  };
}

function buildPracticeContinuation(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): DashboardPracticeContinuation {
  if (!practice) {
    return {
      state: "unavailable",
      statusLabel: "Unavailable",
      title: "Practice could not be loaded.",
      detail: "Your saved work is safe. Open Practice directly or try this overview again shortly.",
      actionLabel: "Open practice",
      actionHref: "/practice",
      teacherAdvice: randomPracticeAdvice(),
      completedQuestions: 0,
      totalQuestions: 0,
      progressPercent: 0,
      solvedThisWeek: 0
    };
  }

  const totals = practice.totals;
  const completed = totals.completedQuestions;
  const total = totals.totalQuestions;
  const progressPercent = clampPercent(totals.completionPercent);
  const hasActivity = totals.totalAttempts > 0 || completed > 0;
  const complete = total > 0 && completed >= total;
  const startingFromBaseline = isBaselineCalibrationPhase(profile, reports, practice);

  if (complete) {
    return {
      state: "complete",
      statusLabel: "Path complete",
      title: "Your current practice path is complete.",
      detail:
        "Review any session or repeat a question to keep the patterns fresh before your next interview.",
      actionLabel: "Review practice",
      actionHref: "/practice",
      teacherAdvice: randomPracticeAdvice(),
      completedQuestions: completed,
      totalQuestions: total,
      progressPercent,
      solvedThisWeek: totals.solvedThisWeek
    };
  }

  const next = practice.nextUp;
  if (next) {
    const meta = [
      next.chapterTitle,
      next.difficulty ? titleCase(next.difficulty) : null,
      next.minutes ? `${next.minutes} min` : null
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      state: hasActivity ? "continue" : "start",
      statusLabel:
        completed > 0
          ? `${completed}/${total} complete`
          : hasActivity
            ? "Attempt in progress"
            : startingFromBaseline
              ? "First evidence block"
              : "Ready to start",
      title: next.title,
      detail: meta || "Your next recommended question is ready.",
      actionLabel: hasActivity
        ? "Continue question"
        : startingFromBaseline
          ? "Start recommended problem"
          : "Start question",
      actionHref: next.href,
      teacherAdvice: startingFromBaseline
        ? "Show your reasoning, test one edge case, and finish cleanly—this attempt starts shaping your plan."
        : randomPracticeAdvice(),
      completedQuestions: completed,
      totalQuestions: total,
      progressPercent,
      solvedThisWeek: totals.solvedThisWeek
    };
  }

  return {
    state: hasActivity ? "continue" : "start",
    statusLabel: hasActivity ? "In progress" : "Ready to start",
    title: hasActivity ? "Continue your practice path." : "Start your first practice block.",
    detail: hasActivity
      ? "Open Practice to continue from your saved progress."
      : "Choose one focused question and take it to a clear stopping point.",
    actionLabel: hasActivity ? "Continue practice" : "Start practice",
    actionHref: "/practice",
    teacherAdvice: randomPracticeAdvice(),
    completedQuestions: completed,
    totalQuestions: total,
    progressPercent,
    solvedThisWeek: totals.solvedThisWeek
  };
}

function randomPracticeAdvice(): string {
  return PRACTICE_TEACHER_ADVICE[Math.floor(Math.random() * PRACTICE_TEACHER_ADVICE.length)]!;
}

function buildInterviewContinuation(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): DashboardInterviewContinuation {
  if (!reports) {
    return {
      state: "unavailable",
      statusLabel: "Unavailable",
      title: "Interviews could not be loaded.",
      detail:
        "Your completed rounds are safe. Open Interviews directly or try this overview again shortly.",
      actionLabel: "Open interviews",
      actionHref: "/interviews",
      completedRounds: 0,
      latestScore: null
    };
  }

  const active =
    currentCycleRounds(profile, reports).find(
      (round) => round.status === "in_progress" && isActionableInterview(profile, round)
    ) ?? null;
  if (active) {
    const roundName = active.templateTitle ?? `${roundShortLabel(active.roundType)} interview`;
    const answered = active.answerCount || active.questionsCovered;
    const progress = answered > 0 ? `${answered} answers saved. ` : "";

    return {
      state: "resume",
      statusLabel: "Round in progress",
      title: `Resume your ${roundName}.`,
      detail: `${progress}Finish while the context and your reasoning are still fresh.`,
      actionLabel: "Resume interview",
      actionHref: active.href,
      completedRounds: reports.completedRounds,
      latestScore: reports.latestScore
    };
  }

  const latest = currentCycleLatest(profile, reports);
  if (latest) {
    const latestKind = roundShortLabel(latest.roundType);
    const focus = latest.recommendedFocus;
    return {
      state: "next",
      statusLabel: `${reports.completedRounds} completed ${plural(reports.completedRounds, "round")}`,
      title: "Take your next interview.",
      detail: focus
        ? `Your latest ${latestKind.toLowerCase()} round points to ${focus} as the next thing to pressure-test.`
        : `Build on your latest ${latestKind.toLowerCase()} round with another focused session.`,
      actionLabel: "Choose next interview",
      actionHref: "/interviews",
      completedRounds: reports.completedRounds,
      latestScore: latest.evidenceScore
    };
  }

  if (isBaselineCalibrationPhase(profile, reports, practice)) {
    return {
      state: "start",
      statusLabel: "Baseline complete",
      title: "Your first proof check comes after focused practice.",
      detail:
        "Your baseline set the direction. Build one clean practice signal first, then use an interview to verify it under pressure.",
      actionLabel: "View interview path",
      actionHref: "/interviews",
      completedRounds: reports.completedRounds,
      latestScore: null
    };
  }

  const hasPreviousAttempt = currentCycleRounds(profile, reports).length > 0;
  return {
    state: "start",
    statusLabel: hasPreviousAttempt ? "Previous attempt saved" : "No rounds yet",
    title: hasPreviousAttempt ? "Start a fresh interview." : "Take your first interview.",
    detail: hasPreviousAttempt
      ? "Choose a focused round and create the first answer evidence for your readiness signal."
      : "Choose a focused session and answer at least one question to establish your readiness signal.",
    actionLabel: hasPreviousAttempt ? "Choose an interview" : "Start first interview",
    actionHref: "/interviews",
    completedRounds: reports.completedRounds,
    latestScore: null
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
