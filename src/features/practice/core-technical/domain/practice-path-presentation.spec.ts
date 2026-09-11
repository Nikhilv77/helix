import { describe, expect, it } from "vitest";
import operationFailsHalfwayArtifact from "./generated/operation-fails-halfway-standard-benchmark.json";
import { selectedStorySchema } from "./story-contracts";
import {
  coreTechnicalPracticeQuestionPrompt,
  coreTechnicalPracticePathPresentation,
  coreTechnicalPracticePathReason,
  coreTechnicalPracticePathTitle
} from "./practice-path-presentation";
import { coreTechnicalPracticePathBlueprint } from "./practice-path-blueprints";

describe("Core Technical practice-path presentation", () => {
  it("turns the legacy failure story into a concrete candidate task", () => {
    const stored = selectedStorySchema.parse(operationFailsHalfwayArtifact.story);
    const presented = coreTechnicalPracticePathPresentation(stored);

    expect(presented.title).toBe("Fix failures in a Node.js request pipeline");
    expect(presented.incident).toContain("database");
    expect(presented.incident).toContain("Use the supplied code, logs, and constraints");
    expect(presented.title).not.toContain("operation fails halfway");
    expect(presented.stages[0]?.title).toBe("Fix a CommonJS and ESM import error");
  });

  it("rewrites legacy selection copy without changing live task-led titles", () => {
    expect(
      coreTechnicalPracticePathReason(
        "We chose The operation fails halfway because it fits this story.",
        "the-operation-fails-halfway",
        "The operation fails halfway"
      )
    ).toBe(
      "We chose Fix failures in a Node.js request pipeline because it fits this practice path."
    );
    expect(
      coreTechnicalPracticePathTitle("fix-a-slow-database-request", "Fix a slow database request")
    ).toBe("Fix a slow database request");
  });

  it("turns legacy fallback prompts into direct interview questions", () => {
    const prompt = coreTechnicalPracticeQuestionPrompt({
      questionKey: "async-error-propagation-repair-candidate-two",
      prompt: "Legacy incident copy"
    });

    expect(prompt).toContain("database work");
    expect(prompt).toContain("how you would rewrite");
    expect(prompt).not.toContain("ingestion");
  });

  it("uses six questions for new paths while retaining version-one eight-question snapshots", () => {
    expect(
      coreTechnicalPracticePathBlueprint("javascript-values-copying-mutation")?.stages
    ).toHaveLength(6);
    expect(
      coreTechnicalPracticePathBlueprint("javascript-values-copying-mutation", 1)?.stages
    ).toHaveLength(8);
  });
});
