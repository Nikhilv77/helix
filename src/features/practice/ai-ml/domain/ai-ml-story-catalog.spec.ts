import { describe, expect, it } from "vitest";
import { aiMlStoryPaths } from "./ai-ml-story-catalog";

describe("AI/ML story paths", () => {
  it.each(["core-technical", "applied-engineering"] as const)(
    "provides distinct %s paths with mixed response formats and complete review evidence",
    (track) => {
      const paths = aiMlStoryPaths(track);
      const questions = paths.flatMap((path) => path.questions);

      expect(paths).toHaveLength(track === "core-technical" ? 3 : 4);
      expect(questions).toHaveLength(track === "core-technical" ? 19 : 25);
      const originalFirst = paths.find((path) => path.key !== "production-lab");
      expect(originalFirst?.questions).toHaveLength(7);
      expect(originalFirst?.questions.filter((question) => question.format === "mcq")).toHaveLength(
        1
      );
      expect(
        originalFirst?.questions.some(
          (question) => question.artifact.kind === "code" && question.artifact.language === "python"
        )
      ).toBe(true);
      expect(new Set(paths.map((path) => path.key)).size).toBe(paths.length);
      expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
      expect(questions.some((question) => question.format === "mcq")).toBe(true);
      expect(questions.some((question) => question.format !== "mcq")).toBe(true);

      for (const path of paths) {
        expect(path.questions.length).toBeGreaterThanOrEqual(2);
        for (const question of path.questions) {
          expect(question.pathKey).toBe(path.key);
          expect(question.artifact.content.length).toBeGreaterThan(20);
          expect(question.hints).toHaveLength(3);
          expect(question.answer.concise.length).toBeGreaterThan(15);
          expect(question.answer.explanation.length).toBeGreaterThan(20);
          expect(question.rubric.reduce((total, item) => total + item.points, 0)).toBe(10);
          expect(question.interviewerFollowUps.length).toBeGreaterThan(0);
          if (question.format === "mcq") {
            expect(question.choices?.length).toBeGreaterThanOrEqual(2);
            expect(question.correctChoiceIndex).toBeGreaterThanOrEqual(0);
            expect(question.correctChoiceIndex).toBeLessThan(question.choices!.length);
          }
        }
      }
    }
  );
});
