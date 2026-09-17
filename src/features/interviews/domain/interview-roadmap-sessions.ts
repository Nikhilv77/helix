import type {
  InterviewSessionKind,
  PersonalizedInterviewPlan,
  SessionBlueprint
} from "@/features/interviews/domain/personalized-plan";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import type { InterviewHistoryItem } from "@/lib/shared/types";
import {
  TECHNICAL_DEEP_DIVE_ID,
  TECHNICAL_DEEP_DIVE_PREP_SESSION,
  TECHNICAL_PROJECTS_DURATION_MINUTES,
  TECHNICAL_PROJECTS_QUESTION_COUNT,
  type TechnicalDeepDiveBlueprintIds
} from "@/features/interviews/domain/technical-deep-dive";

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
 * Planning can use many internal blueprints, but the product always presents
 * the same five interview rounds. This keeps the candidate journey stable as
 * we add richer content inside each round.
 */
export function interviewRoadmapSessions(input: {
  personalizedPlan: PersonalizedInterviewPlan | null;
  roadmap: FrontendRoadmapHome | null;
  history: InterviewHistoryItem[];
}): InterviewRoadmapSession[] {
  return permanentInterviewRounds(input.personalizedPlan, input.history);
}

export function roadmapSessionHref(session: InterviewRoadmapSession): string | null {
  if (session.id === "hiring-manager-final") return "/interview/hiring-manager";
  if (
    session.resumeSessionId &&
    (session.id === "resume-behavioral-defense" ||
      session.id === "dsa" ||
      session.id === "system-design" ||
      session.id === "hiring-manager-final")
  ) {
    return `/interview/voice?session=${encodeURIComponent(session.resumeSessionId)}`;
  }
  if (session.id === "dsa") return "/interview/dsa";
  if (session.id === "system-design") return "/interview/design";
  if (session.id === "resume-behavioral-defense") return "/interview/resume";
  if (session.id === TECHNICAL_DEEP_DIVE_ID) {
    const resumeSessionId = session.resumeSessionId;
    if (
      resumeSessionId &&
      !resumeSessionId.startsWith("core-technical:") &&
      !resumeSessionId.startsWith("applied-engineering:")
    ) {
      return `/interview/voice?session=${encodeURIComponent(resumeSessionId)}`;
    }
    return "/interview/technical-projects";
  }
  // The old generic interview wizard is retired. New content gets a dedicated
  // entry route before it is made available from the permanent roadmap.
  return null;
}

/** The permanent candidate-facing loop; detailed round content is added independently. */
function permanentInterviewRounds(
  plan: PersonalizedInterviewPlan | null,
  history: InterviewHistoryItem[]
): InterviewRoadmapSession[] {
  const core = plan?.sessions.find((session) => session.kind === "core-technical");
  const applied = plan?.sessions.find((session) => session.kind === "applied-engineering");
  const dsa = plan?.sessions.find((session) => session.kind === "problem-solving");
  const architecture = plan?.sessions.find(
    (session) => session.kind === "architecture-system-design"
  );
  const technical =
    core && applied && plan
      ? technicalDeepDiveRoadmapSession(plan.id, core, applied, history)
      : upcomingRound({
          id: "technical-project",
          order: 2,
          title: "Core Technical & Projects",
          purpose: "Core technical knowledge, project deep-dives, and practical coding.",
          covers: ["Core concepts", "Project decisions", "Practical coding"]
        });
  const problemSolving = dsa
    ? dsaRoadmapSession(dsa, history)
    : upcomingRound({
        id: "dsa",
        order: 3,
        title: "DSA Interview",
        purpose: "Solve coding problems and defend correctness, complexity, and edge cases.",
        covers: ["Two DSA problems", "Correctness", "Complexity and edge cases"]
      });
  const systemDesign = architecture
    ? systemDesignRoadmapSession(architecture, history)
    : upcomingRound({
        id: "system-design",
        order: 4,
        title: "System Design",
        purpose: "Drive an architecture from ambiguous requirements through production trade-offs.",
        covers: ["Requirements and scale", "Architecture canvas", "Failures and trade-offs"]
      });

  return [
    { ...resumeRoadmapSession(history), order: 1 },
    { ...technical, order: 2, title: "Core Technical & Projects" },
    {
      ...problemSolving,
      id: "dsa",
      order: 3,
      title: "DSA Interview",
      purpose: "Solve coding problems and defend correctness, complexity, and edge cases.",
      covers: [
        "Two DSA coding problems",
        "Approach and correctness",
        "Complexity, edge cases, and optimization"
      ],
      durationMinutes: 35
    },
    { ...systemDesign, id: "system-design", order: 4, title: "System Design" },
    upcomingRound({
      id: "hiring-manager-final",
      order: 5,
      title: "Hiring Manager & Final Behavioural",
      purpose: "A final conversation round for communication, motivation, judgement, and fit.",
      covers: ["Career motivation", "Leadership and judgement", "Candidate questions"]
    })
  ];
}

function systemDesignRoadmapSession(
  blueprint: SessionBlueprint,
  history: InterviewHistoryItem[]
): InterviewRoadmapSession {
  const latest = findLatestSession(
    history,
    (session) => session.setup.templateId === "system-design"
  );
  const progress = sessionProgress(latest, latest?.questionCount ?? 5);

  return {
    id: "system-design",
    planId: null,
    kind: "architecture-system-design",
    order: 4,
    title: "System Design",
    purpose:
      "Clarify an ambiguous problem, draw the architecture, then adapt and defend it under production pressure.",
    covers: [
      "Requirement discovery and scale",
      "Architecture canvas and deep dive",
      "Pressure testing, reliability, and trade-offs"
    ],
    ...progress,
    durationMinutes: 45,
    difficulty: blueprint.difficulty
  };
}

function upcomingRound({
  id,
  order,
  title,
  purpose,
  covers
}: Pick<
  InterviewRoadmapSession,
  "id" | "order" | "title" | "purpose" | "covers"
>): InterviewRoadmapSession {
  return {
    id,
    planId: null,
    kind: null,
    order,
    title,
    purpose,
    covers,
    totalQuestions: 0,
    completedQuestions: 0,
    progressPercent: 0,
    attemptStatus: "not_started",
    resumeSessionId: null,
    updatedPracticeAvailable: false,
    durationMinutes: null,
    difficulty: null
  };
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
    (session) => isAnyCombined(session) && session.status === "in_progress"
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
      : TECHNICAL_PROJECTS_QUESTION_COUNT;
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
    durationMinutes: TECHNICAL_PROJECTS_DURATION_MINUTES,
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
  const progress = sessionProgress(latest, latest?.questionCount ?? 2);
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
      "Two function-based DSA problems",
      "Approach and time-space complexity",
      "Correctness, edge cases, and follow-ups"
    ],
    ...progress,
    durationMinutes: 35,
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
    durationMinutes: 30,
    difficulty: "adaptive"
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

function harderDifficulty(left: string, right: string): string {
  const rank: Record<string, number> = {
    foundational: 0,
    intermediate: 1,
    advanced: 2,
    adaptive: 3
  };
  return (rank[left] ?? 0) >= (rank[right] ?? 0) ? left : right;
}
