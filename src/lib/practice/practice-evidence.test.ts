import { describe, expect, it } from "vitest";
import { parseCandidatePracticeEvidence } from "./practice-evidence";

describe("Candidate Practice evidence contract", () => {
  it("rejects duplicate immutable attempt references", () => {
    expect(() =>
      parseCandidatePracticeEvidence({
        schemaVersion: 1,
        id: "evidence-1",
        revision: 1,
        sourceAttemptFingerprint: "sha256-source",
        generatedAt: 1,
        verifiedAttemptCount: 2,
        verifiedQuestionCount: 1,
        sourceAttemptIds: ["attempt-1", "attempt-1"],
        skills: [
          {
            skillKey: "react",
            score: 80,
            confidence: 0.6,
            sampleSize: 2,
            lastObservedAt: 1,
            trend: null,
            topicKeys: ["react"],
            hintsUsed: 0,
            hintDependenceRate: 0,
            repeatedAttemptCount: 1,
            retryDependenceRate: 0.5
          }
        ],
        masteryTopics: [],
        weakTopics: [],
        recentQuestions: [],
        codeEvidence: []
      })
    ).toThrow(/unique/);
  });
});
