import { beforeEach, describe, expect, it } from "vitest";

import { hintsUsedFor, recordHintsUsed, resetHintTracker } from "./hint-tracker";

describe("hint tracker", () => {
  beforeEach(() => resetHintTracker());

  it("reports zero for a question nobody has asked about", () => {
    // The coach may never have been mounted; a help request still has to send
    // a number, and zero is the honest one.
    expect(hintsUsedFor("two-sum")).toBe(0);
  });

  it("reports what the coach last published", () => {
    recordHintsUsed("two-sum", 3);
    expect(hintsUsedFor("two-sum")).toBe(3);
  });

  it("keeps questions separate", () => {
    recordHintsUsed("two-sum", 3);
    recordHintsUsed("lru-cache", 1);

    expect(hintsUsedFor("two-sum")).toBe(3);
    expect(hintsUsedFor("lru-cache")).toBe(1);
  });

  it("overwrites rather than accumulating", () => {
    // The coach publishes the running total, not a delta. Adding would double
    // count every re-render.
    recordHintsUsed("two-sum", 1);
    recordHintsUsed("two-sum", 2);

    expect(hintsUsedFor("two-sum")).toBe(2);
  });
});
