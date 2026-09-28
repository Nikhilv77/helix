import { describe, expect, it } from "vitest";
import { learnerNextStep } from "./learner-next-step";

describe("learnerNextStep", () => {
  it.each([
    ["Failed to provide a career story or employment history", "Next time, provide a career story or employment history."],
    ["Did not identify the root cause.", "Next time, identify the root cause."],
    ["Candidate fails to identify first evidence to inspect, does not diagnose likely failure", "Next time, identify first evidence to inspect."],
    ["Missing explicit time and space complexity analysis", "Next time, add explicit time and space complexity analysis."],
    ["No discussion of edge cases or constraints", "Next time, discuss edge cases or constraints."],
    ["No explicit complexity analysis provided", "Next time, include explicit complexity analysis."],
    ["No solution evidence was submitted for this coding problem.", "Next time, submit a solution."],
    ["Provides an irrelevant answer regarding container liveness probes", "Next time, answer the question that was asked."],
    ["ownership", "Make your personal contribution explicit."],
    ["problem and constraints missing", "Restate the problem and its constraints before you start."],
    ["Review the underlying concept and the authored correct option.", "Review the underlying concept and the authored correct option."],
    ["Work on this next: Failed to explain the causal chain", "Next time, explain the causal chain."]
  ])("%s", (gap, step) => {
    expect(learnerNextStep(gap)).toBe(step);
  });

  it("frames an unrecognised note as something to revisit, keeping names intact", () => {
    expect(learnerNextStep("Implementation is in Java, not JavaScript as required")).toBe(
      "Next time, go back over this: implementation is in Java, not JavaScript as required."
    );
    expect(learnerNextStep("CDN keys were not versioned")).toBe(
      "Next time, go back over this: CDN keys were not versioned."
    );
  });

  it("never returns assessor verdict wording", () => {
    for (const gap of ["Failed to trace the flow", "Did not mention scope", "Lacked concrete examples"]) {
      expect(learnerNextStep(gap)).not.toMatch(/failed|did not|lacked/i);
    }
  });
});
