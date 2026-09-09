import followOperationArtifact from "@/features/practice/core-technical/domain/generated/follow-operation-guided-benchmark.json";
import operationFailsHalfwayArtifact from "@/features/practice/core-technical/domain/generated/operation-fails-halfway-standard-benchmark.json";
import { coreTechnicalStoryReviewArtifactSchema } from "@/features/practice/core-technical/domain/review-artifact-contracts";
import type { CoreTechnicalDifficulty } from "@/features/practice/core-technical/domain/story-contracts";

import type { ReviewedCoreTechnicalDraft } from "./generation-pipeline";
import type { StoryGeneratorInput } from "./story-generator";

const APPROVED_ARTIFACTS = [followOperationArtifact, operationFailsHalfwayArtifact].map((raw) => {
  const artifact = coreTechnicalStoryReviewArtifactSchema.parse(raw);
  if (
    artifact.humanReview.status !== "approved" ||
    artifact.evaluation.humanReviewStatus !== "approved" ||
    !artifact.evaluation.releaseEligible
  ) {
    throw new Error(`Core Technical approved draft is not release eligible: ${artifact.caseKey}`);
  }
  return artifact;
});

/**
 * Returns only an exact human-approved story+difficulty bundle. A different
 * blueprint or calibration state deliberately falls through to generation.
 */
export function approvedCoreTechnicalDraft(
  input: StoryGeneratorInput
): ReviewedCoreTechnicalDraft | null {
  if (!input.reviewedContract) return null;
  const expectedDifficulty = difficultyFor(input.baselineState);
  const artifact = APPROVED_ARTIFACTS.find(
    (candidate) =>
      candidate.story.title === input.reviewedContract?.storyTitle &&
      candidate.story.difficulty === expectedDifficulty &&
      sameValues(
        candidate.story.stages.map((stage) => stage.patternKey),
        input.reviewedContract.stagePatternKeys
      ) &&
      input.reviewedContract.requiredStoryTopicKeys.every((topicKey) =>
        [candidate.story.primaryTopicKey, ...candidate.story.secondaryTopicKeys].includes(topicKey)
      )
  );
  if (!artifact) return null;

  return structuredClone({
    story: artifact.story,
    storyReview: artifact.storyReview,
    questionBlock: artifact.questionBlock,
    questionBlockReview: artifact.questionBlockReview
  });
}

function difficultyFor(state: StoryGeneratorInput["baselineState"]): CoreTechnicalDifficulty {
  if (state === "STRETCH") return "stretch";
  if (state === "STANDARD") return "standard";
  return "guided";
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
