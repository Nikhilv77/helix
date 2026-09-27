import { describe, expect, it } from "vitest";
import type { Turn } from "@/lib/shared/types";
import { practiceAssessmentMoment } from "./assessment-speech";

const agent = (action: Turn["action"]): Turn => ({
  speaker: "agent",
  text: "Full guidance on screen.",
  startMs: 0,
  endMs: 0,
  action
});
const written = { done: false, kind: "conversation" as const };

describe("practice assessment speech", () => {
  it("uses short lines for the opening, moving on, and the finish", () => {
    expect(practiceAssessmentMoment(agent("intro"), written)).toBe("opening");
    expect(practiceAssessmentMoment(agent("move_on"), written)).toBe("nextQuestion");
    expect(practiceAssessmentMoment(agent("move_on"), { done: false, kind: "code" })).toBe(
      "nextCode"
    );
    expect(practiceAssessmentMoment(agent("move_on"), { done: true, kind: null })).toBe("done");
  });

  it("reads a follow-up question in full", () => {
    expect(practiceAssessmentMoment(agent("probe"), written)).toBeNull();
    expect(practiceAssessmentMoment(agent("respond"), written)).toBeNull();
  });
});
