export type Role = "backend" | "frontend" | "fullstack" | "data" | "ai-ml" | "pm";
export type Level = "fresher" | "0-2" | "3-5" | "5-plus";
export type RoundType = "behavioral" | "technical" | "hiring-manager";
export type Intensity = "friendly" | "realistic" | "brutal";

export interface InterviewSetup {
  role: Role;
  level: Level;
  roundType: RoundType;
  intensity: Intensity;
  context: string;
}

export type Phase = "intro" | "questioning" | "wrap" | "done";
export type Speaker = "agent" | "user";
export type DecisionAction = "probe" | "challenge" | "move_on";
export type MissingDimension = "structure" | "specificity" | "ownership" | "outcome" | "none";
export type ForcedReason = "follow-up-budget" | "soft-time" | "hard-time";

export type TurnAction = DecisionAction | "interrupt" | "intro";

/** Timestamps are milliseconds from session start. */
export interface Turn {
  speaker: Speaker;
  text: string;
  startMs: number;
  endMs: number;
  /** Display metadata on agent turns, so a reload renders the same annotations. */
  action?: TurnAction;
  forcedBy?: ForcedReason | null;
  questionIndex?: number;
}

export interface StartResponse {
  sessionId: string;
  phase: Phase;
  questionCount: number;
  questionIndex: number;
  startedAt: number;
  utterance: string;
}

export interface DecideResponse {
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

export interface SessionResponse {
  sessionId: string;
  phase: Phase;
  questionIndex: number;
  questionCount: number;
  followUpCount: number;
  startedAt: number;
  setup: InterviewSetup;
  turns: Turn[];
}

export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  meta: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
  path?: string;
}
