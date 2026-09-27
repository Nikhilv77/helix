import { describe, expect, it } from "vitest";
import { buildRecallQuiz, type RecallQuizSource } from "./recall-quiz";

function source(order: number, overrides: Partial<RecallQuizSource> = {}): RecallQuizSource {
  return {
    id: `q${order}`,
    order,
    prompt: `Practice prompt ${order}.`,
    concise: `Answer ${order}.`,
    explanation: `Because ${order}. More detail. Even more.`,
    ...overrides
  };
}

describe("buildRecallQuiz", () => {
  it("never uses a practice question an assessment prompt is graded against", () => {
    const sources = [1, 2, 3, 4, 5].map((order) => source(order));
    const quiz = buildRecallQuiz(sources, new Set(["q1", "q2"]));

    expect(quiz.map((item) => item.id)).toEqual(["q3", "q4", "q5"]);
    const shown = quiz.flatMap((item) => [item.prompt, ...item.choices]).join(" ");
    expect(shown).not.toContain("Answer 1.");
    expect(shown).not.toContain("Answer 2.");
  });

  it("keeps a multiple-choice question's own options and answer", () => {
    const quiz = buildRecallQuiz(
      [
        source(1, { choices: ["Wrong", "Right", "Also wrong"], correctChoiceIndex: 1 }),
        source(2),
        source(3),
        source(4)
      ],
      new Set()
    );

    expect(quiz[0]).toMatchObject({
      prompt: "Practice prompt 1.",
      choices: ["Wrong", "Right", "Also wrong"],
      correctIndex: 1,
      explanation: "Because 1. More detail.",
      source: "Practice question 1"
    });
  });

  it("marks the question's own answer correct among answers to other questions", () => {
    const quiz = buildRecallQuiz([1, 2, 3].map((order) => source(order)), new Set());

    for (const item of quiz) {
      expect(item.choices).toHaveLength(3);
      expect(item.choices[item.correctIndex]).toBe(`Answer ${item.id.slice(1)}.`);
    }
  });

  it("returns nothing when too little finished practice is left to quiz", () => {
    expect(buildRecallQuiz([1, 2, 3].map((order) => source(order)), new Set(["q1"]))).toEqual([]);
  });
});
