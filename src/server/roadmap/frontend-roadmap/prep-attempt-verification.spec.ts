import { RoadmapProgressStatus } from "@prisma/client";
import type { PrepPracticeReview } from "@/lib/practice/prep-practice";
import { prepStatusAfterAttempt, verifiedPrepScore } from "./service";

describe("PREP attempt verification", () => {
  it("completes only from a verified passing score", () => {
    const review = fixture({ score: 0.82, verificationStatus: "VERIFIED" });

    expect(verifiedPrepScore(review)).toBe(0.82);
    expect(prepStatusAfterAttempt(RoadmapProgressStatus.ACTIVE, "submit", review)).toBe(
      RoadmapProgressStatus.COMPLETED
    );
  });

  it("preserves an evaluator outage without score or mastery", () => {
    const review = fixture({
      score: null,
      correctness: "unverified",
      verificationStatus: "UNVERIFIED",
      rubricBand: null
    });

    expect(verifiedPrepScore(review)).toBeNull();
    expect(prepStatusAfterAttempt(RoadmapProgressStatus.ACTIVE, "submit", review)).toBe(
      RoadmapProgressStatus.IN_PROGRESS
    );
  });

  it("never treats skip as evaluated evidence", () => {
    const review = fixture({
      score: null,
      correctness: "skipped",
      verificationStatus: "NOT_APPLICABLE",
      rubricBand: null
    });

    expect(verifiedPrepScore(review)).toBeNull();
    expect(prepStatusAfterAttempt(RoadmapProgressStatus.ACTIVE, "skip", review)).toBe(
      RoadmapProgressStatus.SKIPPED
    );
  });
});

function fixture(overrides: Partial<PrepPracticeReview> = {}): PrepPracticeReview {
  return {
    score: 0.82,
    correctness: "strong",
    summary: "Strong answer.",
    strengths: ["Explains the mechanism."],
    missing: [],
    explanation: "Authored explanation.",
    correctOptionIndex: null,
    expectedOutput: null,
    flaw: null,
    diagnosis: null,
    verificationStatus: "VERIFIED",
    evaluatorVersion: "prep-rubric-v1",
    questionContentVersion: 1,
    rubricBand: "strong",
    rubricRationale: "Matches the strong band.",
    ...overrides
  };
}
