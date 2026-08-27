import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressOverview } from "@/lib/roadmap/progress";
import type { CandidateProfile } from "@/lib/shared/types";

const RETURNING_AFTER_DAYS = 7;

export type DashboardCoachingState =
  | "interview-in-progress"
  | "interview-with-practice"
  | "interview-needs-practice"
  | "practice-returning"
  | "practice-momentum"
  | "practice-started"
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
}

export interface DashboardOverviewData {
  coaching: DashboardCoaching;
  readiness: DashboardReadiness;
}

export function buildDashboardOverview(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressOverview | null,
  now = Date.now()
): DashboardOverviewData {
  return {
    coaching: buildCoaching(profile, reports, practice, now),
    readiness: buildReadiness(reports)
  };
}

function buildCoaching(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressOverview | null,
  now: number
): DashboardCoaching {
  const activeInterview = reports?.rounds.find((round) => round.status === "in_progress") ?? null;
  const latestInterview = reports?.latest ?? null;
  const gap =
    latestInterview?.recommendedFocus ?? reports?.recurringGaps[0]?.label ?? "answer specificity";
  const nextStep = cleanSentence(
    latestInterview?.nextStep ??
      reports?.recurringGaps[0]?.nextStep ??
      `Practise ${gap.toLowerCase()} with one concrete example from your own work.`
  );
  const completed = practice?.totals.completedQuestions ?? 0;
  const attempts = practice?.totals.totalAttempts ?? 0;
  const solvedThisWeek = practice?.totals.solvedThisWeek ?? 0;
  const nextQuestion = practice?.nextUp?.title ?? null;
  const nextQuestionHref = practice?.nextUp?.href ?? "/practice";
  const practiceAction = reports?.recurringGaps[0]?.practiceHref ?? nextQuestionHref;

  if (activeInterview) {
    const previousSignal = latestInterview
      ? `Your latest scored round points to ${gap} as the next area to sharpen.`
      : "Finish this round so your teacher has real answer evidence to work with.";

    return {
      state: "interview-in-progress",
      eyebrow: "Round in progress",
      title: "Finish the interview while the context is fresh.",
      body: `${previousSignal} Complete the open round before starting another practice block.`,
      spokenSummary: "You have an interview in progress. Finish it while the context is still fresh.",
      actionLabel: "Resume interview",
      actionHref: activeInterview.href
    };
  }

  if (latestInterview && completed > 0) {
    const pace =
      solvedThisWeek > 0
        ? `${solvedThisWeek} completed ${plural(solvedThisWeek, "question")} this week`
        : `${completed} completed ${plural(completed, "question")} overall`;

    return {
      state: "interview-with-practice",
      eyebrow: "Latest coaching signal",
      title: `${gap} is still the clearest place to improve.`,
      body: `${nextStep} Nice going—${pace} is real momentum. Maintain the pace, but aim the next block at ${gap}.`,
      spokenSummary: `Nice going. Maintain your practice pace, and make the next block about ${gap}.`,
      actionLabel: "Focus practice",
      actionHref: practiceAction
    };
  }

  if (latestInterview) {
    return {
      state: "interview-needs-practice",
      eyebrow: "From your latest interview",
      title: `${gap} needs the next focused block.`,
      body: `${nextStep} Start with one focused practice question before taking another interview.`,
      spokenSummary: `Your latest interview says ${gap} needs attention. Start with one focused practice block.`,
      actionLabel: "Start focused practice",
      actionHref: practiceAction
    };
  }

  if (completed > 0) {
    const daysAway = daysSince(practice?.streak.lastActiveAt ?? null, now);
    if (daysAway !== null && daysAway >= RETURNING_AFTER_DAYS) {
      const next = nextQuestion ? ` Continue with “${nextQuestion}”.` : " Continue with one question.";
      return {
        state: "practice-returning",
        eyebrow: "Welcome back",
        title: "Restart small; your progress is still here.",
        body: `You already completed ${completed} ${plural(completed, "question")}. It has been ${daysAway} days since your last activity.${next} There is no need to catch up all at once.`,
        spokenSummary: `Welcome back. Your progress is still here, so restart with one focused question.`,
        actionLabel: nextQuestion ? "Continue next question" : "Continue practice",
        actionHref: nextQuestionHref
      };
    }

    const early = completed < 3;
    const next = nextQuestion ? ` Continue with “${nextQuestion}”.` : " Continue with one more question.";
    return {
      state: "practice-momentum",
      eyebrow: early ? "A good start" : "Practice momentum",
      title: early
        ? "Good start—keep the next step small."
        : "Nice going—your practice rhythm is taking shape.",
      body: `You have completed ${completed} ${plural(completed, "question")}.${next} Maintain a repeatable pace, then take an interview to see what holds under pressure.`,
      spokenSummary: early
        ? "Good start. Keep the next step small and complete one more question."
        : "Nice going. Maintain this pace, then test it in an interview.",
      actionLabel: nextQuestion ? "Continue next question" : "Continue practice",
      actionHref: nextQuestionHref
    };
  }

  if (attempts > 0) {
    const next = nextQuestion ? ` Return to “${nextQuestion}”` : " Return to Practice";
    return {
      state: "practice-started",
      eyebrow: "Practice started",
      title: "You have started; now finish one question.",
      body: `Your attempts are saved, but no question is complete yet.${next} and take it to a clear stopping point.`,
      spokenSummary: "You have started. Finish one question so I can begin reading your practice signal.",
      actionLabel: "Finish a question",
      actionHref: nextQuestionHref
    };
  }

  if (!reports || !practice) {
    return {
      state: "evidence-unavailable",
      eyebrow: "Overview unavailable",
      title: "Your latest coaching signal could not be loaded.",
      body: "Your saved work is safe. Open Practice or Reports directly, or refresh this overview in a moment.",
      spokenSummary: "I could not load your latest coaching signal. Your saved work is safe.",
      actionLabel: "Open practice",
      actionHref: "/practice"
    };
  }

  const priorities = resumePriorities(profile);
  const priorityText = joinPriorities(priorities);
  const next = nextQuestion ? ` Start with “${nextQuestion}”.` : " Start with one short practice block.";

  return {
    state: "resume-priority",
    eyebrow: "From your resume",
    title: `${priorityText} ${priorities.length === 1 ? "is" : "are"} worth pressure-testing first.`,
    body: `This is a resume-based priority, not a measured weakness yet.${next} Your first completed practice or interview will replace this estimate with real evidence.`,
    spokenSummary: `Looking at your resume, start with ${priorities[0]}. One completed block will give me stronger evidence.`,
    actionLabel: nextQuestion ? "Start recommended question" : "Start practice",
    actionHref: nextQuestionHref
  };
}

function buildReadiness(reports: ReportsOverview | null): DashboardReadiness {
  if (!reports) {
    return {
      status: "unavailable",
      score: null,
      delta: null,
      scoredRounds: 0,
      label: "Unavailable",
      detail: "The latest interview evidence could not be loaded."
    };
  }

  if (reports.readinessScore === null) {
    return {
      status: "forming",
      score: null,
      delta: null,
      scoredRounds: 0,
      label: "Still forming",
      detail: "Answer at least one interview question to establish a readiness signal."
    };
  }

  return {
    status: "scored",
    score: reports.readinessScore,
    delta: reports.scoreDelta,
    scoredRounds: reports.scoredRounds,
    label: readinessLabel(reports.readinessScore),
    detail:
      reports.scoredRounds === 1
        ? "Based on your first scored interview."
        : `Based on your ${Math.min(reports.scoredRounds, 5)} most recent scored rounds.`
  };
}

function resumePriorities(profile: CandidateProfile): string[] {
  const candidates = [
    ...profile.focusAreas,
    ...(profile.resume?.roadmap.map((item) => item.title) ?? []),
    ...(profile.resume?.practiceQuestions.map((item) => item.competency) ?? []),
    ...(profile.resume?.skills ?? [])
  ];
  const seen = new Set<string>();
  const priorities: string[] = [];

  for (const candidate of candidates) {
    const value = candidate.replace(/\s+/g, " ").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    priorities.push(value);
    if (priorities.length === 2) break;
  }

  return priorities.length ? priorities : ["technical depth", "evidence-backed communication"];
}

function joinPriorities(priorities: string[]): string {
  return priorities.length === 1 ? priorities[0] ?? "Technical depth" : priorities.join(" and ");
}

function cleanSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Practise one concrete example from your own work.";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function daysSince(timestamp: number | null, now: number): number | null {
  if (timestamp === null || timestamp > now) return null;
  return Math.floor((now - timestamp) / 86_400_000);
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function readinessLabel(score: number): string {
  if (score >= 75) return "Strong signal";
  if (score >= 45) return "Developing";
  return "Needs focus";
}
