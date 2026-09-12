import { describe, expect, it } from "vitest";
import {
  coreTechnicalAssessmentMoveOnUtterance,
  coreTechnicalAssessmentOpening
} from "./core-technical-assessment-dialogue";
import {
  storyPracticeAssessmentDialogue,
  storyPracticeAssessmentOpening
} from "./story-practice-assessment-dialogue";

describe("Core Technical assessment dialogue", () => {
  it("opens as a spoken, teaching-led five-prompt assessment", () => {
    const text = coreTechnicalAssessmentOpening(state());
    expect(text).toContain("five focused prompts");
    expect(text).toContain("Why does this closure retain state?");
    expect(text).toMatch(/teach|tighten|carry forward/i);
  });

  it("teaches from the saved technical evaluation before the next prompt", () => {
    const text = coreTechnicalAssessmentMoveOnUtterance(
      {
        ...state(),
        questionIndex: 1,
        questionEvaluations: {
          "0": {
            source: "semantic-evaluator",
            score: 72,
            verdict: "mostly-correct",
            confidence: 0.9,
            summary: "The closure keeps a reference to its lexical environment.",
            strengths: ["Connected reachability to retained state."],
            gaps: ["Name the cleanup boundary."],
            rubricScores: [],
            answerExcerpts: [],
            execution: null,
            evaluatedAt: 1
          }
        }
      },
      "That gives me the mechanism."
    );
    expect(text).toContain("point to carry forward");
    expect(text).toContain("cleanup boundary");
    expect(text).toContain("How would you diagnose it?");
  });

  it("uses production-specific language for Applied Engineering without forking the room", () => {
    const text = storyPracticeAssessmentOpening(
      state(),
      storyPracticeAssessmentDialogue("applied-engineering")
    );

    expect(text).toContain("five focused prompts");
    expect(text).toMatch(/production signal|engineer on call|safe repair/i);
    expect(text).toContain("Why does this closure retain state?");
  });

  it("uses design-specific language for Architecture without forking the room", () => {
    const text = storyPracticeAssessmentOpening(
      state(),
      storyPracticeAssessmentDialogue("architecture-design")
    );

    expect(text).toContain("five focused prompts");
    expect(text).toMatch(/requirements and scale|architecture|trade-off/i);
    expect(text).toContain("Why does this closure retain state?");
  });
});

function state() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    phase: "questioning" as const,
    questionIndex: 0,
    plan: [
      {
        text: "Why does this closure retain state?",
        mustHit: ["mechanism"],
        probeIfMissing: "Which reference remains reachable?"
      },
      {
        text: "How would you diagnose it?",
        mustHit: ["evidence"],
        probeIfMissing: "Which signal distinguishes the cause?"
      }
    ]
  };
}
