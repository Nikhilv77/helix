import { describe, expect, it } from "vitest";

import { estimateCost, priceFor } from "./provider-pricing";

describe("provider pricing", () => {
  it("prices Gemini Flash-Lite before the broader Flash rule", () => {
    expect(priceFor("gemini", "gemini-flash-lite-latest")?.inputPerMillion).toBe(0.1);
    expect(priceFor("gemini", "gemini-flash-latest")?.inputPerMillion).toBe(0.3);
  });

  it("adds tokens, characters, and run time into one estimate", () => {
    expect(
      estimateCost({ provider: "gemini", model: "gemini-flash-latest", inputTokens: 1_000_000, outputTokens: 1_000_000, units: 0, durationMs: 0 })
    ).toBeCloseTo(2.8);
    expect(
      estimateCost({ provider: "deepgram", model: "aura-asteria-en", inputTokens: 0, outputTokens: 0, units: 2_000, durationMs: 0 })
    ).toBeCloseTo(0.03);
    expect(
      estimateCost({ provider: "vercel-sandbox", model: "node22-1vcpu", inputTokens: 0, outputTokens: 0, units: 1, durationMs: 3_600_000 })
    ).toBeCloseTo(0.15);
  });

  it("treats unknown services as free rather than guessing", () => {
    expect(estimateCost({ provider: "other", model: "x", inputTokens: 5, outputTokens: 5, units: 5, durationMs: 5 })).toBe(0);
  });
});
