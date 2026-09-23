import { describe, expect, it } from "vitest";
import { AI_ML_PRACTICE_TRACKS, aiMlPracticeSession } from "./ai-ml-practice";

describe("AI/ML practice sessions", () => {
  it("routes three AI/ML practice tracks without a DSA track", () => {
    expect(AI_ML_PRACTICE_TRACKS).toEqual([
      "core-technical",
      "applied-engineering",
      "architecture-design"
    ]);
    expect(AI_ML_PRACTICE_TRACKS).not.toContain("dsa");
  });

  it.each([
    ["core-technical", 8],
    ["applied-engineering", 8]
  ] as const)("builds %s from the authored AI/ML bank", (track, count) => {
    const session = aiMlPracticeSession(track);
    expect(session.questions).toHaveLength(count);
    expect(session.questions.every((question) => question.options.length >= 3)).toBe(true);
    expect(
      session.questions.every((question) =>
        question.options.some((option) => option.id === question.correctOptionId)
      )
    ).toBe(true);
    expect(new Set(session.questions.map((question) => question.explanation)).size).toBe(count);
    expect(session.questions.every((question) => question.explanation.length >= 90)).toBe(true);
  });
});
