import { describe, expect, it, vi } from "vitest";
import {
  assertStoryPracticeAssessmentResponses,
  storyPracticeAssessmentStartDisposition
} from "./assessment-orchestrator";
import {
  assertStoryPracticeHintOrder,
  assertStoryPracticeWorkMatchesQuestion,
  storyPracticeFingerprint
} from "./practice-orchestrator";
import { resolveStoryPracticePreparationReplay } from "./preparation-orchestrator";

describe("story-practice orchestration invariants", () => {
  it("fingerprints equivalent snapshots deterministically", () => {
    expect(storyPracticeFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      storyPracticeFingerprint({ a: { c: 3, d: 4 }, b: 2 })
    );
  });

  it("enforces work, hint, and assessment rules without domain types", () => {
    const errors = {
      format: () => new Error("format"),
      choice: () => new Error("choice")
    };
    expect(() =>
      assertStoryPracticeWorkMatchesQuestion(
        { format: "written" },
        { kind: "code", code: "design" },
        errors,
        new Set()
      )
    ).toThrow("format");
    expect(() => assertStoryPracticeHintOrder(1, 3, () => new Error("order"))).toThrow("order");
    expect(() =>
      assertStoryPracticeAssessmentResponses(
        ["one", "two"],
        [{ promptId: "one" }, { promptId: "one" }],
        () => new Error("responses")
      )
    ).toThrow("responses");
    expect(
      storyPracticeAssessmentStartDisposition({
        status: "LOCKED",
        isCurrent: true,
        allowLocked: true,
        historical: () => new Error("historical"),
        locked: () => new Error("locked")
      })
    ).toBe("start-early");
  });

  it("replays a successful preparation without publishing again", async () => {
    const current = vi.fn().mockResolvedValue({ id: "block-1" });
    await expect(
      resolveStoryPracticePreparationReplay({
        existing: {
          status: "SUCCEEDED",
          focusRevisionId: "focus-1",
          blockId: "block-1"
        },
        focusRevisionId: "focus-1",
        succeededStatus: "SUCCEEDED",
        inProgressStatus: "IN_PROGRESS",
        current,
        requestConflict: () => new Error("conflict"),
        inProgress: () => new Error("progress")
      })
    ).resolves.toEqual({ replayed: true, block: { id: "block-1" } });
    expect(current).toHaveBeenCalledOnce();
  });
});
