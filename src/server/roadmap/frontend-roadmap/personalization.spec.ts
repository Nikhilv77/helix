import { buildPersonalization } from "./personalization";

describe("buildPersonalization", () => {
  it("uses onboarding evidence to tailor an early-career full-stack roadmap", () => {
    const personalization = buildPersonalization({
      level: "0-2",
      focusAreas: ["React component ownership", "Accessibility"],
      stories: [{ title: "Shipped the dashboard" }],
      resumeAnalysis: {
        skills: ["TypeScript", "Next.js", "Tailwind CSS"],
        headline: "Frontend engineer"
      },
      resumeFileName: "nikhil-resume.pdf",
      resumeConfidence: 0.92
    });

    expect(personalization).toMatchObject({
      targetRole: "fullstack",
      levelStrategy: "fundamentals-first-with-guided-warmups",
      resumeSignal: "fullstack-evidence-found",
      storyCount: 1,
      resume: { fileName: "nikhil-resume.pdf", confidence: 0.92 }
    });
    expect(personalization.matchedFrontendEvidence).toEqual(
      expect.arrayContaining(["react", "next", "typescript", "accessibility", "tailwind"])
    );
  });

  it("marks missing frontend evidence as an evidence-building opportunity", () => {
    const personalization = buildPersonalization({
      level: "fresher",
      focusAreas: [],
      stories: [],
      resumeAnalysis: null,
      resumeFileName: null,
      resumeConfidence: null
    });

    expect(personalization.resumeSignal).toBe("evidence-building-needed");
    expect(personalization.matchedFrontendEvidence).toEqual([]);
  });
});
