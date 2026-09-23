import { describe, expect, it } from "vitest";
import { aiMlQuickCheckPath } from "./ai-ml-quick-check-catalog";

describe("AI/ML evidence-based quick checks", () => {
  it.each(["core-technical", "applied-engineering"] as const)(
    "gives %s eight distinct cases with written work and code evidence",
    (track) => {
      const path = aiMlQuickCheckPath(track);
      expect(path.questions).toHaveLength(8);
      expect(path.questions.filter(({ format }) => format === "mcq")).toHaveLength(2);
      expect(new Set(path.questions.map(({ prompt }) => prompt)).size).toBe(8);
      expect(new Set(path.questions.map(({ artifact }) => artifact.content)).size).toBe(8);
      expect(
        path.questions.some(
          ({ artifact }) => artifact.kind === "code" && artifact.language === "python"
        )
      ).toBe(true);
      for (const question of path.questions) {
        expect(question.artifact.content).not.toBe(question.prompt);
        expect(question.artifact.content.length).toBeGreaterThan(100);
        expect(question.hints).toHaveLength(3);
        expect(question.rubric.reduce((points, item) => points + item.points, 0)).toBe(10);
      }
    }
  );
});
