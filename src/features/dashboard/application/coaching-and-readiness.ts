import type {
  DashboardCoaching,
  DashboardReadiness
} from "@/features/dashboard/contracts/dashboard-overview";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import type { ProgressDashboardOverview } from "@/features/progress/contracts/progress";
import type { CandidateProfile, Level, Role } from "@/lib/shared/types";
import {
  baselineAction,
  baselineCutoff,
  buildBaselinePriorities,
  buildBaselineStrengths,
  currentCycleLatest,
  currentCycleReadiness,
  currentCycleRounds,
  isActionableInterview,
  normalizedFocus,
  profilePriorities,
  type BaselineStrength
} from "./evidence-cycle";

const RETURNING_AFTER_DAYS = 7;

export function buildCoaching(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null,
  now: number
): DashboardCoaching {
  const currentRounds = currentCycleRounds(profile, reports);
  const currentScoredRounds = currentRounds.filter((round) => round.evidenceScore !== null);
  const activeInterview =
    currentRounds.find(
      (round) => round.status === "in_progress" && isActionableInterview(profile, round)
    ) ?? null;
  const latestInterview = currentCycleLatest(profile, reports);
  const recurringGap =
    baselineCutoff(profile) === null || currentScoredRounds.length >= 2
      ? (reports?.recurringGaps[0] ?? null)
      : null;
  const gap = latestInterview?.recommendedFocus ?? recurringGap?.label ?? "answer specificity";
  const nextStep = cleanSentence(
    latestInterview?.nextStep ??
      recurringGap?.nextStep ??
      `Practise ${gap.toLowerCase()} with one concrete example from your own work.`
  );
  const completed = practice?.totals.completedQuestions ?? 0;
  const attempts = practice?.totals.totalAttempts ?? 0;
  const solvedThisWeek = practice?.totals.solvedThisWeek ?? 0;
  const nextQuestion = practice?.nextUp?.title ?? null;
  const nextQuestionHref = practice?.nextUp?.href ?? "/practice";
  const practiceAction = recurringGap?.practiceHref ?? nextQuestionHref;

  if (activeInterview) {
    const previousSignal = latestInterview
      ? `Your latest scored round points to ${gap} as the next area to sharpen.`
      : "Finish this round so your teacher has real answer evidence to work with.";

    return {
      state: "interview-in-progress",
      eyebrow: "Round in progress",
      title: "Finish the interview while the context is fresh.",
      body: `${previousSignal} Complete the open round before starting another practice block.`,
      spokenSummary:
        "You have an interview in progress. Finish it while the context is still fresh.",
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
      const next = nextQuestion
        ? ` Continue with “${nextQuestion}”.`
        : " Continue with one question.";
      return {
        state: "practice-returning",
        eyebrow: "Welcome back",
        title: "Restart small; your progress is still here.",
        body: `You already completed ${completed} ${plural(completed, "question")}. It has been ${daysAway} days since your last activity.${next} There is no need to catch up all at once.`,
        spokenSummary: "Welcome back. Your progress is still here, so restart with one focused question.",
        actionLabel: nextQuestion ? "Continue next question" : "Continue practice",
        actionHref: nextQuestionHref
      };
    }

    const early = completed < 3;
    const next = nextQuestion
      ? ` Continue with “${nextQuestion}”.`
      : " Continue with one more question.";
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

  if (attempts > 0 && buildBaselinePriorities(profile).length === 0) {
    const next = nextQuestion ? ` Return to “${nextQuestion}”` : " Return to Practice";
    return {
      state: "practice-started",
      eyebrow: "Practice started",
      title: "You have started; now finish one question.",
      body: `Your attempts are saved, but no question is complete yet.${next} and take it to a clear stopping point.`,
      spokenSummary:
        "You have started. Finish one question so I can begin reading your practice signal.",
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

  const baselinePriority = buildBaselinePriorities(profile)[0] ?? null;
  if (baselinePriority) {
    const action = baselineAction(baselinePriority, practice);
    const target = targetDescription(profile);
    const strength = buildBaselineStrengths(profile).find(
      (item) => normalizedFocus(item.label) !== normalizedFocus(baselinePriority.label)
    );
    const prioritySentence =
      baselinePriority.mode === "strengthen"
        ? `${baselinePriority.label} needs a refresh`
        : baselinePriority.mode === "measure"
          ? `${baselinePriority.label} needs more evidence`
          : `${baselinePriority.label} is ready for a deeper check`;
    const transition =
      attempts > 0
        ? "Finish your current problem; then the plan adapts to your performance."
        : "Solve one focused problem; then the plan adapts to your performance.";
    const body = `${resumeContextSentence(profile)}. For ${target}, the assessment shows ${prioritySentence}. ${transition}`;

    return {
      state: "baseline-priority",
      eyebrow: "Resume + baseline",
      title: strength
        ? `${strengthHeadline(strength)} Now sharpen ${baselinePriority.label}.`
        : baselinePriority.mode === "strengthen"
          ? `Strengthen ${baselinePriority.label} first.`
          : baselinePriority.mode === "measure"
            ? `Build evidence in ${baselinePriority.label} next.`
            : `Pressure-test ${baselinePriority.label} next.`,
      body,
      spokenSummary: strength
        ? `${strengthHeadline(strength)} Based on your resume and assessment, sharpen ${baselinePriority.label} next. One solved problem will start personalizing the plan from your performance.`
        : `Based on your resume and assessment, start with ${baselinePriority.label}. One solved problem will start personalizing the plan from your performance.`,
      actionLabel:
        attempts > 0
          ? "Finish first problem"
          : action.direct
            ? "Start recommended question"
            : "Open focused practice",
      actionHref: action.href
    };
  }

  const priorities = resumePriorities(profile);
  const priorityText = joinPriorities(priorities);
  const next = nextQuestion
    ? ` Start with “${nextQuestion}”.`
    : " Start with one short practice block.";

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

export function buildReadiness(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): DashboardReadiness {
  if (!reports) {
    return {
      status: "unavailable",
      score: null,
      delta: null,
      scoredRounds: 0,
      label: "Unavailable",
      detail: "The latest interview evidence could not be loaded.",
      actionLabel: "Open interviews",
      actionHref: "/interviews"
    };
  }

  const readiness = currentCycleReadiness(profile, reports);
  if (readiness.score === null) {
    const priorities = buildBaselinePriorities(profile);
    const priority = priorities[0] ?? null;
    if (priority) {
      const sampledAreas = profile.preparationOnboarding?.skillProfile?.signals.length ?? 0;
      const action = baselineAction(priority, practice);
      const signal =
        priority.mode === "strengthen"
          ? `${priority.label} is the clearest early opportunity.`
          : priority.mode === "measure"
            ? `${priority.label} still needs a stronger sample.`
            : `${priority.label} is ready for a deeper check.`;
      return {
        status: "forming",
        score: null,
        delta: null,
        scoredRounds: 0,
        label: "Your starting profile",
        detail: `Resume and baseline mapped ${sampledAreas} ${plural(sampledAreas, "preparation area")}. ${signal} This is a starting map—not a readiness score.`,
        actionLabel: "Build evidence",
        actionHref: action.href
      };
    }

    return {
      status: "forming",
      score: null,
      delta: null,
      scoredRounds: 0,
      label: "Still forming",
      detail: "Answer at least one interview question to establish a readiness signal.",
      actionLabel: "Start interview",
      actionHref: "/interview"
    };
  }

  return {
    status: "scored",
    score: readiness.score,
    delta: readiness.delta,
    scoredRounds: readiness.scoredRounds,
    label: readinessLabel(readiness.score),
    detail:
      readiness.scoredRounds === 1
        ? "Based on your first scored interview."
        : `Based on your ${Math.min(readiness.scoredRounds, 5)} most recent scored rounds.`,
    actionLabel: "Open reports",
    actionHref: "/reports"
  };
}

function strengthHeadline(strength: BaselineStrength): string {
  return strength.broadDsaSignal
    ? "Your algorithms and data structures understanding is strong."
    : `You showed a solid starting grasp of ${strength.label}.`;
}

function resumeContextSentence(profile: CandidateProfile): string {
  const skills = profile.resume?.skills
    .map((skill) => skill.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (skills?.length) return `Your resume shows experience with ${joinPriorities(skills)}`;

  const experienceRole = profile.resume?.experience?.[0]?.role?.trim();
  if (experienceRole) return `Your resume shows experience as ${experienceRole}`;

  const focus = profile.focusAreas[0]?.trim();
  if (focus) return `Your resume points to ${focus} as relevant experience`;
  return "Your profile gives us initial context";
}

function targetDescription(profile: CandidateProfile): string {
  const role = profile.targetRole ? ROLE_LABELS[profile.targetRole] : "your target role";
  const level = profile.level ? LEVEL_LABELS[profile.level] : null;
  return level ? `${role} at ${level}` : role;
}

const ROLE_LABELS: Record<Role, string> = {
  backend: "a Backend Engineer",
  frontend: "a Frontend Engineer",
  fullstack: "a Full Stack Engineer",
  data: "a Data Engineer",
  "ai-ml": "an AI / ML Engineer",
  pm: "a Product Manager"
};

const LEVEL_LABELS: Record<Level, string> = {
  fresher: "entry level",
  "0-2": "SDE-1 level",
  "3-5": "SDE-2 level",
  "5-plus": "senior level"
};

function resumePriorities(profile: CandidateProfile): string[] {
  const priorities = profilePriorities(profile);
  return priorities.length ? priorities : ["technical depth", "evidence-backed communication"];
}

function joinPriorities(priorities: string[]): string {
  return priorities.length === 1 ? (priorities[0] ?? "Technical depth") : priorities.join(" and ");
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
