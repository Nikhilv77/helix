import { interviewRoadmapSessions } from "@/lib/interviews/interview-roadmap-sessions";
import type {
  InterviewSessionKind,
  PersonalizedInterviewPlan
} from "@/lib/interviews/personalized-plan";

export const PRACTICE_ROADMAP_GENERATION_VERSION = 1 as const;

export const PRACTICE_SESSION_KEYS = [
  "frontend-dsa",
  "core-technical",
  "applied-engineering",
  "architecture-system-design",
  "resume-behavioral-defense",
  "final-mock"
] as const;

export type PracticeSessionKey = (typeof PRACTICE_SESSION_KEYS)[number];
export type PracticeSessionAvailability = "available" | "unavailable";
export type PracticeProgressStatus =
  | "LOCKED"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";

export interface ProjectedPracticeSession {
  key: PracticeSessionKey;
  order: number;
  title: string;
  purpose: string;
  covers: string[];
  difficulty: string | null;
  durationMinutes: number | null;
  sourceBlueprintId: string | null;
  sourceBlueprintKind: InterviewSessionKind | null;
}

export interface PracticeRoadmapSession extends ProjectedPracticeSession {
  availability: PracticeSessionAvailability;
  status: PracticeProgressStatus;
  totalQuestions: number;
  attemptedQuestions: number;
  completedQuestions: number;
  progressPercent: number;
  href: string | null;
}

export interface PracticeRoadmapHome {
  roadmapId: string;
  title: string;
  generationVersion: number;
  generatedAt: number;
  sourcePlan: {
    id: string;
    revision: number;
    profileVersionId: string;
    profileRevision: number;
  };
  sessions: PracticeRoadmapSession[];
}

/**
 * Legacy template slugs are storage implementation details. These stable keys
 * are the candidate-facing identities and survive regenerated blueprint IDs.
 */
export const PRACTICE_KEY_BY_TEMPLATE_SLUG: Readonly<Record<string, PracticeSessionKey>> = {
  "frontend-dsa": "frontend-dsa",
  "javascript-react-core": "core-technical",
  "computer-fundamentals": "applied-engineering",
  "production-ui-quality": "architecture-system-design",
  "resume-behavioral-defense": "resume-behavioral-defense",
  "final-frontend-mock": "final-mock"
};

/**
 * Produces the same six titles and ordering candidates see on Interviews. It
 * intentionally excludes attempt history: Practice owns its progress state.
 */
export function projectPracticeSessions(
  personalizedPlan: PersonalizedInterviewPlan
): ProjectedPracticeSession[] {
  const visible = interviewRoadmapSessions({
    personalizedPlan,
    roadmap: null,
    history: []
  });
  const blueprintByKind = new Map(
    personalizedPlan.sessions.map((blueprint) => [blueprint.kind, blueprint])
  );

  return visible.map((session) => {
    const key = practiceKeyForVisibleSession(session.id, session.kind);
    const blueprint = session.kind ? blueprintByKind.get(session.kind) : undefined;

    return {
      key,
      order: session.order,
      title: session.title,
      purpose: session.purpose,
      covers: session.covers,
      difficulty: session.difficulty,
      durationMinutes: session.durationMinutes,
      sourceBlueprintId: blueprint?.id ?? null,
      sourceBlueprintKind: blueprint?.kind ?? null
    };
  });
}

function practiceKeyForVisibleSession(
  id: string,
  kind: InterviewSessionKind | null
): PracticeSessionKey {
  if (id === "resume-behavioral-defense") return "resume-behavioral-defense";
  if (kind === "problem-solving") return "frontend-dsa";
  if (kind === "core-technical") return "core-technical";
  if (kind === "applied-engineering") return "applied-engineering";
  if (kind === "architecture-system-design") return "architecture-system-design";
  if (kind === "final-mock") return "final-mock";

  throw new Error(`Unsupported Practice session: ${kind ?? id}`);
}
