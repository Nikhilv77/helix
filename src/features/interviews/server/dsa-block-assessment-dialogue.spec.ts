import { describe, expect, it } from "vitest";
import {
  dsaBlockAssessmentMoveOnUtterance,
  dsaBlockAssessmentOpening,
  dsaBlockAssessmentReviewFeedback
} from "./dsa-block-assessment-dialogue";
import type { InterviewState, PlannedQuestion } from "./types";

const plan: PlannedQuestion[] = [
  {
    text: "Which invariant does this loop maintain?",
    kind: "mcq",
    stage: "rapid",
    mustHit: ["the invariant"],
    probeIfMissing: "Which value stays true after every iteration?"
  },
  {
    text: "What is the tightest complexity bound?",
    kind: "mcq",
    stage: "rapid",
    mustHit: ["time complexity"],
    probeIfMissing: "Count the operations in the loop."
  },
  {
    text: "Your first transfer problem is Pair Sum.",
    kind: "code",
    stage: "code",
    mustHit: ["working implementation"],
    probeIfMissing: "What invariant makes this correct?"
  },
  {
    text: "Your second transfer problem is Window Limit.",
    kind: "code",
    stage: "code",
    mustHit: ["working implementation"],
    probeIfMissing: "What happens at the left boundary?"
  }
];

function dialogueState(input: Partial<InterviewState> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    phase: "questioning",
    plan,
    questionIndex: 0,
    ...input
  } as InterviewState;
}

describe("DSA block assessment dialogue", () => {
  it("opens conversationally, explains the shape, and asks the first frozen question", () => {
    const state = dialogueState();
    const first = dsaBlockAssessmentOpening(state);
    const replay = dsaBlockAssessmentOpening(state);

    expect(replay).toBe(first);
    expect(first).toContain("2");
    expect(first).toMatch(/saved solutions|own code|saved submission/i);
    expect(first).toContain(plan[0]!.text);
    expect(first).not.toContain("I'm Maya");
  });

  it("varies greetings between sessions while remaining stable within a session", () => {
    const openings = new Set(
      Array.from({ length: 12 }, (_, index) =>
        dsaBlockAssessmentOpening(
          dialogueState({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}` })
        )
      )
    );

    expect(openings.size).toBeGreaterThan(1);
  });

  it("adds a human handoff when the assessment moves from review to live coding", () => {
    const utterance = dsaBlockAssessmentMoveOnUtterance(
      dialogueState({ questionIndex: 2 }),
      "That’s what the run recorded."
    );

    expect(utterance).toContain("That’s what the run recorded.");
    expect(utterance).toMatch(/review|saved code|something new/i);
    expect(utterance).toContain(plan[2]!.text);
  });

  it("returns the secure correct answer only after an incorrect review response", () => {
    const feedback = dsaBlockAssessmentReviewFeedback({
      sessionId: dialogueState().id,
      questionIndex: 0,
      correct: false,
      correctAnswer: "O(n)",
      explanation: "The loop visits each element once."
    });

    expect(feedback).toContain("O(n)");
    expect(feedback).toContain("The loop visits each element once.");
  });
});
