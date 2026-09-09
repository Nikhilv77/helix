import type {
  DashboardDirection,
  DashboardNextFocus,
  DashboardWeeklyRhythm
} from "@/features/dashboard/contracts/dashboard-overview";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import type { ProgressDashboardOverview } from "@/features/progress/contracts/progress";
import type { CandidateProfile } from "@/lib/shared/types";
import {
  baselineAction,
  baselineCutoff,
  baselineFocusDetail,
  buildBaselinePriorities,
  currentCycleLatest,
  currentCycleRounds,
  isBaselineCalibrationPhase,
  isFreshEvidenceState,
  profilePriorities
} from "./evidence-cycle";

const SHORT_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC"
});

export function buildDirection(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null,
  now: number
): DashboardDirection {
  return {
    rhythm: buildWeeklyRhythm(profile, reports, practice, now),
    focus: buildNextFocus(profile, reports, practice)
  };
}

function buildWeeklyRhythm(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null,
  now: number
): DashboardWeeklyRhythm {
  const dates = lastSevenUtcDates(now);
  const activityByDate = new Map((practice?.activity ?? []).map((day) => [day.date, day]));
  const days = dates.map((date) => {
    const activity = activityByDate.get(date);
    const solved = activity?.solved ?? 0;
    const attempts = activity?.attempts ?? 0;
    return {
      date,
      label: shortWeekday(date),
      solved,
      attempts,
      level: Math.min(4, solved * 2 + Math.min(attempts, 2))
    };
  });

  if (!practice) {
    return {
      state: "unavailable",
      title: "Your weekly rhythm could not be loaded.",
      detail: "Your saved sessions are safe. Open Progress directly or check back shortly.",
      solved: 0,
      attempts: 0,
      activeDays: 0,
      days,
      actionHref: "/progress"
    };
  }

  const solved = days.reduce((total, day) => total + day.solved, 0);
  const attempts = days.reduce((total, day) => total + day.attempts, 0);
  const activeDays = days.filter((day) => day.solved > 0 || day.attempts > 0).length;
  const active = solved > 0 || attempts > 0;
  const startingFromBaseline = isBaselineCalibrationPhase(profile, reports, practice);

  return {
    state: active ? "active" : "empty",
    title: active
      ? solved > 0
        ? `${solved} ${plural(solved, "question")} solved`
        : `${attempts} focused ${plural(attempts, "attempt")}`
      : startingFromBaseline
        ? "Your first evidence week starts here"
        : "Start your first focused week",
    detail: active
      ? activeDays >= 4
        ? "You are spreading the work across the week. Keep the next session short and deliberate."
        : "The signal is moving. Add one short session to make the rhythm easier to repeat."
      : startingFromBaseline
        ? "Solve one recommended problem. Your plan will begin adapting from what you actually do."
        : "Show up once, finish one clear block, and the week will begin taking shape here.",
    solved,
    attempts,
    activeDays,
    days,
    actionHref: "/progress"
  };
}

function buildNextFocus(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): DashboardNextFocus {
  const currentRounds = currentCycleRounds(profile, reports);
  const currentScoredRounds = currentRounds.filter((round) => round.evidenceScore !== null);
  const latest = currentCycleLatest(profile, reports);
  const gap =
    baselineCutoff(profile) === null || currentScoredRounds.length >= 2
      ? (reports?.recurringGaps[0] ?? null)
      : null;
  if (gap) {
    const occurrences = gap.occurrences ?? 0;
    return {
      state: "interview",
      sourceLabel: "From your interviews",
      title: gap.label,
      detail: cleanSentence(
        gap.nextStep ?? `Practice ${gap.label.toLowerCase()} with one concrete example.`
      ),
      itemLabel: null,
      supportingLabel:
        occurrences > 0
          ? `Seen across ${occurrences} scored ${plural(occurrences, "round")}`
          : "Repeated interview evidence",
      actionLabel: "Practice this focus",
      actionHref: gap.practiceHref || practice?.nextUp?.href || "/practice"
    };
  }

  if (latest?.recommendedFocus) {
    return {
      state: "interview",
      sourceLabel: "From your latest interview",
      title: latest.recommendedFocus,
      detail: cleanSentence(latest.nextStep),
      itemLabel: null,
      supportingLabel: latest.strongest ? `Keep using: ${latest.strongest}` : null,
      actionLabel: "Practice this focus",
      actionHref: practice?.nextUp?.href ?? "/practice"
    };
  }

  const baselinePriorities = buildBaselinePriorities(profile);
  if (isFreshEvidenceState(profile, reports, practice) && baselinePriorities.length > 0) {
    const primary = baselinePriorities[0]!;
    const focus = baselinePriorities[1] ?? primary;
    return {
      state: "baseline",
      sourceLabel: "From your baseline",
      title: focus.label,
      detail: baselineFocusDetail(focus),
      itemLabel: null,
      supportingLabel:
        focus.mode === "strengthen"
          ? "Early opportunity · verify in practice"
          : focus.mode === "measure"
            ? "Not enough evidence yet"
            : "Early signal · verify at depth",
      actionLabel: focus === primary ? "Open focused practice" : "Explore this focus",
      actionHref: baselineAction(focus, practice).href
    };
  }

  if (practice?.nextUp) {
    const next = practice.nextUp;
    return {
      state: "practice",
      sourceLabel: "From your practice path",
      title: next.chapterTitle ?? next.title,
      detail: "Take one focused attempt to a clear stopping point before moving forward.",
      itemLabel: next.title,
      supportingLabel:
        [
          next.difficulty ? titleCase(next.difficulty) : null,
          next.minutes ? `${next.minutes} min` : null
        ]
          .filter(Boolean)
          .join(" · ") || null,
      actionLabel: "Open next question",
      actionHref: next.href
    };
  }

  const priority = profilePriorities(profile)[0] ?? null;
  if (priority && reports && practice) {
    return {
      state: "profile",
      sourceLabel: "From your profile",
      title: priority,
      detail:
        "Start here as an initial priority. Practice and interview evidence will refine this recommendation.",
      itemLabel: null,
      supportingLabel: "Profile-based, not measured yet",
      actionLabel: "Start a focused block",
      actionHref: "/practice"
    };
  }

  if (!reports || !practice) {
    return {
      state: "unavailable",
      sourceLabel: "Next focus",
      title: "Your recommendation could not be loaded.",
      detail: "Your saved evidence is safe. Open Practice to continue from your current path.",
      itemLabel: null,
      supportingLabel: null,
      actionLabel: "Open practice",
      actionHref: "/practice"
    };
  }

  return {
    state: "empty",
    sourceLabel: "Next focus",
    title: "Complete one block to unlock a sharper recommendation.",
    detail:
      "Your first finished practice question or interview will create the evidence for this card.",
    itemLabel: null,
    supportingLabel: "Waiting for your first signal",
    actionLabel: "Start practice",
    actionHref: "/practice"
  };
}

function cleanSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Practise one concrete example from your own work.";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function lastSevenUtcDates(now: number): string[] {
  const current = new Date(now);
  const today = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());

  return Array.from({ length: 7 }, (_, index) =>
    new Date(today - (6 - index) * 86_400_000).toISOString().slice(0, 10)
  );
}

function shortWeekday(date: string): string {
  return SHORT_WEEKDAY_FORMATTER.format(new Date(`${date}T00:00:00.000Z`));
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
