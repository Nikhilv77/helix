import { describe, expect, it } from "vitest";
import {
  HARD_INTERRUPT_MS,
  SOFT_INTERRUPT_MS,
  evaluateInterruption,
  hasReachedPoint
} from "./interruption";

describe("interruption watchdog", () => {
  it("stays quiet below the soft threshold", () => {
    expect(
      evaluateInterruption({ elapsedMs: SOFT_INTERRUPT_MS - 1, text: "still rambling on" })
    ).toBeNull();
  });

  it("lets an answer run when it has already landed the point", () => {
    expect(
      evaluateInterruption({
        elapsedMs: SOFT_INTERRUPT_MS + 5_000,
        text: "we ended up cutting p99 by 40%"
      })
    ).toBeNull();
  });

  it("cuts in past the soft threshold when no point has been reached", () => {
    const decision = evaluateInterruption({
      elapsedMs: SOFT_INTERRUPT_MS + 5_000,
      text: "so originally the team had this legacy setup and there was a lot of history"
    });

    expect(decision?.reason).toBe("no-point");
    expect(decision?.utterance).toContain("Let me stop you there");
  });

  it("always cuts in at the hard threshold", () => {
    const decision = evaluateInterruption({
      elapsedMs: HARD_INTERRUPT_MS,
      text: "we reduced latency so we shipped it"
    });

    expect(decision?.reason).toBe("hard-cap");
  });

  it("detects outcome markers", () => {
    expect(hasReachedPoint("we cut it by 30%")).toBe(true);
    expect(hasReachedPoint("it was a big legacy system")).toBe(false);
  });
});
