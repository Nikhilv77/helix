import type { SessionBlueprint } from "@/features/interviews/domain/personalized-plan";
import type { PrepSession } from "@/lib/roadmap/frontend-plan";

export const TECHNICAL_DEEP_DIVE_ID = "technical-deep-dive" as const;
export const TECHNICAL_DEEP_DIVE_TITLE = "Technical Deep Dive" as const;
export const TECHNICAL_DEEP_DIVE_QUESTION_COUNT = 4 as const;
export const TECHNICAL_DEEP_DIVE_DURATION_MINUTES = 25 as const;

export interface TechnicalDeepDiveBlueprintIds {
  coreBlueprintId: string;
  appliedBlueprintId: string;
}

/** Candidate-facing fallback used before a personalized plan is available. */
export const TECHNICAL_DEEP_DIVE_PREP_SESSION: PrepSession = {
  id: TECHNICAL_DEEP_DIVE_ID,
  order: 2,
  title: TECHNICAL_DEEP_DIVE_TITLE,
  purpose:
    "Connect language and framework internals to the production failures, trade-offs, and debugging decisions they create.",
  covers: [
    "Two questions on core language or framework mechanics",
    "Two production scenarios on debugging and engineering judgement",
    "Concrete reasoning from mechanism to system behaviour"
  ],
  status: "planned"
};

export function technicalDeepDiveAgenda(
  core: SessionBlueprint,
  applied: SessionBlueprint
): string[] {
  return [
    "Technical Deep Dive: connect core mechanisms to production engineering decisions.",
    ...core.topics.slice(0, 2).map((topic) => `Core · ${topic.label}: ${topic.objectives[0]}`),
    ...applied.topics.slice(0, 2).map((topic) => `Applied · ${topic.label}: ${topic.objectives[0]}`)
  ].map((item) => item.slice(0, 200));
}
