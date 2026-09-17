import { describe, expect, it } from "vitest";
import { DSA_DESIGN_STAGES } from "./dsa-design-conversation-workspace";

describe("DSA & Design conversation workspace", () => {
  it("presents the five candidate-facing design acts in order", () => {
    expect(DSA_DESIGN_STAGES).toEqual([
      {
        id: "design-frame",
        label: "Frame",
        caption: "Discover requirements",
        stageIds: ["design-frame", "rapid"]
      },
      {
        id: "design-canvas",
        label: "Design",
        caption: "Build the architecture",
        stageIds: ["design-canvas", "explain"]
      },
      { id: "design-deep-dive", label: "Deep dive", caption: "Trace one boundary" },
      { id: "design-pressure", label: "Pressure test", caption: "Adapt to change" },
      {
        id: "design-defend",
        label: "Defend",
        caption: "Trade-offs and risks",
        stageIds: ["design-defend", "scenario"]
      }
    ]);
  });
});
