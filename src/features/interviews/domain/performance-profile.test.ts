import { describe, expect, it } from "vitest";
import { candidatePerformanceProfileSchema } from "./performance-profile";

const profile = {
  schemaVersion: 3 as const,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  revision: 1,
  sourceSessionFingerprint: "sha256-sessions",
  generatedAt: 1_000,
  completedSessionCount: 1,
  answeredQuestionCount: 2,
  sourceSessionIds: ["session-1"],
  skills: [
    {
      skillKey: "react",
      score: 74,
      confidence: 0.65,
      sampleSize: 2,
      lastObservedAt: 900,
      trend: 8,
      topicKeys: ["frontend-engineering"],
      rubricPerformance: [{ rubricKey: "technical-depth", score: 74, sampleSize: 2 }]
    }
  ]
};

describe("candidate performance profile contract", () => {
  it("accepts an attributable versioned aggregate", () => {
    expect(candidatePerformanceProfileSchema.parse(profile)).toEqual(profile);
  });

  it("rejects duplicate skills and invalid demonstrated scores", () => {
    expect(() =>
      candidatePerformanceProfileSchema.parse({
        ...profile,
        skills: [profile.skills[0], { ...profile.skills[0], score: 101 }]
      })
    ).toThrow();
  });
});
