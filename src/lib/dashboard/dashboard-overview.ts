import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressOverview } from "@/lib/roadmap/progress";
import type { HelpDashboardOverview } from "@/lib/help/help-history";
import { roundShortLabel } from "@/lib/shared/labels";
import type { CandidateProfile } from "@/lib/shared/types";

const RETURNING_AFTER_DAYS = 7;
const SHORT_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC"
});

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

export interface DashboardRhythmDay {
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
  state: "interview" | "practice" | "profile" | "empty" | "unavailable";
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

export function buildDashboardOverview(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressOverview | null,
  now = Date.now(),
  trailmate: HelpDashboardOverview | null = null
): DashboardOverviewData {
  return {
    coaching: buildCoaching(profile, reports, practice, now),
    readiness: buildReadiness(reports),
    continuation: buildContinuation(reports, practice),
    explore: buildExplore(reports, practice, trailmate),
    direction: buildDirection(profile, reports, practice, now)
  };
}

function buildDirection(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressOverview | null,
  now: number
): DashboardDirection {
  return {
    rhythm: buildWeeklyRhythm(practice, now),
    focus: buildNextFocus(profile, reports, practice)
  };
}

function buildWeeklyRhythm(practice: ProgressOverview | null, now: number): DashboardWeeklyRhythm {
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

  return {
    state: active ? "active" : "empty",
    title: active
      ? solved > 0
        ? `${solved} ${plural(solved, "question")} solved`
        : `${attempts} focused ${plural(attempts, "attempt")}`
      : "Start your first focused week",
    detail: active
      ? activeDays >= 4
        ? "You are spreading the work across the week. Keep the next session short and deliberate."
        : "The signal is moving. Add one short session to make the rhythm easier to repeat."
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
  practice: ProgressOverview | null
): DashboardNextFocus {
  const gap = reports?.recurringGaps[0] ?? null;
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

  const latest = reports?.latest ?? null;
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

function buildExplore(
  reports: ReportsOverview | null,
  practice: ProgressOverview | null,
  trailmate: HelpDashboardOverview | null
): DashboardExplore {
  return {
    progress: buildProgressSummary(practice),
    reports: buildReportsSummary(reports),
    trailmate: buildTrailmateSummary(trailmate)
  };
}

function buildProgressSummary(practice: ProgressOverview | null): DashboardProgressSummary {
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

function buildReportsSummary(reports: ReportsOverview | null): DashboardReportsSummary {
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

  if (!reports.latest) {
    return {
      state: "empty",
      title: "Your first report starts with one round.",
      detail: "Complete an interview to turn your answers into strengths, gaps, and next steps.",
      latestScore: null,
      completedRounds: reports.completedRounds,
      actionHref: "/reports"
    };
  }

  const latestScore = reports.latestScore ?? reports.latest.evidenceScore;
  const focus = reports.latest.recommendedFocus;
  return {
    state: "available",
    title: latestScore === null ? "Your latest report is ready." : `${latestScore}% latest signal`,
    detail: focus
      ? `Your clearest next focus is ${focus.toLowerCase()}.`
      : "Review the evidence from your latest round and choose the next skill to strengthen.",
    latestScore,
    completedRounds: reports.completedRounds,
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

function buildContinuation(
  reports: ReportsOverview | null,
  practice: ProgressOverview | null
): DashboardContinuation {
  return {
    practice: buildPracticeContinuation(practice),
    interviews: buildInterviewContinuation(reports)
  };
}

function buildPracticeContinuation(
  practice: ProgressOverview | null
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
      statusLabel: completed > 0 ? `${completed}/${total} complete` : "Ready to start",
      title: next.title,
      detail: meta || "Your next recommended question is ready.",
      actionLabel: hasActivity ? "Continue question" : "Start question",
      actionHref: next.href,
      teacherAdvice: randomPracticeAdvice(),
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
  reports: ReportsOverview | null
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

  const active = reports.rounds.find((round) => round.status === "in_progress") ?? null;
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

  if (reports.latest) {
    const latestKind = roundShortLabel(reports.latest.roundType);
    const focus = reports.latest.recommendedFocus;
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
      latestScore: reports.latestScore ?? reports.latest.evidenceScore
    };
  }

  const hasPreviousAttempt = reports.totalRounds > 0;
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
        spokenSummary: `Welcome back. Your progress is still here, so restart with one focused question.`,
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

  if (attempts > 0) {
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
  const priorities = profilePriorities(profile);
  return priorities.length ? priorities : ["technical depth", "evidence-backed communication"];
}

function profilePriorities(profile: CandidateProfile): string[] {
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

  return priorities;
}

function joinPriorities(priorities: string[]): string {
  return priorities.length === 1 ? (priorities[0] ?? "Technical depth") : priorities.join(" and ");
}

function cleanSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Practise one concrete example from your own work.";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function daysSince(timestamp: number | null, now: number): number | null {
  if (timestamp === null || timestamp > now) return null;
  return Math.floor((now - timestamp) / 86_400_000);
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

function readinessLabel(score: number): string {
  if (score >= 75) return "Strong signal";
  if (score >= 45) return "Developing";
  return "Needs focus";
}
