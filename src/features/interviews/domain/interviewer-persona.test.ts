import { describe, expect, it } from "vitest";

import { geminiVoiceForInterviewer, interviewerPersonaIdForSetup } from "./interviewer-persona";

describe("interviewerPersonaIdForSetup", () => {
  it("keeps the reserved live voices stable", () => {
    expect(geminiVoiceForInterviewer("james")).toBe("Charon");
    expect(geminiVoiceForInterviewer("claire")).toBe("Kore");
  });

  it.each([
    { templateTitle: "DSA practice interview" },
    { dsaQuestionSlugs: ["two-sum"] },
    { dsaBlockAssessment: { kind: "dsa-block-assessment" } },
    { storyPracticeAssessment: { practice: "core-technical" } },
    { coreTechnicalAssessment: { kind: "core-technical-assessment" } }
  ])("assigns Claire to DSA and Core Technical", (setup) => {
    expect(interviewerPersonaIdForSetup(setup)).toBe("claire");
  });

  it.each([
    undefined,
    { templateTitle: "Resume and behavioural" },
    { storyPracticeAssessment: { practice: "applied-engineering" } },
    { storyPracticeAssessment: { practice: "architecture-design" } }
  ])("keeps James for other interviews", (setup) => {
    expect(interviewerPersonaIdForSetup(setup)).toBe("james");
  });
});
