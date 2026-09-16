import type { SessionBlueprint } from "@/features/interviews/domain/personalized-plan";
import type { PrepSession } from "@/lib/roadmap/frontend-plan";

export const TECHNICAL_DEEP_DIVE_ID = "technical-deep-dive" as const;
export const TECHNICAL_DEEP_DIVE_TITLE = "Technical Deep Dive" as const;
export const TECHNICAL_DEEP_DIVE_QUESTION_COUNT = 4 as const;
export const TECHNICAL_DEEP_DIVE_DURATION_MINUTES = 25 as const;
export const TECHNICAL_PROJECTS_TITLE = "Core Technical & Projects interview" as const;
export const TECHNICAL_PROJECTS_QUESTION_COUNT = 7 as const;
export const TECHNICAL_PROJECTS_DURATION_MINUTES = 40 as const;

export interface TechnicalDeepDiveBlueprintIds {
  coreBlueprintId: string;
  appliedBlueprintId: string;
}

export type TechnicalProjectsRoundIdentity = {
  templateId?: string;
  templateTitle?: string;
  technicalDeepDive?: { kind: string };
};

/** Durable identity shared by legacy four-question and current seven-question rounds. */
export function isTechnicalProjectsRound(
  setup: TechnicalProjectsRoundIdentity | null | undefined
): boolean {
  if (!setup) return false;
  return (
    setup.templateId === TECHNICAL_DEEP_DIVE_ID ||
    setup.technicalDeepDive?.kind === TECHNICAL_DEEP_DIVE_ID ||
    setup.templateTitle === TECHNICAL_DEEP_DIVE_TITLE ||
    setup.templateTitle === TECHNICAL_PROJECTS_TITLE
  );
}

/** Candidate-facing fallback used before a personalized plan is available. */
export const TECHNICAL_DEEP_DIVE_PREP_SESSION: PrepSession = {
  id: TECHNICAL_DEEP_DIVE_ID,
  order: 2,
  title: "Core Technical & Projects",
  purpose: "Prove the mechanisms you know, then defend how you used them in a real project.",
  covers: [
    "Three scenario-based technical checks",
    "One project traced from design to production",
    "Ownership, trade-offs, failures, testing, and impact"
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
