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
  question("Frame the system.", "design", "rapid"),
  question("Design it.", "design", "explain"),
  question("Defend it.", "design", "scenario")
];

function state(questionIndex: number, phase: InterviewState["phase"] = "questioning") {
  return { plan, questionIndex, phase };
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

  it("uses distinct design and defend transitions", () => {
    expect(dsaDesignMoveOnUtterance(state(3), "")).toContain(
      "carry those constraints into the architecture"
    );
    expect(dsaDesignMoveOnUtterance(state(4), "")).toContain("pressure-test that architecture");
  });

  it("ends with a report handoff", () => {
    expect(dsaDesignMoveOnUtterance(state(5, "done"), "Thanks.")).toContain(
      "report will be ready shortly"
    );
  });
});
