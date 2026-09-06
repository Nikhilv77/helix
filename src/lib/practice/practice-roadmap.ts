import { interviewRoadmapSessions } from "@/lib/interviews/interview-roadmap-sessions";
import type {
  InterviewSessionKind,
  PersonalizedInterviewPlan
} from "@/lib/interviews/personalized-plan";

export const PRACTICE_ROADMAP_GENERATION_VERSION = 2 as const;

/** DSA is the only active Practice session while the story-driven engine is rebuilt. */
export const PRACTICE_SESSION_KEYS = ["dsa"] as const;

export type PracticeSessionKey = (typeof PRACTICE_SESSION_KEYS)[number];
export type PracticeSessionAvailability = "available" | "unavailable";
export type PracticeProgressStatus = "LOCKED" | "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

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
 * Stable mapping for the current DSA template and its pre-rename legacy slug.
 */
export const PRACTICE_KEY_BY_TEMPLATE_SLUG: Readonly<Record<string, PracticeSessionKey>> = {
  dsa: "dsa",
  "frontend-dsa": "dsa"
};

/**
 * Projects only the interview plan's problem-solving round into Practice.
 * Core technical, applied engineering, architecture, resume, and final mock
 * remain interview rounds until their story-driven Practice replacements ship.
 *
 * Attempt history is intentionally excluded: Practice owns its progress state.
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

  return visible.flatMap((session): ProjectedPracticeSession[] => {
    const key = practiceKeyForVisibleSession(session.kind);
    if (key === null) return [];
    const blueprint = session.kind ? blueprintByKind.get(session.kind) : undefined;

    return [
      {
        key,
        order: session.order,
        title: session.title,
        purpose: session.purpose,
        covers: session.covers,
        difficulty: session.difficulty,
        durationMinutes: session.durationMinutes,
        sourceBlueprintId: blueprint?.id ?? null,
        sourceBlueprintKind: blueprint?.kind ?? null
      }
    ];
  });
}

/**
 * Returns null for every interview round without an active Practice counterpart.
 */
function practiceKeyForVisibleSession(kind: InterviewSessionKind | null): PracticeSessionKey | null {
  if (kind === "problem-solving") return "dsa";
  return null;
}
