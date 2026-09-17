import { describe, expect, it } from "vitest";
import { dsaDesignMoveOnUtterance } from "./dsa-design-dialogue";
import type { InterviewState, PlannedQuestion } from "./types";

const question = (
  text: string,
  interviewSection: "dsa" | "design",
  stage: PlannedQuestion["stage"]
): PlannedQuestion => ({
  text,
  interviewSection,
  stage,
  kind: interviewSection === "dsa" ? "code" : "conversation",
  intent: "Assess the answer",
  mustHit: ["evidence"],
  probeIfMissing: "Be specific.",
  maxFollowUps: 1
});

const plan = [
  question("Solve one.", "dsa", "code"),
  question("Solve two.", "dsa", "code"),
  question("Frame the system.", "design", "design-frame"),
  question("Design it.", "design", "design-canvas"),
  question("Deep dive.", "design", "design-deep-dive"),
  question("Pressure test.", "design", "design-pressure"),
  question("Defend it.", "design", "design-defend")
];

function state(
  questionIndex: number,
  phase: InterviewState["phase"] = "questioning",
  statePlan: PlannedQuestion[] = plan
): Pick<InterviewState, "plan" | "questionIndex" | "phase" | "turns"> {
  return { plan: statePlan, questionIndex, phase, turns: [] };
}

describe("dsaDesignMoveOnUtterance", () => {
  it("guides the candidate into the second editor problem", () => {
    const line = dsaDesignMoveOnUtterance(state(1), "Good reasoning.");
    expect(line).toContain("second coding problem");
    expect(line).toContain("run or submit");
  });

  it("announces the transition from coding to design", () => {
    const line = dsaDesignMoveOnUtterance(state(2), "All right.");
    expect(line).toContain("closes the coding portion");
    expect(line).toContain("Frame the system.");
  });

  it("uses distinct candidate-led design transitions", () => {
    expect(dsaDesignMoveOnUtterance(state(3), "")).toContain(
      "carry the requirements you established into the architecture"
    );
    expect(dsaDesignMoveOnUtterance(state(4), "")).toContain("most stateful boundary");
    expect(dsaDesignMoveOnUtterance(state(5), "")).toContain("pressure-test your design");
    expect(dsaDesignMoveOnUtterance(state(6), "")).toContain("remaining risks explicit");
  });

  it("selects a deep-dive boundary from the candidate's architecture", () => {
    const designState = state(4);
    designState.turns = [
      {
        speaker: "user",
        text: "The client uploads to object storage, then a queue fans work out to processors.",
        startMs: 1,
        endMs: 2,
        questionIndex: 3
      }
    ];

    expect(dsaDesignMoveOnUtterance(designState, "")).toContain("object-storage boundary");
  });

  it("ends with a report handoff", () => {
    expect(dsaDesignMoveOnUtterance(state(7, "done"), "Thanks.")).toContain(
      "report will be ready shortly"
    );
  });

  it("closes separate DSA and System Design interviews without crossing rounds", () => {
    const dsaClose = dsaDesignMoveOnUtterance(state(2, "done", plan.slice(0, 2)), "Thanks.");
    const designClose = dsaDesignMoveOnUtterance(state(5, "done", plan.slice(2)), "Thanks.");

    expect(dsaClose).toContain("completes the DSA interview");
    expect(dsaClose).not.toContain("design round");
    expect(designClose).toContain("completes the System Design interview");
    expect(designClose).not.toContain("DSA and design");
  });
});
