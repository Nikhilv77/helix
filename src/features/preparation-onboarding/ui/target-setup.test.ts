import { describe, expect, it } from "vitest";
import { initialWelcomeStep } from "./target-setup";

describe("initialWelcomeStep", () => {
  it("shows the welcome slide only before target setup has started", () => {
    expect(initialWelcomeStep("target_role")).toBe(0);
    expect(initialWelcomeStep("target_company")).toBe(1);
  });

  it("opens a resumed baseline directly on its current screen", () => {
    expect(initialWelcomeStep("baseline_intro")).toBe(1);
    expect(initialWelcomeStep("baseline_technical_1")).toBe(1);
    expect(initialWelcomeStep("completed")).toBe(1);
  });
});
