import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "@/features/practice/core-technical/domain/gold-cases";
import type {
  CoreTechnicalGoldCase,
  CoreTechnicalGoldEvaluationSuiteReport
} from "@/features/practice/core-technical/domain/gold-evaluation-contracts";
import { NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS } from "@/features/practice/core-technical/domain/practice-path-blueprints";

import type { CoreTechnicalGenerationPipeline } from "./generation-pipeline";
import type { CoreTechnicalGoldEvaluator } from "./gold-evaluator";

type GoldEvaluationRunnerDependencies = {
  generationPipeline: Pick<CoreTechnicalGenerationPipeline, "prepareReviewedDraft">;
  evaluator: Pick<CoreTechnicalGoldEvaluator, "evaluateSuite">;
};

export class CoreTechnicalGoldEvaluationRunner {
  constructor(private readonly dependencies: GoldEvaluationRunnerDependencies) {}

  async run(
    cases: CoreTechnicalGoldCase[] = NODEJS_CORE_TECHNICAL_GOLD_CASES
  ): Promise<CoreTechnicalGoldEvaluationSuiteReport> {
    const completed = [];

    // Keep cases sequential: one case already performs multiple bounded model
    // calls, and benchmark reproducibility matters more than burst throughput.
    for (const goldCase of cases) {
      const blueprint = NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS.find(
        (candidate) => candidate.title === goldCase.expected.storyTitle
      );
      if (!blueprint) throw new Error(`No active blueprint matches ${goldCase.key}`);
      const output = await this.dependencies.generationPipeline.prepareReviewedDraft({
        ...goldCase.candidateContext,
        reviewedContract: {
          storyKey: blueprint.key,
          storyTitle: goldCase.expected.storyTitle,
          stagePatternKeys: goldCase.expected.stagePatternKeys,
          requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
        }
      });
      completed.push({ goldCase, output });
    }

    return this.dependencies.evaluator.evaluateSuite(completed);
  }
}
