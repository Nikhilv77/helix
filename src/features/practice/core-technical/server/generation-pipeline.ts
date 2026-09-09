import type { CoreTechnicalCriticReport } from "@/features/practice/core-technical/domain/critic-contracts";
import type { FrozenQuestionBlock } from "@/features/practice/core-technical/domain/question-contracts";
import type { SelectedCoreTechnicalStory } from "@/features/practice/core-technical/domain/story-contracts";

import {
  assertCoreTechnicalCriticApproval,
  type CoreTechnicalGenerationCritic
} from "./generation-critic";
import type { CoreTechnicalQuestionGenerator } from "./question-generator";
import type { CoreTechnicalStoryGenerator, StoryGeneratorInput } from "./story-generator";
import type { CoreTechnicalRunnerService } from "./runner.service";
import { approvedCoreTechnicalDraft } from "./approved-draft-catalogue";

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
};

export class CoreTechnicalGenerationPipeline {
  constructor(private readonly dependencies: GenerationPipelineDependencies) {}

  async prepareReviewedDraft(
    input: StoryGeneratorInput,
    options: { preferApprovedArtifact?: boolean } = {}
  ): Promise<ReviewedCoreTechnicalDraft> {
    if (options.preferApprovedArtifact) {
      const approvedDraft = (this.dependencies.approvedDraftResolver ?? approvedCoreTechnicalDraft)(
        input
      );
      if (approvedDraft) {
        assertCoreTechnicalCriticApproval(approvedDraft.storyReview);
        assertCoreTechnicalCriticApproval(approvedDraft.questionBlockReview);
        await this.auditExecutableQuestions(approvedDraft.questionBlock);
        return approvedDraft;
      }
    }

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

    return { story, storyReview, questionBlock, questionBlockReview };
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
