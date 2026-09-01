import { interviewRoadmapSessions } from "@/lib/interviews/interview-roadmap-sessions";
import type {
  InterviewSessionKind,
  PersonalizedInterviewPlan
} from "@/lib/interviews/personalized-plan";

export const PRACTICE_ROADMAP_GENERATION_VERSION = 1 as const;

/**
 * The four sessions a candidate can actually drill.
 *
 * `final-mock` and `resume-behavioral-defense` were removed. A mock is a
 * timed continuous loop and Practice has no time pressure — its version was
 * literally the top three already-placed questions from each other session,
 * so every question appeared twice under two progress records. And defending
 * your own history is not drillable: there is one right answer, it is whatever
 * happened, and the skill is holding up under follow-ups a textarea cannot ask.
 *
 * Both remain interview rounds, where a continuous loop and live follow-ups
 * make them real. The interview roadmap has its own kinds and is unaffected.
 */
export const PRACTICE_SESSION_KEYS = [
  "dsa",
  "core-technical",
  "applied-engineering",
  "architecture-system-design"
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
 * Identity, deliberately.
 *
 * Roadmap template slugs used to be a separate generation of names
 * (`javascript-react-core`, `computer-fundamentals`, `production-ui-quality`)
 * translated to Practice keys here. They were renamed to match, so a template
 * row and a Practice session are now one identity. This map is kept as the
 * single place a future divergence would be declared, rather than removed and
 * reintroduced ad hoc at the call sites.
 */
export const PRACTICE_KEY_BY_TEMPLATE_SLUG: Readonly<Record<string, PracticeSessionKey>> =
  Object.fromEntries(PRACTICE_SESSION_KEYS.map((key) => [key, key]));

/**
 * Projects the interview roadmap into Practice, keeping its titles and order.
 * Interview-only rounds — the resume round and the final mock — are dropped,
 * so Practice shows four sessions where Interviews shows six.
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
    const key = practiceKeyForVisibleSession(session.id, session.kind);
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
 * Returns null for an interview round with no Practice counterpart. The resume
 * and final-mock rounds are interview-only; they are filtered out rather than
 * projected.
 */
function practiceKeyForVisibleSession(
  id: string,
  kind: InterviewSessionKind | null
): PracticeSessionKey | null {
  if (id === "resume-behavioral-defense") return null;
  if (kind === "problem-solving") return "dsa";
  if (kind === "core-technical") return "core-technical";
  if (kind === "applied-engineering") return "applied-engineering";
  if (kind === "architecture-system-design") return "architecture-system-design";
  if (kind === "final-mock") return null;

  throw new Error(`Unsupported Practice session: ${kind ?? id}`);
}
