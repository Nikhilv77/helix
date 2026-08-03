import {
  DecisionAction,
  ForcedReason,
  HARD_CAP_MS,
  InterviewState,
  MAX_FOLLOW_UPS,
  PlannedQuestion,
  SOFT_WRAP_MS,
  Turn
} from "./types";

/**
 * The model proposes, the machine disposes.
 *
 * `advance` takes the action the decider asked for and applies the guards on
 * top of it. Guards always win, so the model can never talk the interview past
 * its follow-up budget, its question budget, or its time cap.
 */
export interface Advance {
  state: InterviewState;
  /** The action actually taken, which may differ from the requested one. */
  action: DecisionAction;
  forcedBy: ForcedReason | null;
}

export function createState(params: {
  id: string;
  setup: InterviewState["setup"];
  plan: PlannedQuestion[];
  startedAt: number;
}): InterviewState {
  return {
    id: params.id,
    setup: params.setup,
    plan: params.plan,
    phase: "intro",
    questionIndex: 0,
    followUpCount: 0,
    startedAt: params.startedAt,
    turns: []
  };
}

export function currentQuestion(state: InterviewState): PlannedQuestion | null {
  return state.plan[state.questionIndex] ?? null;
}

export function elapsedMs(state: InterviewState, now: number): number {
  return Math.max(0, now - state.startedAt);
}

export function advance(
  state: InterviewState,
  requested: DecisionAction,
  now: number
): Advance {
  const elapsed = elapsedMs(state, now);

  if (elapsed >= HARD_CAP_MS) {
    return {
      state: { ...state, phase: "done" },
      action: "move_on",
      forcedBy: "hard-time"
    };
  }

  let action = requested;
  let forcedBy: ForcedReason | null = null;

  if (action !== "move_on" && state.followUpCount >= MAX_FOLLOW_UPS) {
    action = "move_on";
    forcedBy = "follow-up-budget";
  }

  if (action !== "move_on" && elapsed >= SOFT_WRAP_MS) {
    action = "move_on";
    forcedBy = "soft-time";
  }

  if (action !== "move_on") {
    return {
      state: { ...state, phase: "questioning", followUpCount: state.followUpCount + 1 },
      action,
      forcedBy
    };
  }

  const questionIndex = state.questionIndex + 1;
  const outOfQuestions = questionIndex >= state.plan.length;
  const outOfTime = elapsed >= SOFT_WRAP_MS;

  return {
    state: {
      ...state,
      phase: outOfQuestions || outOfTime ? "done" : "questioning",
      questionIndex,
      followUpCount: 0
    },
    action,
    forcedBy: forcedBy ?? (outOfTime ? "soft-time" : null)
  };
}

/** Moves an interview out of `intro` and into the first question. */
export function beginQuestioning(state: InterviewState): InterviewState {
  return { ...state, phase: "questioning", questionIndex: 0, followUpCount: 0 };
}

export function finish(state: InterviewState): InterviewState {
  return { ...state, phase: "done" };
}

export function appendTurn(
  state: InterviewState,
  turn: Omit<Turn, "startMs" | "endMs"> & { startMs: number; endMs: number }
): InterviewState {
  const recorded: Turn = {
    ...turn,
    startMs: Math.max(0, Math.round(turn.startMs)),
    endMs: Math.max(0, Math.round(turn.endMs))
  };

  return { ...state, turns: [...state.turns, recorded] };
}
