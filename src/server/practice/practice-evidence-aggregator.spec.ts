import {
  aggregateCandidatePracticeEvidence,
  practiceEvidenceSourceFingerprint,
  type VerifiedPracticeAttemptInput
} from "./practice-evidence-aggregator";

const NOW = Date.UTC(2026, 7, 27, 12);

function attempt(
  overrides: Partial<VerifiedPracticeAttemptInput> = {}
): VerifiedPracticeAttemptInput {
  return {
    id: "attempt-1",
    questionId: "react-state",
    sourceType: "PREP",
    verificationStatus: "VERIFIED",
    title: "React state ownership",
    format: "typed",
    score: 90,
    difficulty: "medium",
    observedAt: NOW - 2_000,
    questionContentVersion: 2,
    evaluatorVersion: "prep-deterministic-v1",
    skillKeys: ["react"],
    topicKeys: ["react", "chapter:frontend-core"],
    hintsUsed: 0,
    ...overrides
  };
}

describe("Practice evidence aggregation", () => {
  it("excludes unverified and unsnapshotted work from demonstrated ability", () => {
    const evidence = aggregateCandidatePracticeEvidence({
      id: "evidence-1",
      revision: 1,
      generatedAt: NOW,
      attempts: [
        attempt(),
        attempt({
          id: "attempt-unverified",
          verificationStatus: "UNVERIFIED",
          score: 100
        }),
        attempt({
          id: "attempt-no-version",
          questionContentVersion: 0,
          score: 100
        })
      ]
    });

    expect(evidence).toMatchObject({
      verifiedAttemptCount: 1,
      verifiedQuestionCount: 1,
      sourceAttemptIds: ["attempt-1"]
    });
    expect(evidence?.skills[0]).toMatchObject({ skillKey: "react", score: 79.2 });
  });

  it("reports mastery, weakness, hint/retry dependence, recent questions, and code correctness", () => {
    const evidence = aggregateCandidatePracticeEvidence({
      id: "evidence-2",
      revision: 2,
      generatedAt: NOW,
      attempts: [
        attempt({ score: 40, hintsUsed: 2 }),
        attempt({
          id: "attempt-2",
          score: 60,
          observedAt: NOW - 1_000,
          hintsUsed: 1
        }),
        attempt({
          id: "attempt-3",
          questionId: "two-sum",
          sourceType: "DSA",
          title: "Two Sum",
          format: "code",
          score: 100,
          observedAt: NOW,
          skillKeys: ["problem-solving", "dsa-pattern:hash-map"],
          topicKeys: ["dsa:hash-map"],
          language: "python",
          accepted: true,
          testsPassed: 5,
          testCount: 5
        })
      ]
    });

    expect(evidence?.weakTopics).toEqual(
      expect.arrayContaining([expect.objectContaining({ topicKey: "react", score: 33 })])
    );
    expect(evidence?.masteryTopics).toEqual([
      expect.objectContaining({ topicKey: "dsa:hash-map", score: 88 })
    ]);
    expect(evidence?.skills.find((skill) => skill.skillKey === "react")).toMatchObject({
      score: 33,
      trend: 20,
      hintsUsed: 3,
      hintDependenceRate: 1,
      repeatedAttemptCount: 1,
      retryDependenceRate: 0.5
    });
    expect(evidence?.recentQuestions[0]).toMatchObject({
      attemptId: "attempt-3",
      sourceType: "DSA"
    });
    expect(evidence?.codeEvidence).toEqual([
      expect.objectContaining({ language: "python", accepted: true, testsPassed: 5 })
    ]);
  });

  it("creates the same source fingerprint regardless of query order", () => {
    const first = attempt();
    const second = attempt({ id: "attempt-2", observedAt: NOW });
    expect(practiceEvidenceSourceFingerprint([first, second], NOW)).toBe(
      practiceEvidenceSourceFingerprint([second, first], NOW)
    );
    expect(practiceEvidenceSourceFingerprint([first, second], NOW)).not.toBe(
      practiceEvidenceSourceFingerprint([first, second], Date.UTC(2026, 8, 27))
    );
  });
});
