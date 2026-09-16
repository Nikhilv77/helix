import { describe, expect, it } from "vitest";
import { DSA_DESIGN_STAGES } from "./dsa-design-conversation-workspace";

describe("DSA & Design conversation workspace", () => {
  it("presents the three candidate-facing design acts in order", () => {
    expect(DSA_DESIGN_STAGES).toEqual([
      { id: "rapid", label: "Frame", caption: "Requirements and scale" },
      { id: "explain", label: "Design", caption: "Contracts and architecture" },
      { id: "scenario", label: "Defend", caption: "Reliability and evolution" }
    ]);
  });
});
