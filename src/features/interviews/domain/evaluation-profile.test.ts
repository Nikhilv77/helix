import { describe, expect, it } from "vitest";
import {
  allInterviewEvaluationProfiles,
  evaluationProfileForSetup,
  interviewFamilyForSetup
} from "./evaluation-profile";

describe("interview evaluation profiles", () => {
  it("defines six distinct judgement parameters for every report family", () => {
    const profiles = allInterviewEvaluationProfiles();

    expect(profiles).toHaveLength(4);
    for (const profile of profiles) {
      expect(profile.parameters).toHaveLength(6);
      expect(new Set(profile.parameters.map((parameter) => parameter.key)).size).toBe(6);
    }
  });

  it("classifies durable session identities into the four learner-facing families", () => {
    expect(interviewFamilyForSetup({ roundType: "hiring-manager", resumeRound: true })).toBe(
      "hr-behavioral"
    );
    expect(
      interviewFamilyForSetup({
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      })
    ).toBe("resume-behavioral");
    expect(
      interviewFamilyForSetup({ roundType: "technical", templateId: "dsa-block-assessment" })
    ).toBe("dsa-design");
    expect(
      interviewFamilyForSetup({
        roundType: "technical",
        storyPracticeAssessment: {
          kind: "story-practice-assessment",
          practice: "architecture-design",
          blockId: "block",
          assessmentId: "assessment",
          snapshotVersion: 1,
          evaluatorVersion: "v1"
        }
      })
    ).toBe("dsa-design");
    expect(
      evaluationProfileForSetup({ roundType: "technical", templateId: "technical-deep-dive" })
        .family
    ).toBe("core-technical-projects");
  });
});
