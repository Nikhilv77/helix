import type { RoundType } from "./types";

/**
 * A session is a teaching unit first and an interview second: Maya explains
 * what the round tests and how to answer it, then runs that round against the
 * candidate's own evidence. Sessions map onto the three round types the
 * interview engine already supports, so nothing here invents a new format.
 */
export interface CurriculumSession {
  id: string;
  /** 1-based position in the plan. */
  order: number;
  title: string;
  /** One line the candidate reads in the list. */
  summary: string;
  roundType: RoundType;
  minutes: number;
  /** Why this session exists for *this* candidate, in Maya's voice. */
  coachNote: string;
  /** What the round is actually testing. */
  objective: string;
  /** The teaching content: 2-4 ideas worth internalising before answering. */
  keyIdeas: Array<{ title: string; detail: string }>;
  /** A named answer structure, rendered as a numbered diagram. */
  framework: { name: string; steps: Array<{ label: string; detail: string }> };
  /** Traps this candidate specifically is likely to fall into. */
  pitfalls: string[];
  /** Lines from their own resume the round will press on. */
  evidenceAnchors: string[];
  /** Objectives handed to the planner. The round covers these and nothing else. */
  agenda: string[];
}

export interface Curriculum {
  builtAt: number;
  headline: string;
  sessions: CurriculumSession[];
}

export const ROUND_LABEL: Record<RoundType, string> = {
  behavioral: "Behavioural",
  technical: "Technical",
  "hiring-manager": "Hiring manager"
};
