import type { CoreTechnicalDifficulty } from "@/features/practice/core-technical/domain/story-contracts";

import type { ReviewedCoreTechnicalDraft } from "./generation-pipeline";
import type { StoryGeneratorInput } from "./story-generator";
import { focusedPracticePathFallback } from "./focused-practice-path-fallbacks";

/**
 * Returns only an exact human-approved story+difficulty bundle. A different
 * blueprint or calibration state deliberately falls through to generation.
 */
export function approvedCoreTechnicalDraft(
  input: StoryGeneratorInput
): ReviewedCoreTechnicalDraft | null {
  if (!input.reviewedContract) return null;
  const expectedDifficulty = difficultyFor(input.baselineState);
  const focused = input.reviewedContract.storyKey
    ? focusedPracticePathFallback(input.reviewedContract.storyKey)
    : null;
  if (
    focused &&
    focused.story.title === input.reviewedContract.storyTitle &&
    sameValues(
      focused.story.stages.map((stage) => stage.patternKey),
      input.reviewedContract.stagePatternKeys
    ) &&
    sameValues(
      [focused.story.primaryTopicKey, ...focused.story.secondaryTopicKeys],
      input.reviewedContract.requiredStoryTopicKeys
    )
  ) {
    return structuredClone({
      ...focused,
      story: { ...focused.story, difficulty: expectedDifficulty }
    });
  }
  return null;
}

function difficultyFor(state: StoryGeneratorInput["baselineState"]): CoreTechnicalDifficulty {
  if (state === "STRETCH") return "stretch";
  if (state === "STANDARD") return "standard";
  return "guided";
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
