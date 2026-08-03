import { advance, appendTurn, createState, currentQuestion } from "./state-machine";
import { HARD_CAP_MS, InterviewSetup, PlannedQuestion, SOFT_WRAP_MS } from "./types";

const setup: InterviewSetup = {
  role: "backend",
  level: "3-5",
  roundType: "behavioral",
  intensity: "realistic",
  context: "Rebuilt a payments retry pipeline."
};

function question(text: string): PlannedQuestion {
  return { text, mustHit: ["how", "outcome"], probeIfMissing: `How, specifically, for ${text}?` };
}

function stateWith(overrides: Partial<ReturnType<typeof createState>> = {}) {
  const base = createState({
    id: "11111111-1111-4111-8111-111111111111",
    setup,
    plan: [question("Q1"), question("Q2"), question("Q3"), question("Q4")],
    startedAt: 0
  });

  return { ...base, phase: "questioning" as const, ...overrides };
}

describe("interview state machine", () => {
  it("counts probes and challenges against one shared budget", () => {
    const first = advance(stateWith(), "probe", 1000);
    expect(first.action).toBe("probe");
    expect(first.state.followUpCount).toBe(1);

    const second = advance(first.state, "challenge", 2000);
    expect(second.action).toBe("challenge");
    expect(second.state.followUpCount).toBe(2);
  });

  it("forces move_on once the follow-up budget is spent", () => {
    const spent = stateWith({ followUpCount: 2 });
    const result = advance(spent, "probe", 3000);

    expect(result.action).toBe("move_on");
    expect(result.forcedBy).toBe("follow-up-budget");
    expect(result.state.questionIndex).toBe(1);
    expect(result.state.followUpCount).toBe(0);
  });

  it("moves to wrap after the last question", () => {
    const last = stateWith({ questionIndex: 3 });
    const result = advance(last, "move_on", 4000);

    expect(result.state.phase).toBe("wrap");
    expect(currentQuestion(result.state)).toBeNull();
  });

  it("wraps early once past the soft time limit", () => {
    const result = advance(stateWith(), "probe", SOFT_WRAP_MS + 1);

    expect(result.action).toBe("move_on");
    expect(result.forcedBy).toBe("soft-time");
    expect(result.state.phase).toBe("wrap");
  });

  it("ends the session at the hard cap regardless of the requested action", () => {
    const result = advance(stateWith(), "probe", HARD_CAP_MS + 1);

    expect(result.state.phase).toBe("done");
    expect(result.forcedBy).toBe("hard-time");
  });

  it("records turns with rounded millisecond offsets", () => {
    const withTurn = appendTurn(stateWith(), {
      speaker: "user",
      text: "We used idempotency keys.",
      startMs: 1200.6,
      endMs: 4800.2
    });

    expect(withTurn.turns).toEqual([
      { speaker: "user", text: "We used idempotency keys.", startMs: 1201, endMs: 4800 }
    ]);
  });
});
