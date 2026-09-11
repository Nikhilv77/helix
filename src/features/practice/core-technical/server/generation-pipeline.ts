import type { CoreTechnicalCriticReport } from "@/features/practice/core-technical/domain/critic-contracts";
import type { FrozenQuestionBlock } from "@/features/practice/core-technical/domain/question-contracts";
import type { SelectedCoreTechnicalStory } from "@/features/practice/core-technical/domain/story-contracts";
import type { CoreTechnicalGenerationProvenance } from "@/features/practice/core-technical/domain/focus-ranking-contracts";

import {
  assertCoreTechnicalCriticApproval,
  type CoreTechnicalGenerationCritic
} from "./generation-critic";
import type { CoreTechnicalQuestionGenerator } from "./question-generator";
import type { CoreTechnicalStoryGenerator, StoryGeneratorInput } from "./story-generator";
import type { CoreTechnicalRunnerService } from "./runner.service";
import { approvedCoreTechnicalDraft } from "./approved-draft-catalogue";
import { AiProviderException } from "@/server/ai/ai-provider.exception";
import { Logger } from "@/server/common/logger";

type GenerationPipelineDependencies = {
  storyGenerator: Pick<CoreTechnicalStoryGenerator, "generate">;
  questionGenerator: Pick<CoreTechnicalQuestionGenerator, "generateDraftBlock">;
  critic: Pick<CoreTechnicalGenerationCritic, "reviewStory" | "reviewQuestionBlock">;
  runner: Pick<CoreTechnicalRunnerService, "auditQuestion">;
  approvedDraftResolver?: (input: StoryGeneratorInput) => ReviewedCoreTechnicalDraft | null;
};

export type ReviewedCoreTechnicalDraft = {
  story: SelectedCoreTechnicalStory;
  storyReview: CoreTechnicalCriticReport;
  questionBlock: FrozenQuestionBlock;
  questionBlockReview: CoreTechnicalCriticReport;
  /** Stored with the immutable candidate block; never inferred later from its content. */
  provenance?: CoreTechnicalGenerationProvenance;
};

export class CoreTechnicalGenerationPipeline {
  private readonly logger = new Logger(CoreTechnicalGenerationPipeline.name);

  constructor(private readonly dependencies: GenerationPipelineDependencies) {}

  async prepareReviewedDraft(
    input: StoryGeneratorInput,
    options: {
      preferApprovedArtifact?: boolean;
      fallbackToApprovedArtifactOnProviderFailure?: boolean;
    } = {}
  ): Promise<ReviewedCoreTechnicalDraft> {
    if (options.preferApprovedArtifact) {
      const approvedDraft = await this.reviewedArtifact(input, "reviewed-artifact");
      if (approvedDraft) return approvedDraft;
    }

    try {
      const story = await this.dependencies.storyGenerator.generate(input);
      const storyReview = await this.dependencies.critic.reviewStory(story);
      assertCoreTechnicalCriticApproval(storyReview);

      const questionBlock = await this.dependencies.questionGenerator.generateDraftBlock(story, {
        normalizeReviewedMetadata: input.reviewedContract !== undefined
      });
      const questionBlockReview = await this.dependencies.critic.reviewQuestionBlock(
        story,
        questionBlock
      );
      assertCoreTechnicalCriticApproval(questionBlockReview);

      await this.auditExecutableQuestions(questionBlock);

      return {
        story,
        storyReview,
        questionBlock,
        questionBlockReview,
        provenance: input.personalizePresentation ? "live-personalized" : "live-generated"
      };
    } catch (error) {
      if (
        options.fallbackToApprovedArtifactOnProviderFailure &&
        error instanceof AiProviderException
      ) {
        const approvedDraft = await this.reviewedArtifact(input, "reviewed-fallback");
        if (approvedDraft) {
          this.logger.warn(
            JSON.stringify({
              event: "core-technical.generation.reviewed-fallback",
              failedOperation: error.operation,
              provider: error.provider,
              code: error.code
            })
          );
          return approvedDraft;
        }
      }
      throw error;
    }
  }

  private async reviewedArtifact(
    input: StoryGeneratorInput,
    provenance: CoreTechnicalGenerationProvenance
  ): Promise<ReviewedCoreTechnicalDraft | null> {
    const approvedDraft = (this.dependencies.approvedDraftResolver ?? approvedCoreTechnicalDraft)(
      input
    );
    if (!approvedDraft) return null;
    assertCoreTechnicalCriticApproval(approvedDraft.storyReview);
    assertCoreTechnicalCriticApproval(approvedDraft.questionBlockReview);
    await this.auditExecutableQuestions(approvedDraft.questionBlock);
    return { ...approvedDraft, provenance };
  }

  private async auditExecutableQuestions(questionBlock: FrozenQuestionBlock): Promise<void> {
    for (const question of questionBlock.questions.filter(
      (candidate) => candidate.runnerContract
    )) {
      const audit = await this.dependencies.runner.auditQuestion(question);
      if (!audit.valid) {
        throw new Error(
          `Executable question ${question.key} failed the pinned runner audit: ${audit.failures.join("; ")}`
        );
      }
    }
  }
}
