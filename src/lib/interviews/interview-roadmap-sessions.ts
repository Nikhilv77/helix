import type {
  InterviewSessionKind,
  PersonalizedInterviewPlan,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import { FRONTEND_SESSIONS } from "@/lib/roadmap/frontend-plan";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import type { InterviewHistoryItem } from "@/lib/shared/types";

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
  if (session.resumeSessionId) {
    return `/interview/voice?session=${encodeURIComponent(session.resumeSessionId)}`;
  }
  if (session.planId) {
    const params = new URLSearchParams({ plan: session.planId, blueprint: session.id });
    return `/interview?${params.toString()}`;
  }
  if (session.id === "frontend-dsa") return "/interview/dsa";
  if (session.id === "resume-behavioral-defense") return "/interview/resume";
  if (session.id === "computer-fundamentals") return "/interview/fundamentals";
  const params = new URLSearchParams({ roadmapSession: session.id });
  return `/interview?${params.toString()}`;
}

function fallbackRoadmapSessions(): InterviewRoadmapSession[] {
  return FRONTEND_SESSIONS.map((session) => ({
    id: session.id,
    planId: null,
    kind: null,
    order: session.order,
    title: session.title,
    purpose: session.purpose,
    covers: session.covers,
    totalQuestions: session.id === "frontend-dsa" ? 123 : 0,
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
  return roadmap.sessions.map((session) => ({
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

  for (const blueprint of plan.sessions) {
    if (blueprint.kind === "problem-solving") {
      visibleSessions.push(dsaRoadmapSession(blueprint, history));
      continue;
    }

    if (blueprint.kind === "final-mock") {
      visibleSessions.push(resumeRoadmapSession(history));
      visibleSessions.push(personalizedBlueprintSession(plan.id, blueprint, history, 6));
      continue;
    }

    visibleSessions.push(personalizedBlueprintSession(plan.id, blueprint, history));
  }

  return visibleSessions;
}

function dsaRoadmapSession(
  problemSolvingBlueprint: SessionBlueprint,
  history: InterviewHistoryItem[]
): InterviewRoadmapSession {
  const latest = findLatestSession(
    history,
    (session) =>
      session.setup.templateId === "frontend-dsa" ||
      session.setup.templateTitle === "DSA practice interview"
  );
  const progress = sessionProgress(latest, latest?.questionCount ?? 3);
  const titleSuffix = problemSolvingBlueprint.title.split("·").slice(1).join("·").trim();

  return {
    id: "frontend-dsa",
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
    order: 5,
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
    session.setup.personalizedBlueprint?.kind === blueprint.kind;
  const latestActive = findLatestSession(
    history,
    (session) => belongsToStableSlot(session) && session.status === "in_progress"
  );
  const completedCurrentBlueprint = findLatestSession(
    history,
    (session) =>
      session.setup.templateId === blueprint.id && session.status === "completed"
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
