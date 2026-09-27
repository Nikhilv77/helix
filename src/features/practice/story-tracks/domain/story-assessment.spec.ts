import { describe, expect, it } from "vitest";
import { STORY_DISCIPLINES, storyDiscipline, storyDisciplinePaths } from "./story-disciplines";
import { buildStoryAssessmentSnapshot, type StoryPathQuestionState } from "./story-assessment";

const TRACKS = ["core-technical", "applied-engineering"] as const;

function allPaths() {
  return STORY_DISCIPLINES.flatMap((discipline) =>
    TRACKS.flatMap((track) => storyDisciplinePaths(discipline, track))
  );
}

describe("buildStoryAssessmentSnapshot", () => {
  it("mixes quick multiple-choice checks with short written answers on every path", () => {
    for (const path of allPaths()) {
      const snapshot = buildStoryAssessmentSnapshot(path, []);
      const ids = snapshot.prompts.map((prompt) => prompt.id);
      expect(ids).toContain("explain");
      expect(ids).toContain("follow-up");
      expect(ids).toContain("trap");
      if (path.questions.some((question) => question.format === "mcq")) {
        expect(ids[0]).toBe("quick-check");
      }
      for (const prompt of snapshot.prompts) {
        expect(prompt.rubric.reduce((total, item) => total + item.points, 0)).toBe(10);
        if (prompt.choices) {
          expect(prompt.choices[prompt.correctIndex!]).toBeTruthy();
        }
      }
    }
  });

  it("builds the trap from one scenario the other prompts do not use", () => {
    for (const path of allPaths()) {
      const snapshot = buildStoryAssessmentSnapshot(path, []);
      const trap = snapshot.prompts.find((prompt) => prompt.id === "trap")!;
      const source = path.questions.find((question) => question.id === trap.sourceQuestionId)!;
      const otherSources = snapshot.prompts
        .filter((prompt) => prompt.id !== "trap")
        .map((prompt) => prompt.sourceQuestionId);

      expect(otherSources).not.toContain(source.id);
      // Both options are about the scenario shown beside them.
      expect(trap.sourcePrompt).toBe(source.prompt);
      expect(trap.choices).toHaveLength(2);
      expect(trap.choices).toContain(source.answer.concise);
      expect(trap.choices![trap.correctIndex!]).toBe(source.commonMistakes[0]);
    }
  });

  it("explains the weakest open question and prefers it over a predict-the-output one", () => {
    const path = storyDiscipline("frontend").paths("core-technical")[0]!;
    const states: StoryPathQuestionState[] = path.questions.map((question) => ({
      questionKey: question.id,
      status: "COMPLETED",
      score: question.format === "artifact-diagnosis" ? 2 : 9
    }));
    const explain = buildStoryAssessmentSnapshot(path, states).prompts.find(
      (prompt) => prompt.id === "explain"
    )!;
    expect(
      path.questions.find((question) => question.id === explain.sourceQuestionId)!.format
    ).toBe("artifact-diagnosis");
    expect(explain.prompt).toContain("A few sentences is enough.");

    // With no scores yet, a diagnosis question is still chosen before "predict the output".
    const fresh = buildStoryAssessmentSnapshot(path, []).prompts.find(
      (prompt) => prompt.id === "explain"
    )!;
    expect(
      path.questions.find((question) => question.id === fresh.sourceQuestionId)!.format
    ).not.toBe("predict-explain");
  });

  it("treats a revealed answer as the weakest result", () => {
    const path = storyDiscipline("data").paths("applied-engineering")[0]!;
    const learned = path.questions.find((question) => question.format !== "mcq")!;
    const states: StoryPathQuestionState[] = path.questions.map((question) => ({
      questionKey: question.id,
      status: question.id === learned.id ? "LEARNED" : "COMPLETED",
      score: question.id === learned.id ? null : 6
    }));

    const explain = buildStoryAssessmentSnapshot(path, states).prompts.find(
      (prompt) => prompt.id === "explain"
    )!;
    expect(explain.sourceQuestionId).toBe(learned.id);
  });

  it("never re-asks an ordering question as a written prompt", () => {
    for (const path of allPaths()) {
      const explain = buildStoryAssessmentSnapshot(path, []).prompts.find(
        (prompt) => prompt.id === "explain"
      )!;
      const source = path.questions.find((question) => question.id === explain.sourceQuestionId)!;
      if (path.questions.some((question) => question.format !== "mcq" && !question.interaction)) {
        expect(source.interaction).toBeUndefined();
      }
    }
  });
});
