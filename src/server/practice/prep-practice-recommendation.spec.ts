import type { PrepPracticeQuestionSummary } from "@/lib/practice/prep-practice";
import {
  rankPrepRecommendations,
  type PrepRecommendationCandidate,
  type PrepRecommendationContext
} from "./prep-practice-recommendation";

const NOW = Date.UTC(2026, 7, 27, 12);
const DAY = 24 * 60 * 60 * 1_000;

describe("PREP practice recommendations", () => {
  it("uses persisted order and question identity as stable tie-breakers", () => {
    const first = candidate({ id: "question-b", order: 1 });
    const second = candidate({ id: "question-a", order: 2 });

    expect(
      rankPrepRecommendations([second, first], context()).map(({ questionId }) => questionId)
    ).toEqual(["question-b", "question-a"]);
    expect(
      rankPrepRecommendations([first, second], context()).map(({ questionId }) => questionId)
    ).toEqual(["question-b", "question-a"]);
  });

  it("prioritizes a verified weak score and explains hint and retry dependence", () => {
    const weak = candidate(
      { id: "weak", order: 2, attemptCount: 3, status: "IN_PROGRESS", difficulty: "medium" },
      { bestVerifiedScore: 0.48, revealedHintCount: 2 }
    );
    const untouched = candidate({ id: "new", order: 1 });

    const ranked = rankPrepRecommendations([untouched, weak], context());

    expect(ranked[0]).toMatchObject({
      questionId: "weak",
      evidenceCodes: ["weak-topic", "hint-dependence", "retry-dependence"]
    });
    expect(ranked[0]!.reason).toContain("latest verified score 48%");
    expect(ranked[0]!.reason).toContain("2 revealed");
    expect(ranked[0]!.reason).toContain("2 prior retries");
  });

  it("schedules completed questions only when their score-based review is due", () => {
    const due = candidate(
      { id: "due", order: 2, status: "COMPLETED", attemptCount: 1 },
      { bestVerifiedScore: 0.82, lastVerifiedAt: NOW - 8 * DAY, completedAt: NOW - 8 * DAY }
    );
    const notDue = candidate(
      { id: "not-due", order: 1, status: "COMPLETED", attemptCount: 1 },
      { bestVerifiedScore: 0.92, lastVerifiedAt: NOW - 8 * DAY, completedAt: NOW - 8 * DAY }
    );

    const ranked = rankPrepRecommendations([notDue, due], context());

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ questionId: "due", evidenceCodes: ["review-due"] });
    expect(ranked[0]!.reason).toContain("8 days since verified practice");
  });

  it("uses a newer weak verified retry instead of an older best score", () => {
    const regressed = candidate(
      { id: "regressed", status: "COMPLETED", attemptCount: 2 },
      {
        bestVerifiedScore: 0.94,
        latestVerifiedScore: 0.51,
        lastVerifiedAt: NOW,
        completedAt: NOW - 20 * DAY
      }
    );

    const ranked = rankPrepRecommendations(
      [regressed],
      context({
        masteredQuestionIds: new Set(["regressed"])
      })
    );

    expect(ranked[0]).toMatchObject({ questionId: "regressed" });
    expect(ranked[0]!.evidenceCodes).toContain("weak-topic");
    expect(ranked[0]!.reason).toContain("latest verified score 51%");
  });

  it("shortens spaced review when the passing answer depended on hints", () => {
    const supported = candidate(
      { id: "supported", status: "COMPLETED", attemptCount: 1 },
      {
        bestVerifiedScore: 0.82,
        lastVerifiedAt: NOW - 6 * DAY,
        completedAt: NOW - 6 * DAY,
        revealedHintCount: 1
      }
    );
    const independent = candidate(
      { id: "independent", order: 2, status: "COMPLETED", attemptCount: 1 },
      { bestVerifiedScore: 0.82, lastVerifiedAt: NOW - 6 * DAY, completedAt: NOW - 6 * DAY }
    );

    expect(
      rankPrepRecommendations([supported, independent], context()).map((item) => item.questionId)
    ).toEqual(["supported"]);
  });

  it("uses matching demonstrated interview weakness as ranking evidence", () => {
    const react = candidate(
      { id: "react", order: 2 },
      { skillEvidenceText: "React rendering state effects and component behavior" }
    );
    const database = candidate(
      { id: "database", order: 1 },
      { skillEvidenceText: "PostgreSQL indexing and transaction isolation" }
    );
    const recommendationContext = context({
      interviewSkills: [
        {
          skillKey: "react-rendering",
          score: 38,
          confidence: 0.9,
          sampleSize: 3,
          lastObservedAt: NOW - DAY,
          topicKeys: ["react-state"]
        }
      ]
    });

    const ranked = rankPrepRecommendations([database, react], recommendationContext);

    expect(ranked[0]).toMatchObject({
      questionId: "react",
      evidenceCodes: ["next-roadmap-question", "interview-recommendation"]
    });
    expect(ranked[0]!.reason).toContain("react rendering at 38%");
  });

  it("recommends a placed prerequisite before the question it unlocks", () => {
    const dependent = candidate({ id: "dependent", order: 1 }, { prerequisites: ["foundation"] });
    const foundation = candidate({ id: "foundation", order: 2 });

    const ranked = rankPrepRecommendations([dependent, foundation], context());

    expect(ranked[0]).toMatchObject({
      questionId: "foundation",
      evidenceCodes: ["next-roadmap-question", "prerequisite"]
    });
    expect(ranked[0]!.reason).toContain("unlocks 1 placed question");
    expect(ranked.find((item) => item.questionId === "dependent")?.evidenceCodes).toContain(
      "prerequisite-gap"
    );
  });

  it("raises difficulty after multiple strong verified scores", () => {
    const masteredOne = candidate(
      { id: "mastered-1", status: "COMPLETED", attemptCount: 1 },
      { bestVerifiedScore: 0.91, lastVerifiedAt: NOW, completedAt: NOW }
    );
    const masteredTwo = candidate(
      { id: "mastered-2", order: 2, status: "COMPLETED", attemptCount: 1 },
      { bestVerifiedScore: 0.89, lastVerifiedAt: NOW, completedAt: NOW }
    );
    const easy = candidate({ id: "easy", order: 3, difficulty: "easy" });
    const hard = candidate({ id: "hard", order: 4, difficulty: "hard" });

    const ranked = rankPrepRecommendations(
      [masteredOne, masteredTwo, easy, hard],
      context({ masteredQuestionIds: new Set(["mastered-1", "mastered-2"]) })
    );

    expect(ranked[0]).toMatchObject({ questionId: "hard" });
    expect(ranked[0]!.evidenceCodes).toContain("increase-difficulty");
    expect(ranked[0]!.reason).toContain("recent verified scores are strong");
  });

  it("holds skipped questions for a day and then recommends a retry", () => {
    const skipped = candidate(
      { id: "skipped", status: "SKIPPED", attemptCount: 1 },
      { lastAttemptedAt: NOW - DAY + 1 }
    );

    expect(rankPrepRecommendations([skipped], context())).toEqual([]);
    const afterCooldown = rankPrepRecommendations(
      [{ ...skipped, lastAttemptedAt: NOW - DAY }],
      context()
    );
    expect(afterCooldown[0]).toMatchObject({
      questionId: "skipped",
      evidenceCodes: ["retry-after-skip"]
    });
  });
});

function candidate(
  questionOverrides: Partial<PrepPracticeQuestionSummary> = {},
  overrides: Partial<Omit<PrepRecommendationCandidate, "question">> = {}
): PrepRecommendationCandidate {
  const question: PrepPracticeQuestionSummary = {
    id: "question",
    progressId: "progress",
    order: 1,
    title: "Question",
    objective: "Explain the mechanism",
    chapterKey: "chapter",
    difficulty: "easy",
    format: "typed",
    expectedMinutes: 10,
    status: "ACTIVE",
    attemptCount: 0,
    bestScore: null,
    href: "/practice/core-technical/question",
    recommendationReason: "",
    ...questionOverrides
  };
  return {
    question,
    prerequisites: [],
    selectionReason: "role+blueprint+prerequisite-ready",
    skillEvidenceText: `${question.title} ${question.objective}`,
    bestVerifiedScore: null,
    lastVerifiedAt: null,
    lastAttemptedAt: null,
    completedAt: null,
    revealedHintCount: 0,
    ...overrides,
    latestVerifiedScore: overrides.latestVerifiedScore ?? overrides.bestVerifiedScore ?? null
  };
}

function context(overrides: Partial<PrepRecommendationContext> = {}): PrepRecommendationContext {
  return {
    now: NOW,
    masteredQuestionIds: new Set(),
    interviewSkills: [],
    ...overrides
  };
}
