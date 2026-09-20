import { describe, expect, it } from "vitest";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";
import {
  architectureDesignKnowledgeCheck,
  publicArchitectureDesignKnowledgeCheck
} from "./knowledge-check";

describe("Architecture Design knowledge checks", () => {
  it("builds one deterministic four-choice check for every reviewed question", () => {
    for (const artifact of ARCHITECTURE_DESIGN_REVIEW_CANDIDATES) {
      for (const question of artifact.questionBlock.questions) {
        const first = architectureDesignKnowledgeCheck(question);
        const second = architectureDesignKnowledgeCheck(question);

        expect(first).toEqual(second);
        expect(first.choices).toHaveLength(4);
        expect(new Set(first.choices)).toHaveLength(4);
        expect(first.correctChoiceIndex).toBeGreaterThanOrEqual(0);
        expect(first.correctChoiceIndex).toBeLessThan(4);
        expect(first.choices[first.correctChoiceIndex]).toBe(question.referenceAnswer.summary);
      }
    }
  });

  it("does not expose the correct index or rationale in the public check", () => {
    const question = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!.questionBlock.questions[0]!;
    const publicCheck = publicArchitectureDesignKnowledgeCheck(question);

    expect(publicCheck).toEqual({
      prompt: expect.any(String),
      choices: expect.arrayContaining([question.referenceAnswer.summary])
    });
    expect(publicCheck).not.toHaveProperty("correctChoiceIndex");
    expect(publicCheck).not.toHaveProperty("rationale");
  });
});
