import { describe, expect, it } from "vitest";
import { boundedReason, targetJobTitle } from "./selection-reason";

describe("targetJobTitle", () => {
  it("keeps only the title from an onboarding description", () => {
    expect(
      targetJobTitle(
        "Backend Engineer with 3.5 years of experience building scalable APIs and distributed services using Go, PostgreSQL, Redis and Kafka."
      )
    ).toBe("Backend Engineer");
    expect(targetJobTitle("Senior Platform Engineer at Stripe")).toBe("Senior Platform Engineer");
    expect(targetJobTitle("Full-stack Engineer")).toBe("Full-stack Engineer");
  });

  it("caps a long title without commas or connectors on a whole word", () => {
    const title = targetJobTitle("Principal Distributed Systems Reliability Infrastructure Performance Engineer Lead");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith(" ")).toBe(false);
  });
});

describe("boundedReason", () => {
  it("returns short reasons unchanged and trims long ones to the limit", () => {
    expect(boundedReason("We chose this path because it fits.", 320)).toBe(
      "We chose this path because it fits."
    );
    const long = boundedReason("word ".repeat(100), 320);
    expect(long.length).toBeLessThanOrEqual(320);
    expect(long.endsWith("…")).toBe(true);
  });
});
