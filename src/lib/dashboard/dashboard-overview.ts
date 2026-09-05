import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressDashboardOverview } from "@/lib/roadmap/progress";
import type { HelpDashboardOverview } from "@/lib/help/help-history";
import type { CandidateSkillSignal } from "@/lib/preparation/preparation-onboarding";
import type { PreparationAreaId } from "@/lib/preparation/preparation-areas";
import { roundShortLabel } from "@/lib/shared/labels";
import type { CandidateProfile, Level, Role } from "@/lib/shared/types";

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

export function buildDashboardOverview(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null,
  now = Date.now(),
  trailmate: HelpDashboardOverview | null = null
): DashboardOverviewData {
  return {
    coaching: buildCoaching(profile, reports, practice, now),
    readiness: buildReadiness(profile, reports, practice),
    continuation: buildContinuation(profile, reports, practice),
    explore: buildExplore(profile, reports, practice, trailmate),
    direction: buildDirection(profile, reports, practice, now)
  };
}

function buildDirection(
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

function buildExplore(
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

function buildContinuation(
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

function buildCoaching(
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

function buildReadiness(
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

type BaselinePriorityMode = "strengthen" | "measure" | "verify";

interface BaselinePriority {
  areaId: PreparationAreaId;
  areaLabel: string;
  label: string;
  mode: BaselinePriorityMode;
}

interface BaselineStrength {
  areaId: PreparationAreaId;
  label: string;
  broadDsaSignal: boolean;
}

const AREA_LABELS: Record<PreparationAreaId, string> = {
  dsa: "DSA problem solving",
  "core-technical": "Core technical depth",
  "applied-engineering": "Applied engineering judgment",
  "architecture-design": "Architecture and design"
};

const ROLE_AREA_ORDER: Record<Role, PreparationAreaId[]> = {
  frontend: ["core-technical", "dsa", "applied-engineering", "architecture-design"],
  backend: ["dsa", "core-technical", "applied-engineering", "architecture-design"],
  fullstack: ["dsa", "core-technical", "applied-engineering", "architecture-design"],
  data: ["core-technical", "applied-engineering", "architecture-design", "dsa"],
  "ai-ml": ["core-technical", "applied-engineering", "architecture-design", "dsa"],
  pm: ["core-technical", "applied-engineering", "architecture-design", "dsa"]
};

function buildBaselinePriorities(profile: CandidateProfile): BaselinePriority[] {
  const skillProfile = profile.preparationOnboarding?.skillProfile;
  if (!skillProfile?.signals.length) return [];

  const role = profile.targetRole ?? "backend";
  const areaOrder = ROLE_AREA_ORDER[role];
  const orderedSignals = [...skillProfile.signals].sort(
    (left, right) => areaOrder.indexOf(left.areaId) - areaOrder.indexOf(right.areaId)
  );
  const buckets: Record<BaselinePriorityMode, BaselinePriority[]> = {
    strengthen: [],
    measure: [],
    verify: []
  };

  for (const signal of orderedSignals) {
    const priorities = prioritiesFromSignal(signal);
    for (const priority of priorities) buckets[priority.mode].push(priority);
  }

  return [...buckets.strengthen, ...buckets.measure, ...buckets.verify];
}

function buildBaselineStrengths(profile: CandidateProfile): BaselineStrength[] {
  const signals = profile.preparationOnboarding?.skillProfile?.signals;
  if (!signals?.length) return [];

  const role = profile.targetRole ?? "backend";
  const areaOrder = ROLE_AREA_ORDER[role];
  const orderedSignals = [...signals].sort(
    (left, right) => areaOrder.indexOf(left.areaId) - areaOrder.indexOf(right.areaId)
  );
  const strengths: BaselineStrength[] = [];

  for (const signal of orderedSignals) {
    if (signal.evidence !== "baseline") continue;
    const topics = signal.topics ?? [];
    const familiar = topics.filter((topic) => topic.familiarity === "familiar");
    const needsRefresh = topics.filter((topic) => topic.familiarity === "needs-refresh");
    const broadDsaSignal =
      signal.areaId === "dsa" && familiar.length >= 3 && familiar.length > needsRefresh.length;

    if (broadDsaSignal) {
      strengths.push({
        areaId: signal.areaId,
        label: "algorithms and data structures",
        broadDsaSignal: true
      });
      continue;
    }

    for (const topic of familiar) {
      strengths.push({ areaId: signal.areaId, label: topic.label, broadDsaSignal: false });
    }

    if (
      familiar.length === 0 &&
      needsRefresh.length === 0 &&
      signal.startingState === "experienced-active"
    ) {
      strengths.push({
        areaId: signal.areaId,
        label: AREA_LABELS[signal.areaId],
        broadDsaSignal: signal.areaId === "dsa"
      });
    }
  }

  return strengths;
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
  if (skills?.length) {
    return `Your resume shows experience with ${joinPriorities(skills)}`;
  }

  const experienceRole = profile.resume?.experience?.[0]?.role?.trim();
  if (experienceRole) return `Your resume shows experience as ${experienceRole}`;

  const focus = profile.focusAreas[0]?.trim();
  if (focus) return `Your resume points to ${focus} as relevant experience`;
  return "Your profile gives us initial context";
}

function prioritiesFromSignal(signal: CandidateSkillSignal): BaselinePriority[] {
  const areaLabel = AREA_LABELS[signal.areaId];
  if (signal.evidence === "not-enough-evidence") {
    return [{ areaId: signal.areaId, areaLabel, label: areaLabel, mode: "measure" }];
  }

  const topics = signal.topics ?? [];
  const needsRefresh = topics
    .filter((topic) => topic.familiarity === "needs-refresh")
    .map((topic) => ({
      areaId: signal.areaId,
      areaLabel,
      label: topic.label,
      mode: "strengthen" as const
    }));
  if (needsRefresh.length > 0) return needsRefresh;

  if (
    signal.startingState === "needs-foundations" ||
    signal.startingState === "experienced-rusty" ||
    signal.startingState === "some-familiarity"
  ) {
    return [{ areaId: signal.areaId, areaLabel, label: areaLabel, mode: "strengthen" }];
  }

  const familiar = topics.find((topic) => topic.familiarity === "familiar");
  if (familiar) {
    return [{ areaId: signal.areaId, areaLabel, label: familiar.label, mode: "verify" }];
  }

  return [
    {
      areaId: signal.areaId,
      areaLabel,
      label: areaLabel,
      mode: signal.startingState === "experienced-active" ? "verify" : "measure"
    }
  ];
}

function baselineAction(
  priority: BaselinePriority,
  practice: ProgressDashboardOverview | null
): { href: string; direct: boolean } {
  const next = practice?.nextUp;
  if (!next) return { href: "/practice", direct: false };

  const priorityKey = normalizedFocus(priority.label);
  const matches = [next.chapterTitle, next.title]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizedFocus(value) === priorityKey);
  return matches ? { href: next.href, direct: true } : { href: "/practice", direct: false };
}

function baselineFocusDetail(priority: BaselinePriority): string {
  if (priority.mode === "strengthen") {
    return `Your starting signal suggests ${priority.label} needs a refresh. Use one focused block to verify and strengthen it.`;
  }
  if (priority.mode === "measure") {
    return `The baseline did not collect enough evidence here. A focused attempt will make the next recommendation sharper.`;
  }
  return `The baseline suggests familiarity here. Test it at greater depth before moving on.`;
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

function normalizedFocus(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isFreshEvidenceState(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): boolean {
  if (!reports || !practice) return false;
  return (
    !currentCycleRounds(profile, reports).some(
      (round) => round.answerCount > 0 || round.evidenceScore !== null
    ) &&
    !currentCycleLatest(profile, reports) &&
    practice.totals.totalAttempts === 0 &&
    practice.totals.completedQuestions === 0
  );
}

function isBaselineCalibrationPhase(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null
): boolean {
  if (!reports || !practice || buildBaselinePriorities(profile).length === 0) return false;
  const hasInterviewAnswer = currentCycleRounds(profile, reports).some(
    (round) => round.answerCount > 0 || round.evidenceScore !== null
  );
  return !hasInterviewAnswer && practice.totals.completedQuestions === 0;
}

function isActionableInterview(
  profile: CandidateProfile,
  round: ReportsOverview["rounds"][number]
): boolean {
  // Legacy profiles predate the baseline flow, so preserve their existing resume behavior.
  // Once a baseline exists, merely opening a room is not stronger evidence than completing it.
  return baselineCutoff(profile) === null || round.answerCount > 0;
}

function baselineCutoff(profile: CandidateProfile): number | null {
  const onboarding = profile.preparationOnboarding;
  const generatedAt = onboarding?.skillProfile?.generatedAt ?? null;
  const completedAt = onboarding?.completedAt ?? null;
  if (generatedAt === null) return completedAt;
  if (completedAt === null) return generatedAt;
  return Math.max(generatedAt, completedAt);
}

function currentCycleRounds(
  profile: CandidateProfile,
  reports: ReportsOverview | null
): ReportsOverview["rounds"] {
  if (!reports) return [];
  const cutoff = baselineCutoff(profile);
  if (cutoff === null) return reports.rounds;
  return reports.rounds.filter(
    (round) => !Number.isFinite(round.startedAt) || round.startedAt >= cutoff
  );
}

function currentCycleLatest(
  profile: CandidateProfile,
  reports: ReportsOverview | null
): ReportsOverview["latest"] {
  if (!reports) return null;
  const cutoff = baselineCutoff(profile);
  if (cutoff === null) return reports.latest;
  return currentCycleRounds(profile, reports).find((round) => round.evidenceScore !== null) ?? null;
}

function currentCycleReadiness(
  profile: CandidateProfile,
  reports: ReportsOverview
): { score: number | null; delta: number | null; scoredRounds: number } {
  if (baselineCutoff(profile) === null) {
    return {
      score: reports.readinessScore,
      delta: reports.scoreDelta,
      scoredRounds: reports.scoredRounds
    };
  }

  const scores = currentCycleRounds(profile, reports)
    .filter(
      (round): round is typeof round & { evidenceScore: number } => round.evidenceScore !== null
    )
    .sort((left, right) => left.startedAt - right.startedAt)
    .map((round) => round.evidenceScore);
  const recent = scores.slice(-5);
  const score = recent.length
    ? Math.round(recent.reduce((total, value) => total + value, 0) / recent.length)
    : null;
  const first = scores[0] ?? null;
  const latest = scores.at(-1) ?? null;
  return {
    score,
    delta: first !== null && latest !== null && scores.length > 1 ? latest - first : null,
    scoredRounds: scores.length
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
