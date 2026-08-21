import {
  RoadmapProgressStatus,
  RoadmapQuestionAttemptStatus
} from "@prisma/client";
import {
  attemptStatus,
  normalizedScore,
  questionStatusAfterAction
} from "./question-actions";

describe("roadmap question actions", () => {
  it("records complete actions as a completed attempt and progress row", () => {
    expect(attemptStatus("complete")).toBe(RoadmapQuestionAttemptStatus.COMPLETED);
    expect(questionStatusAfterAction(RoadmapProgressStatus.ACTIVE, "complete")).toBe(
      RoadmapProgressStatus.COMPLETED
    );
    expect(normalizedScore(undefined, "complete")).toBe(1);
  });

  it("preserves completed progress when a later non-complete action arrives", () => {
    expect(questionStatusAfterAction(RoadmapProgressStatus.COMPLETED, "open")).toBe(
      RoadmapProgressStatus.COMPLETED
    );
    expect(questionStatusAfterAction(RoadmapProgressStatus.COMPLETED, "submit")).toBe(
      RoadmapProgressStatus.COMPLETED
    );
  });

  it("clamps submitted scores and treats skips as skipped", () => {
    expect(normalizedScore(1.8, "submit")).toBe(1);
    expect(normalizedScore(-0.2, "submit")).toBe(0);
    expect(normalizedScore(undefined, "submit")).toBeNull();
    expect(attemptStatus("skip")).toBe(RoadmapQuestionAttemptStatus.SKIPPED);
    expect(questionStatusAfterAction(RoadmapProgressStatus.IN_PROGRESS, "skip")).toBe(
      RoadmapProgressStatus.SKIPPED
    );
  });
});
