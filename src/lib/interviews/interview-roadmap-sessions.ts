import type {
  InterviewSessionKind,
  PersonalizedInterviewPlan,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import { PREP_SESSIONS, type PrepSession } from "@/lib/roadmap/frontend-plan";
import type { FrontendRoadmapHome, FrontendRoadmapSession } from "@/lib/roadmap/roadmap";
import type { InterviewHistoryItem } from "@/lib/shared/types";
import {
  TECHNICAL_DEEP_DIVE_DURATION_MINUTES,
  TECHNICAL_DEEP_DIVE_ID,
  TECHNICAL_DEEP_DIVE_PREP_SESSION,
  TECHNICAL_DEEP_DIVE_QUESTION_COUNT,
  type TechnicalDeepDiveBlueprintIds
} from "@/lib/interviews/technical-deep-dive";

export interface InterviewRoadmapSession {
  id: string;
  planId: string | null;
  kind: InterviewSessionKind | null;
  order: number;
  title: string;
  purpose: string;
  covers: string[];
  totalQuestions: number;
  completedQuestions: number;
  progressPercent: number;
  attemptStatus: "not_started" | "in_progress" | "completed" | "expired";
  /** Existing live room to resume, including one launched from a superseded plan. */
  resumeSessionId: string | null;
  /** This stable roadmap slot was completed before its current adapted blueprint. */
  updatedPracticeAvailable: boolean;
  durationMinutes: number | null;
  difficulty: string | null;
  /** Present only for the candidate-facing Core + Applied combined round. */
  technicalDeepDive?: TechnicalDeepDiveBlueprintIds;
}

/**
 * Builds the candidate-facing interview path.
 *
 * The personalized plan retains its five stable internal blueprint kinds. The
 * first kind is presented through the product's dedicated DSA round, and a
 * dedicated resume/behavioral round is inserted before the final mock. This
 * keeps the specialized interview engines while preserving the personalized
 * technical deep dives generated from the resume.
 */
export function interviewRoadmapSessions({
  personalizedPlan,
  roadmap,
  history
}: {
  personalizedPlan: PersonalizedInterviewPlan | null;
  roadmap: FrontendRoadmapHome | null;
  history: InterviewHistoryItem[];
}): InterviewRoadmapSession[] {
  if (personalizedPlan) return personalizedRoadmapSessions(personalizedPlan, history);
  if (roadmap?.sessions.length) return legacyRoadmapSessions(roadmap);
  return fallbackRoadmapSessions();
}

export function roadmapSessionHref(session: InterviewRoadmapSession): string {
  if (session.resumeSessionId?.startsWith("core-technical:")) {
    return "/practice/core-technical";
  }
  if (session.resumeSessionId?.startsWith("applied-engineering:")) {
    return "/practice/applied-engineering";
  }
  if (session.resumeSessionId) {
    return `/interview/voice?session=${encodeURIComponent(session.resumeSessionId)}`;
  }
  if (session.planId && session.technicalDeepDive) {
    const params = new URLSearchParams({
      plan: session.planId,
      coreBlueprint: session.technicalDeepDive.coreBlueprintId,
      appliedBlueprint: session.technicalDeepDive.appliedBlueprintId
    });
    return `/interview?${params.toString()}`;
  }
  if (session.planId) {
    const params = new URLSearchParams({ plan: session.planId, blueprint: session.id });
    return `/interview?${params.toString()}`;
  }
  if (session.id === "dsa") return "/interview/dsa";
  if (session.id === "resume-behavioral-defense") return "/interview/resume";
  if (session.id === "applied-engineering") return "/interview/fundamentals";
  const params = new URLSearchParams({ roadmapSession: session.id });
  return `/interview?${params.toString()}`;
}

function fallbackRoadmapSessions(): InterviewRoadmapSession[] {
  return candidateFacingPrepSessions().map((session) => ({
    id: session.id,
    planId: null,
    kind: null,
    order: session.order,
    title: session.title,
    purpose: session.purpose,
    covers: session.covers,
    totalQuestions: session.id === "dsa" ? 123 : 0,
    completedQuestions: 0,
    progressPercent: 0,
    attemptStatus: "not_started",
    resumeSessionId: null,
    updatedPracticeAvailable: false,
    durationMinutes: null,
    difficulty: null
  }));
}

function legacyRoadmapSessions(roadmap: FrontendRoadmapHome): InterviewRoadmapSession[] {
  const core = roadmap.sessions.find((session) => session.id === "core-technical");
  const applied = roadmap.sessions.find((session) => session.id === "applied-engineering");
  const technicalTotal = (core?.totalQuestions ?? 0) + (applied?.totalQuestions ?? 0);
  const technicalCompleted = (core?.completedQuestions ?? 0) + (applied?.completedQuestions ?? 0);
  const sessions = roadmap.sessions.flatMap<FrontendRoadmapSession>((session) => {
    if (session.id === "applied-engineering") return [];
    if (session.id !== "core-technical") return [{ ...session, order: visibleOrder(session.id) }];
    return [
      {
        ...session,
        id: TECHNICAL_DEEP_DIVE_ID,
        order: TECHNICAL_DEEP_DIVE_PREP_SESSION.order,
        title: TECHNICAL_DEEP_DIVE_PREP_SESSION.title,
        purpose: TECHNICAL_DEEP_DIVE_PREP_SESSION.purpose,
        covers: TECHNICAL_DEEP_DIVE_PREP_SESSION.covers,
        totalQuestions: technicalTotal,
        completedQuestions: technicalCompleted,
        progressPercent: technicalTotal
          ? Math.round((technicalCompleted / technicalTotal) * 100)
          : 0
      }
    ];
  });

  return sessions.map((session) => ({
    ...session,
    planId: null,
    kind: null,
    attemptStatus:
      session.progressPercent >= 100
        ? "completed"
        : session.progressPercent > 0
          ? "in_progress"
          : "not_started",
    resumeSessionId: null,
    updatedPracticeAvailable: false,
    durationMinutes: null,
    difficulty: null
  }));
}

function personalizedRoadmapSessions(
  plan: PersonalizedInterviewPlan,
  history: InterviewHistoryItem[]
): InterviewRoadmapSession[] {
  const visibleSessions: InterviewRoadmapSession[] = [];
  const core = plan.sessions.find((session) => session.kind === "core-technical");
  const applied = plan.sessions.find((session) => session.kind === "applied-engineering");

  for (const blueprint of plan.sessions) {
    if (blueprint.kind === "problem-solving") {
      visibleSessions.push(dsaRoadmapSession(blueprint, history));
      continue;
    }

    if (blueprint.kind === "core-technical" && core && applied) {
      visibleSessions.push(technicalDeepDiveRoadmapSession(plan.id, core, applied, history));
      continue;
    }

    if (blueprint.kind === "applied-engineering" && core && applied) continue;

    if (blueprint.kind === "architecture-system-design") {
      visibleSessions.push(personalizedBlueprintSession(plan.id, blueprint, history, 3));
      continue;
    }

    if (blueprint.kind === "final-mock") {
      visibleSessions.push(resumeRoadmapSession(history));
      visibleSessions.push(personalizedBlueprintSession(plan.id, blueprint, history, 5));
      continue;
    }

    visibleSessions.push(personalizedBlueprintSession(plan.id, blueprint, history));
  }

  return visibleSessions;
}

function technicalDeepDiveRoadmapSession(
  planId: string,
  core: SessionBlueprint,
  applied: SessionBlueprint,
  history: InterviewHistoryItem[]
): InterviewRoadmapSession {
  const isCurrentCombined = (session: InterviewHistoryItem) =>
    session.setup.templateId === TECHNICAL_DEEP_DIVE_ID &&
    session.setup.technicalDeepDive?.coreBlueprintId === core.id &&
    session.setup.technicalDeepDive?.appliedBlueprintId === applied.id;
  const isAnyCombined = (session: InterviewHistoryItem) =>
    session.setup.templateId === TECHNICAL_DEEP_DIVE_ID;
  const isSourceSlot = (session: InterviewHistoryItem) =>
    session.setup.templateId === core.id ||
    session.setup.templateId === applied.id ||
    session.setup.templateId === "core-technical" ||
    session.setup.templateId === "applied-engineering" ||
    session.setup.personalizedBlueprint?.kind === "core-technical" ||
    session.setup.personalizedBlueprint?.kind === "applied-engineering";
  const latestActive = findLatestSession(
    history,
    (session) =>
      (isAnyCombined(session) || isSourceSlot(session)) && session.status === "in_progress"
  );
  const completedCurrent = findLatestSession(
    history,
    (session) => isCurrentCombined(session) && session.status === "completed"
  );
  const latestCombined = findLatestSession(history, isAnyCombined);
  const previousTechnicalCompletion = findLatestSession(
    history,
    (session) => isSourceSlot(session) && session.status === "completed"
  );
  const progressSession = latestActive ?? completedCurrent ?? latestCombined;
  const totalQuestions =
    progressSession?.status === "in_progress"
      ? progressSession.questionCount
      : TECHNICAL_DEEP_DIVE_QUESTION_COUNT;
  const progress = sessionProgress(progressSession, totalQuestions);

  return {
    id: TECHNICAL_DEEP_DIVE_ID,
    planId,
    kind: null,
    order: 2,
    title: TECHNICAL_DEEP_DIVE_PREP_SESSION.title,
    purpose: TECHNICAL_DEEP_DIVE_PREP_SESSION.purpose,
    covers: [
      ...core.topics.slice(0, 2).map((topic) => `Core · ${topic.label}`),
      ...applied.topics.slice(0, 2).map((topic) => `Applied · ${topic.label}`)
    ],
    ...progress,
    updatedPracticeAvailable: Boolean(previousTechnicalCompletion && !completedCurrent),
    durationMinutes: TECHNICAL_DEEP_DIVE_DURATION_MINUTES,
    difficulty: harderDifficulty(core.difficulty, applied.difficulty),
    technicalDeepDive: {
      coreBlueprintId: core.id,
      appliedBlueprintId: applied.id
    }
  };
}

function dsaRoadmapSession(
  problemSolvingBlueprint: SessionBlueprint,
  history: InterviewHistoryItem[]
): InterviewRoadmapSession {
  const latest = findLatestSession(
    history,
    (session) =>
      session.setup.templateId === "dsa" || session.setup.templateTitle === "DSA practice interview"
  );
  const progress = sessionProgress(latest, latest?.questionCount ?? 3);
  const titleSuffix = problemSolvingBlueprint.title.split("·").slice(1).join("·").trim();

  return {
    id: "dsa",
    planId: null,
    kind: "problem-solving",
    order: 1,
    title: titleSuffix ? `DSA · ${titleSuffix}` : "DSA Interview",
    purpose:
      "A focused coding interview on DSA problems you have practiced, including approach, correctness, complexity, and edge cases.",
    covers: [
      "Three function-based DSA problems",
      "Approach and time-space complexity",
      "Correctness, edge cases, and follow-ups"
    ],
    ...progress,
    durationMinutes: 15,
    difficulty: "adaptive"
  };
}

function resumeRoadmapSession(history: InterviewHistoryItem[]): InterviewRoadmapSession {
  const latest = findLatestSession(
    history,
    (session) => session.setup.templateId === "resume-behavioral-defense"
  );
  const progress = sessionProgress(latest, latest?.questionCount ?? 8);

  return {
    id: "resume-behavioral-defense",
    planId: null,
    kind: null,
    order: 4,
    title: "Resume & Behavioral Defense",
    purpose:
      "Defend the experience, projects, decisions, and impact already on your resume with specific evidence.",
    covers: [
      "Project and experience deep-dives",
      "Ownership, trade-offs, and outcomes",
      "Behavioral stories and resume claims"
    ],
    ...progress,
    durationMinutes: 24,
    difficulty: "adaptive"
  };
}

function personalizedBlueprintSession(
  planId: string,
  blueprint: SessionBlueprint,
  history: InterviewHistoryItem[],
  order = blueprint.order
): InterviewRoadmapSession {
  const totalQuestions = blueprint.structure.reduce(
    (total, stage) => total + stage.questionCount,
    0
  );
  const belongsToStableSlot = (session: InterviewHistoryItem) =>
    session.setup.templateId === blueprint.id ||
    session.setup.personalizedBlueprint?.kind === blueprint.kind ||
    (blueprint.kind === "core-technical" && session.setup.templateId === "core-technical");
  const latestActive = findLatestSession(
    history,
    (session) => belongsToStableSlot(session) && session.status === "in_progress"
  );
  const completedCurrentBlueprint = findLatestSession(
    history,
    (session) => session.setup.templateId === blueprint.id && session.status === "completed"
  );
  const latestCompletedSlot = findLatestSession(
    history,
    (session) => belongsToStableSlot(session) && session.status === "completed"
  );
  const latestSlotAttempt = findLatestSession(history, belongsToStableSlot);
  const progressSession =
    latestActive ?? completedCurrentBlueprint ?? latestCompletedSlot ?? latestSlotAttempt;
  const updatedPracticeAvailable = Boolean(
    latestCompletedSlot &&
    latestCompletedSlot.setup.templateId !== blueprint.id &&
    !completedCurrentBlueprint
  );

  return {
    id: blueprint.id,
    planId,
    kind: blueprint.kind,
    order,
    title: blueprint.title,
    purpose: blueprint.subtitle,
    covers: blueprint.topics.map((topic) => topic.label),
    ...sessionProgress(progressSession, totalQuestions),
    updatedPracticeAvailable,
    durationMinutes: blueprint.durationMinutes,
    difficulty: blueprint.difficulty
  };
}

function sessionProgress(
  latest: InterviewHistoryItem | undefined,
  totalQuestions: number
): Pick<
  InterviewRoadmapSession,
  | "totalQuestions"
  | "completedQuestions"
  | "progressPercent"
  | "attemptStatus"
  | "resumeSessionId"
  | "updatedPracticeAvailable"
> {
  const completedQuestions = latest
    ? latest.status === "completed"
      ? totalQuestions
      : Math.min(totalQuestions, latest.questionsCovered)
    : 0;

  return {
    totalQuestions,
    completedQuestions,
    progressPercent: totalQuestions ? Math.round((completedQuestions / totalQuestions) * 100) : 0,
    attemptStatus: latest?.status ?? "not_started",
    resumeSessionId: latest?.status === "in_progress" ? latest.sessionId : null,
    updatedPracticeAvailable: false
  };
}

function findLatestSession(
  history: InterviewHistoryItem[],
  matches: (session: InterviewHistoryItem) => boolean
): InterviewHistoryItem | undefined {
  return history
    .filter(matches)
    .reduce<InterviewHistoryItem | undefined>(
      (latest, session) => (!latest || session.updatedAt > latest.updatedAt ? session : latest),
      undefined
    );
}

function candidateFacingPrepSessions(): PrepSession[] {
  return PREP_SESSIONS.flatMap((session) => {
    if (session.id === "applied-engineering") return [];
    if (session.id === "core-technical") return [TECHNICAL_DEEP_DIVE_PREP_SESSION];
    return [{ ...session, order: visibleOrder(session.id) }];
  });
}

function visibleOrder(id: string): number {
  if (id === "architecture-system-design") return 3;
  if (id === "resume-behavioral-defense") return 4;
  if (id === "final-mock") return 5;
  return id === "dsa" ? 1 : 2;
}

function harderDifficulty(left: string, right: string): string {
  const rank: Record<string, number> = {
    foundational: 0,
    intermediate: 1,
    advanced: 2,
    adaptive: 3
  };
  return (rank[left] ?? 0) >= (rank[right] ?? 0) ? left : right;
}
