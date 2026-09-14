import { describe, expect, it } from "vitest";
import { stageCounts } from "./interview-question-panel";

describe("stageCounts", () => {
  it("does not present pacing-skipped questions as completed", () => {
    expect(
      stageCounts(
        ["career", "current-role", "project", "project", "project", "behavioral"],
        5,
        [3, 4]
      )
    ).toEqual({
      career: { total: 1, done: 1 },
      "current-role": { total: 1, done: 1 },
      project: { total: 1, done: 1 },
      behavioral: { total: 1, done: 0 }
    });
  });
});
