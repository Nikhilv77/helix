import type {
  BlueprintDifficulty,
  BlueprintStageKind,
  QuestionFormat,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";

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
  /** Trusted plan duration; personalized blueprint launches set this server-side. */
  durationMinutes?: number;
  /** Trusted immutable source copied into the session when a blueprint launches. */
  personalizedPlanId?: string;
  personalizedBlueprint?: SessionBlueprint;
  /** Slugs selected for the live DSA workspace, in interview order. */
  dsaQuestionSlugs?: string[];
  /** DSA rounds use a compact set of practice questions instead of the default four-question arc. */
  questionCount?: 3 | 4 | 5 | 6 | 7 | 8;
  /**
   * Marks the staged resume round, which is planned entirely from the kit
   * stored with the candidate's resume rather than from a model call.
   */
  resumeRound?: boolean;
  /**
   * Marks the computer fundamentals round, planned entirely from the authored
   * question bank rather than from a model call.
   */
  fundamentalsRound?: boolean;
}

export type InterviewStage =
  | "skills"
  | "code"
  | "experience"
  /** Computer fundamentals: rapid checks, then mechanism, then diagnosis. */
  | "rapid"
  | "explain"
  | "scenario";

export interface PlannedQuestion {
  /** Spoken verbatim. The decider never rewrites this. */
  text: string;
  /** Exact resume/project claim that motivated this question. */
  evidenceAnchor?: string;
  /** Structured presentation metadata. Optional for sessions saved before code rounds existed. */
  kind?: "conversation" | "code" | "mcq";
  language?: string;
  codeTask?: string;
  codeSnippet?: string;
  /** Which stage of a resume round this question belongs to. */
  stage?: InterviewStage;
  /** The resume skill a skills-stage question came from. */
  skill?: string;
  /** Options for `kind: "mcq"`. */
  options?: string[];
  /** Index into `options`. Graded on the server and never serialised to the client. */
  answerIndex?: number;
  /** Spoken after an mcq is graded, so grading costs no model call. */
  explanation?: string;
  /** How the candidate is expected to answer. */
  answerFormat?: "mcq" | "typed" | "spoken";
  /** Bank slug a question was drawn from, for its concept card. */
  sourceSlug?: string;
  /** Human-readable skill area, used to keep the interview arc balanced. */
  competency?: string;
  /** Runtime metadata stamped from a trusted personalized blueprint. */
  blueprintStage?: BlueprintStageKind;
  blueprintDifficulty?: BlueprintDifficulty;
  blueprintFormat?: QuestionFormat;
  topicKey?: string;
  skillKeys?: string[];
  rubricKeys?: string[];
  maxFollowUps?: number;
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
  /** Grounding needed to aggregate demonstrated skill ability after the round. */
  blueprint?: {
    planId: string;
    blueprintId: string;
    stage: BlueprintStageKind;
    topicKey: string;
    skillKeys: string[];
    rubricKeys: string[];
    answerExcerpts: string[];
  };
}

export type TechnicalVerdict =
  "correct" | "mostly-correct" | "partially-correct" | "incorrect" | "insufficient-evidence";

export interface QuestionRubricEvaluation {
  rubricKey: string;
  score: number;
  rationale: string;
}

/** Durable Judge0 evidence. Compilation alone is never treated as correctness. */
export interface CodeExecutionEvidence {
  language: string;
  status: string;
  accepted: boolean;
  testsPassed: number;
  testCount: number;
  compileOutput: string;
  stderr: string;
  time: string | null;
  memory: number | null;
  recordedAt: number;
}

/** Persisted technical judgement used by reports and adaptive planning. */
export interface QuestionEvaluation {
  source: "semantic-evaluator" | "local-mcq" | "evaluation-unavailable";
  score: number;
  verdict: TechnicalVerdict;
  confidence: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  rubricScores: QuestionRubricEvaluation[];
  answerExcerpts: string[];
  execution: CodeExecutionEvidence | null;
  evaluatedAt: number;
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
  /** Set on Maya's reply to a multiple choice answer, which is graded locally. */
  correct?: boolean;
  /** The question `correct` refers to, since the turn itself already advanced. */
  gradedQuestionIndex?: number;
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
  /** Semantic/local correctness judgements keyed by planned-question index. */
  questionEvaluations?: Record<string, QuestionEvaluation>;
  /** Latest Judge0 result per code question, recorded before answer submission. */
  codeExecutions?: Record<string, CodeExecutionEvidence>;
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

/** Exact API result retained for idempotent answer retries. */
export interface InterviewAnswerResponse {
  action: DecisionAction;
  utterance: string;
  missing: MissingDimension;
  forcedBy: ForcedReason | null;
  phase: Phase;
  questionIndex: number;
  questionCount: number;
  followUpCount: number;
  elapsedMs: number;
}

export type ForcedReason = "follow-up-budget" | "soft-time" | "hard-time";

export const MAX_FOLLOW_UPS = 2;
export const QUESTION_COUNT = 4;
export const HARD_CAP_MS = 15 * 60 * 1000;
/** After this point the machine wraps up regardless of questions remaining. */
export const SOFT_WRAP_MS = 13 * 60 * 1000;

/**
 * The resume round runs three stages across eight questions, one of which is
 * written at the keyboard. The default caps would wrap it up somewhere in the
 * middle of the experience stage, so it gets its own budget.
 */
export const RESUME_HARD_CAP_MS = 24 * 60 * 1000;
export const RESUME_SOFT_WRAP_MS = 21 * 60 * 1000;
const PERSONALIZED_WRAP_BUFFER_MS = 2 * 60 * 1000;

export interface RoundCaps {
  softWrapMs: number;
  hardCapMs: number;
}

export function roundCaps(setup: InterviewSetup | undefined): RoundCaps {
  if (setup?.resumeRound) {
    return { softWrapMs: RESUME_SOFT_WRAP_MS, hardCapMs: RESUME_HARD_CAP_MS };
  }
  if (setup?.durationMinutes) {
    const hardCapMs = Math.max(5, Math.min(60, setup.durationMinutes)) * 60 * 1000;
    return {
      softWrapMs: Math.max(3 * 60 * 1000, hardCapMs - PERSONALIZED_WRAP_BUFFER_MS),
      hardCapMs
    };
  }
  return { softWrapMs: SOFT_WRAP_MS, hardCapMs: HARD_CAP_MS };
}
