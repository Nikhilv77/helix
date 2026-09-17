import { describe, expect, it } from "vitest";
import {
  isCombinedDsaDesignRound,
  isDsaDesignRound,
  isDsaInterviewRound,
  isSystemDesignRound
} from "./dsa-design-round";

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

  it("separates new DSA and System Design identities while preserving legacy combined rounds", () => {
    expect(isDsaInterviewRound({ templateId: "dsa" })).toBe(true);
    expect(isSystemDesignRound({ templateId: "dsa" })).toBe(false);
    expect(isSystemDesignRound({ templateId: "system-design" })).toBe(true);
    expect(isDsaInterviewRound({ templateId: "system-design" })).toBe(false);
    expect(
      isCombinedDsaDesignRound({
        templateId: "dsa",
        dsaDesignRound: { kind: "dsa-design-round" }
      })
    ).toBe(true);
  });
});
