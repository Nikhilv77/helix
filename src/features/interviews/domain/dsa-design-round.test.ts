import { describe, expect, it } from "vitest";
import { isDsaDesignRound } from "./dsa-design-round";

describe("isDsaDesignRound", () => {
  it.each([
    { templateId: "dsa" },
    { templateTitle: "DSA practice interview" },
    { templateTitle: "DSA & Design interview" },
    { dsaQuestionSlugs: ["two-sum"] },
    {
      dsaDesignRound: {
        kind: "dsa-design-round" as const
      }
    }
  ])("recognises legacy and combined round identities", (setup) => {
    expect(isDsaDesignRound(setup)).toBe(true);
  });

  it("does not classify unrelated technical interviews as DSA & Design", () => {
    expect(isDsaDesignRound({ templateId: "resume-behavioral-defense" })).toBe(false);
    expect(isDsaDesignRound(null)).toBe(false);
  });
});
