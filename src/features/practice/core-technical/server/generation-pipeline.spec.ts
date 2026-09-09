import { describe, expect, it, vi } from "vitest";

import {
  CORE_TECHNICAL_CRITIC_VERSION,
  type CoreTechnicalCriticReport
} from "@/features/practice/core-technical/domain/critic-contracts";
import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "@/features/practice/core-technical/domain/gold-cases";
import type { FrozenQuestionBlock } from "@/features/practice/core-technical/domain/question-contracts";
import type { SelectedCoreTechnicalStory } from "@/features/practice/core-technical/domain/story-contracts";

import { CoreTechnicalGenerationPipeline } from "./generation-pipeline";

const story = { key: "reviewed-story" } as SelectedCoreTechnicalStory;
const questionBlock = {
  storyKey: "reviewed-story",
  questions: []
} as unknown as FrozenQuestionBlock;

function report(target: "story" | "question-block", approved: boolean): CoreTechnicalCriticReport {
  const dimensions = [
    "technical-correctness",
    "interview-relevance",
    "story-continuity",
    "difficulty"
  ] as const;
  return {
    criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
    target,
    approved,
    verdicts: dimensions.map((dimension) => ({
      criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
      target,
      dimension,
      verdict: approved ? "pass" : "fail",
      score: approved ? 95 : 20,
      confidence: "high",
      summary:
        "This independent review contains enough detail to explain the final approval decision.",
      evidenceChecks: [
        {
          claim: "The generation was checked against its declared interview pattern.",
          evidence: "The referenced mechanism and the generated reasoning were compared directly.",
          passed: approved
        },
        {
          claim: "The generation was checked against its declared story contract.",
          evidence: "The incident, stage dependency, and expected outcome were compared directly.",
          passed: approved
        }
      ],
      blockingIssues: approved
        ? []
        : [
            {
              code: "review-failed",
              message:
                "The generated asset does not meet the required independent review threshold.",
              stageKey: null,
              questionKey: null
            }
          ],
      requiredChanges: []
    }))
  };
}

function setup(storyApproved = true, blockApproved = true) {
  const storyGenerator = { generate: vi.fn().mockResolvedValue(story) };
  const questionGenerator = {
    generateDraftBlock: vi.fn().mockResolvedValue(questionBlock)
  };
  const critic = {
    reviewStory: vi.fn().mockResolvedValue(report("story", storyApproved)),
    reviewQuestionBlock: vi.fn().mockResolvedValue(report("question-block", blockApproved))
  };
  const runner = { auditQuestion: vi.fn().mockResolvedValue({ valid: true, failures: [] }) };
  return {
    storyGenerator,
    questionGenerator,
    critic,
    runner,
    pipeline: new CoreTechnicalGenerationPipeline({
      storyGenerator,
      questionGenerator,
      critic,
      runner
    })
  };
}

describe("CoreTechnicalGenerationPipeline", () => {
  it("returns a draft only after both independent review gates approve", async () => {
    const { pipeline, critic } = setup();

    const result = await pipeline.prepareReviewedDraft({} as never);

    expect(result).toEqual({
      story,
      storyReview: report("story", true),
      questionBlock,
      questionBlockReview: report("question-block", true)
    });
    expect(critic.reviewStory).toHaveBeenCalledBefore(critic.reviewQuestionBlock);
  });

  it("uses an exact approved artifact without calling generation providers", async () => {
    const setupResult = setup();
    const pipeline = new CoreTechnicalGenerationPipeline({
      storyGenerator: setupResult.storyGenerator,
      questionGenerator: setupResult.questionGenerator,
      critic: setupResult.critic,
      runner: setupResult.runner
    });
    const goldCase = NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!;

    const approvedDraft = await pipeline.prepareReviewedDraft(
      {
        ...goldCase.candidateContext,
        reviewedContract: {
          storyTitle: goldCase.expected.storyTitle,
          stagePatternKeys: goldCase.expected.stagePatternKeys,
          requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
        }
      },
      { preferApprovedArtifact: true }
    );

    expect(approvedDraft.story.title).toBe("Follow the operation");
    expect(approvedDraft.story.difficulty).toBe("guided");
    expect(approvedDraft.questionBlock.questions).toHaveLength(8);
    expect(setupResult.storyGenerator.generate).not.toHaveBeenCalled();
    expect(setupResult.questionGenerator.generateDraftBlock).not.toHaveBeenCalled();
    expect(setupResult.critic.reviewStory).not.toHaveBeenCalled();
    expect(setupResult.critic.reviewQuestionBlock).not.toHaveBeenCalled();
    expect(setupResult.runner.auditQuestion).toHaveBeenCalledTimes(2);
  });

  it("does not reuse an approved artifact at a different difficulty", async () => {
    const setupResult = setup();
    const goldCase = NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!;

    await setupResult.pipeline.prepareReviewedDraft(
      {
        ...goldCase.candidateContext,
        baselineState: "STRETCH",
        reviewedContract: {
          storyTitle: goldCase.expected.storyTitle,
          stagePatternKeys: goldCase.expected.stagePatternKeys,
          requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
        }
      },
      { preferApprovedArtifact: true }
    );

    expect(setupResult.storyGenerator.generate).toHaveBeenCalledTimes(1);
  });

  it("does not generate questions when the story review fails", async () => {
    const { pipeline, questionGenerator } = setup(false);

    await expect(pipeline.prepareReviewedDraft({} as never)).rejects.toThrow("independent review");
    expect(questionGenerator.generateDraftBlock).not.toHaveBeenCalled();
  });

  it("does not return a draft when the question-block review fails", async () => {
    const { pipeline } = setup(true, false);

    await expect(pipeline.prepareReviewedDraft({} as never)).rejects.toThrow("independent review");
  });

  it("does not return a critic-approved block when its executable contract fails the sandbox audit", async () => {
    const { pipeline, questionGenerator, runner } = setup();
    questionGenerator.generateDraftBlock.mockResolvedValue({
      ...questionBlock,
      questions: [{ key: "broken-executable", runnerContract: {} }]
    } as unknown as FrozenQuestionBlock);
    runner.auditQuestion.mockResolvedValue({
      valid: false,
      failures: ["Reference solution does not pass every test"]
    });

    await expect(pipeline.prepareReviewedDraft({} as never)).rejects.toThrow(
      "failed the pinned runner audit"
    );
  });
});
