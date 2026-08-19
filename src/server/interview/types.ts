export const ROLES = ["backend", "frontend", "fullstack", "data", "ai-ml", "pm"] as const;
export const LEVELS = ["fresher", "0-2", "3-5", "5-plus"] as const;
export const ROUND_TYPES = ["behavioral", "technical", "hiring-manager"] as const;
export const INTENSITIES = ["friendly", "realistic", "brutal"] as const;

export type Role = (typeof ROLES)[number];
export type Level = (typeof LEVELS)[number];
export type RoundType = (typeof ROUND_TYPES)[number];
export type Intensity = (typeof INTENSITIES)[number];

export interface InterviewSetup {
  role: Role;
  level: Level;
  roundType: RoundType;
  intensity: Intensity;
  /** Free text: "what have you actually worked on?" — drives the whole plan. */
  context: string;
  /**
   * A chosen template's objectives. When present the round covers these and
   * nothing else, so picking "Defend your projects" cannot drift into a general
   * behavioural interview.
   */
  agenda?: string[];
  /** Which template produced the agenda, for history and reports. */
  templateId?: string;
  templateTitle?: string;
  /** Slugs selected for the live DSA workspace, in interview order. */
  dsaQuestionSlugs?: string[];
  /** DSA rounds use a compact set of practice questions instead of the default four-question arc. */
  questionCount?: 3 | 4 | 5;
}

export interface PlannedQuestion {
  /** Spoken verbatim. The decider never rewrites this. */
  text: string;
  /** Exact resume/project claim that motivated this question. */
  evidenceAnchor?: string;
  /** Structured presentation metadata. Optional for sessions saved before code rounds existed. */
  kind?: "conversation" | "code";
  language?: string;
  codeTask?: string;
  codeSnippet?: string;
  /** Human-readable skill area, used to keep the interview arc balanced. */
  competency?: string;
  /** What the interviewer is trying to learn, not spoken to the candidate. */
  intent?: string;
  mustHit: string[];
  /** Fallback probe used when the decider call fails or times out. */
  probeIfMissing: string;
}

export type Phase = "intro" | "questioning" | "wrap" | "done";
export type Speaker = "agent" | "user";
export type DecisionAction = "clarify" | "probe" | "challenge" | "move_on";
export type MissingDimension =
  "clarity" | "structure" | "specificity" | "ownership" | "outcome" | "none";

export type EvidenceDimension = "ownership" | "decision" | "specificity" | "outcome";

export interface EvidenceLedger {
  ownership: string[];
  decision: string[];
  specificity: string[];
  outcome: string[];
  gaps: EvidenceDimension[];
}

/** Timestamps are offsets in milliseconds from the session start. */
export interface Turn {
  speaker: Speaker;
  text: string;
  startMs: number;
  endMs: number;
  /**
   * Display metadata on agent turns, so a page reload can render the same
   * annotations the live decision produced. Not part of the persisted Turn
   * shape in Phase 6 — speaker/text/startMs/endMs is what goes to Prisma.
   */
  action?: TurnAction;
  forcedBy?: ForcedReason | null;
  /** Which planned question this turn belonged to. */
  questionIndex?: number;
}

export type TurnAction = DecisionAction | "interrupt" | "intro";

export interface InterviewState {
  id: string;
  setup: InterviewSetup;
  plan: PlannedQuestion[];
  phase: Phase;
  questionIndex: number;
  /** Probes and challenges share one budget per question. */
  followUpCount: number;
  /** Epoch milliseconds. */
  startedAt: number;
  turns: Turn[];
  /** Durable evidence per planned question/resume claim. */
  evidence?: Record<string, EvidenceLedger>;
}

export interface Decision {
  action: DecisionAction;
  missing: MissingDimension;
  /** Internal rationale. Never spoken. */
  reason: string;
  /** What the agent says. For move_on this already includes the next question. */
  utterance: string;
  /** Set when a guard overrode the model's requested action. */
  forcedBy: ForcedReason | null;
}

export type ForcedReason = "follow-up-budget" | "soft-time" | "hard-time";

export const MAX_FOLLOW_UPS = 2;
export const QUESTION_COUNT = 4;
export const HARD_CAP_MS = 15 * 60 * 1000;
/** After this point the machine wraps up regardless of questions remaining. */
export const SOFT_WRAP_MS = 13 * 60 * 1000;
