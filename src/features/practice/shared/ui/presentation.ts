import type { StoryPracticeQuestionFormat, StoryPracticeDraftWork } from "./view-contracts";

export type StoryPracticeQuestionWorkKind = StoryPracticeDraftWork["kind"];

/** Maps every public question format to one of the three shared workspace controls. */
export function storyPracticeQuestionWorkKind(
  format: StoryPracticeQuestionFormat
): StoryPracticeQuestionWorkKind {
  switch (format) {
    case "mcq":
      return "choice";
    case "predict-explain":
    case "written":
    case "spoken":
    case "artifact-diagnosis":
    case "production-decision":
      return "text";
    case "debug-repair":
    case "micro-implementation":
      return "code";
  }
}

/** Keeps estimates identical across every story-practice overview and workspace. */
export function storyPracticeQuestionMinutes(
  format: StoryPracticeQuestionFormat,
  blockMinutes: number
): number {
  const baseMinutes: Record<StoryPracticeQuestionFormat, number> = {
    mcq: 5,
    "predict-explain": 5,
    written: 5,
    spoken: 5,
    "artifact-diagnosis": 5,
    "debug-repair": 8,
    "micro-implementation": 8,
    "production-decision": 4
  };
  return Math.max(3, Math.round(baseMinutes[format] * (blockMinutes / 45)));
}

export function humanizeStoryPracticeKey(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
