import { describe, expect, it, vi } from "vitest";

import {
  CORE_TECHNICAL_CRITIC_VERSION,
  type CoreTechnicalCriticReport
} from "@/features/practice/core-technical/domain/critic-contracts";
import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "@/features/practice/core-technical/domain/gold-cases";
import type { FrozenQuestionBlock } from "@/features/practice/core-technical/domain/question-contracts";
import type { SelectedCoreTechnicalStory } from "@/features/practice/core-technical/domain/story-contracts";
import { AiProviderException } from "@/server/ai/ai-provider.exception";

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
      questionBlockReview: report("question-block", true),
      provenance: "live-generated"
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

    const approvedDraft = await pipeline.prepareApprovedDraft({
      ...goldCase.candidateContext,
      reviewedContract: {
        storyKey: "javascript-values-copying-mutation",
        storyTitle: goldCase.expected.storyTitle,
        stagePatternKeys: goldCase.expected.stagePatternKeys,
        requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
      }
    });

    expect(approvedDraft.story.title).toBe("Trace and fix shared JavaScript state");
    expect(approvedDraft.story.difficulty).toBe("guided");
    expect(approvedDraft.questionBlock.questions).toHaveLength(6);
    expect(
      approvedDraft.questionBlock.questions.every((question) => {
        const guide = question.answer.learningGuide;
        return (
          guide !== undefined &&
          guide.markdown.includes("## What is happening") &&
          guide.markdown.includes("## How to reason through it") &&
          guide.markdown.includes("## A strong interview answer") &&
          guide.markdown.includes("## What to avoid") &&
          guide.diagram.steps.length >= 2 &&
          guide.diagram.steps.length <= 6
        );
      })
    ).toBe(true);
    expect(approvedDraft.provenance).toBe("reviewed-artifact");
    expect(setupResult.storyGenerator.generate).not.toHaveBeenCalled();
    expect(setupResult.questionGenerator.generateDraftBlock).not.toHaveBeenCalled();
    expect(setupResult.critic.reviewStory).not.toHaveBeenCalled();
    expect(setupResult.critic.reviewQuestionBlock).not.toHaveBeenCalled();
    expect(setupResult.runner.auditQuestion).toHaveBeenCalledTimes(2);
  });

  it("falls back to the reviewed artifact when personalized generation providers fail", async () => {
    const setupResult = setup();
    const providerError = new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "AI provider request failed",
      provider: "groq",
      operation: "core-technical-story-candidates-fallback",
      retryable: true
    });
    setupResult.storyGenerator.generate.mockRejectedValue(providerError);
    const reviewedDraft = {
      story,
      storyReview: report("story", true),
      questionBlock,
      questionBlockReview: report("question-block", true)
    };
    const approvedDraftResolver = vi.fn().mockReturnValue(reviewedDraft);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const pipeline = new CoreTechnicalGenerationPipeline({
      storyGenerator: setupResult.storyGenerator,
      questionGenerator: setupResult.questionGenerator,
      critic: setupResult.critic,
      runner: setupResult.runner,
      approvedDraftResolver
    });

    await expect(
      pipeline.prepareReviewedDraft({} as never, {
        fallbackToApprovedArtifactOnProviderFailure: true
      })
    ).resolves.toEqual({ ...reviewedDraft, provenance: "reviewed-fallback" });
    expect(approvedDraftResolver).toHaveBeenCalledOnce();
    expect(setupResult.questionGenerator.generateDraftBlock).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("core-technical.generation.reviewed-fallback")
    );
  });

  it("calibrates a reviewed fallback to the selected candidate difficulty", async () => {
    const setupResult = setup();
    const goldCase = NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!;

    const draft = await setupResult.pipeline.prepareReviewedDraft(
      {
        ...goldCase.candidateContext,
        baselineState: "STRETCH",
        reviewedContract: {
          storyKey: "javascript-values-copying-mutation",
          storyTitle: goldCase.expected.storyTitle,
          stagePatternKeys: goldCase.expected.stagePatternKeys,
          requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
        }
      },
      { preferApprovedArtifact: true }
    );

    expect(draft.story.difficulty).toBe("stretch");
    expect(draft.provenance).toBe("reviewed-artifact");
    expect(setupResult.storyGenerator.generate).not.toHaveBeenCalled();
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
