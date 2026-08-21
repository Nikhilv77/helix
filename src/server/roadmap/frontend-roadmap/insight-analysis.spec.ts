import { RoadmapQuestionAttemptStatus } from "@prisma/client";
import { analyzeAttemptHistory, displayPattern, streakInsightBody } from "./insight-analysis";

function attempt(input: {
  createdAt: string;
  status: RoadmapQuestionAttemptStatus;
  score?: number | null;
  correctness?: string | null;
  pattern: string;
  title: string;
}) {
  return {
    createdAt: new Date(input.createdAt),
    status: input.status,
    score: input.score ?? null,
    correctness: input.correctness ?? null,
    questionProgress: {
      dsaQuestion: { primaryPattern: input.pattern, title: input.title },
      roadmapQuestionTemplate: null
    }
  };
}

describe("roadmap insight analysis", () => {
  it("surfaces repeated weak attempts as the next coaching priority", () => {
    const analysis = analyzeAttemptHistory([
      attempt({
        createdAt: "2026-08-21T12:00:00.000Z",
        status: RoadmapQuestionAttemptStatus.SUBMITTED,
        score: 0.3,
        pattern: "sliding-window",
        title: "Longest substring"
      }),
      attempt({
        createdAt: "2026-08-20T12:00:00.000Z",
        status: RoadmapQuestionAttemptStatus.SKIPPED,
        pattern: "sliding-window",
        title: "Minimum window"
      }),
      attempt({
        createdAt: "2026-08-20T11:00:00.000Z",
        status: RoadmapQuestionAttemptStatus.COMPLETED,
        score: 1,
        pattern: "arrays",
        title: "Two sum"
      })
    ] as never);

    expect(analysis.weakestPattern).toMatchObject({
      pattern: "sliding-window",
      weakAttempts: 2,
      lastQuestionTitle: "Longest substring"
    });
    expect(analysis.lastCompletedTitle).toBe("Two sum");
  });

  it("formats useful coaching copy", () => {
    expect(displayPattern("sliding-window")).toBe("Sliding Window");
    expect(streakInsightBody(0, 0)).toContain("Not started");
    expect(streakInsightBody(3, 8)).toContain("3-day solve streak");
  });
});
