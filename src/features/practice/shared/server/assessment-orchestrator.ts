import type { StoryPracticeAssessmentStatus } from "./contracts";

export function storyPracticeAssessmentStartDisposition(input: {
  status: StoryPracticeAssessmentStatus;
  isCurrent: boolean;
  allowLocked: boolean;
  historical(): Error;
  locked(): Error;
}): "start" | "start-early" | "replay" {
  if (!input.isCurrent) throw input.historical();
  if (input.status === "LOCKED" && !input.allowLocked) throw input.locked();
  if (
    input.status === "IN_PROGRESS" ||
    input.status === "FINALIZING" ||
    input.status === "COMPLETED"
  ) {
    return "replay";
  }
  return input.status === "LOCKED" ? "start-early" : "start";
}

export function assertStoryPracticeAssessmentResponses(
  promptIds: readonly string[],
  responses: ReadonlyArray<{ promptId: string }>,
  mismatch: () => Error
): void {
  const expected = [...promptIds].sort();
  const actual = responses.map(({ promptId }) => promptId).sort();
  if (
    new Set(actual).size !== expected.length ||
    actual.length !== expected.length ||
    expected.some((id, index) => id !== actual[index])
  ) {
    throw mismatch();
  }
}
