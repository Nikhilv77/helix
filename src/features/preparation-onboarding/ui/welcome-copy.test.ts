import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";
import { preparationWelcomeIntroCopy } from "./welcome-copy";

describe("preparationWelcomeIntroCopy", () => {
  it("builds one canonical line for preloading and modal playback", () => {
    const profile = {
      headline: "Backend engineer",
      resume: {
        fullName: "Asha Verma",
        skills: ["TypeScript", "Postgres"],
        experience: [{ role: "Engineer", organization: "Acme" }],
        projects: []
      }
    } as unknown as Pick<CandidateProfile, "headline" | "resume">;

    const copy = preparationWelcomeIntroCopy(profile, "Sophia");

    expect(copy.title).toBe("Hi Asha, I’m Sophia.");
    expect(copy.body).toContain("Engineer at Acme and 2 supported skills");
    expect(copy.voiceText).toBe(`${copy.title} ${copy.body}`);
  });
});
