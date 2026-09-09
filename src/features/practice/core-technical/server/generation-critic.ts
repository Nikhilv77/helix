import {
  CORE_TECHNICAL_CRITIC_VERSION,
  coreTechnicalCriticReportSchema,
  coreTechnicalCriticVerdictSchema,
  type CoreTechnicalCriticDimension,
  type CoreTechnicalCriticReport,
  type CoreTechnicalCriticTarget,
  type CoreTechnicalCriticVerdict
} from "@/features/practice/core-technical/domain/critic-contracts";
import type {
  CoreTechnicalInterviewPattern,
  InterviewEvidenceSource,
  TechnicalSource
} from "@/features/practice/core-technical/domain/contracts";
import type { FrozenQuestionBlock } from "@/features/practice/core-technical/domain/question-contracts";
import type { GeneratedStoryCandidate } from "@/features/practice/core-technical/domain/story-contracts";
import type { AiService } from "@/server/ai/ai.service";
import { z } from "zod";

const STORY_DIMENSIONS: CoreTechnicalCriticDimension[] = [
  "technical-correctness",
  "interview-relevance",
  "story-continuity",
  "difficulty"
];

const QUESTION_BLOCK_DIMENSIONS: CoreTechnicalCriticDimension[] = [
  "technical-correctness",
  "interview-relevance",
  "story-continuity",
  "answer-quality",
  "difficulty"
];

export const CORE_TECHNICAL_CRITIC_MINIMUM_SCORE: Record<CoreTechnicalCriticDimension, number> = {
  "technical-correctness": 90,
  "interview-relevance": 85,
  "story-continuity": 85,
  "answer-quality": 90,
  difficulty: 85
};

type GenerationCriticDependencies = {
  ai: Pick<AiService, "generateStructured">;
  patterns: CoreTechnicalInterviewPattern[];
  evidenceSources: InterviewEvidenceSource[];
  technicalSources: TechnicalSource[];
};

const criticBatchResponseSchema = z.object({
  verdicts: z.array(coreTechnicalCriticVerdictSchema).min(4).max(5)
});

export class CoreTechnicalGenerationCritic {
  constructor(private readonly dependencies: GenerationCriticDependencies) {}

  reviewStory(story: GeneratedStoryCandidate): Promise<CoreTechnicalCriticReport> {
    return this.review({
      target: "story",
      dimensions: STORY_DIMENSIONS,
      story
    });
  }

  reviewQuestionBlock(
    story: GeneratedStoryCandidate,
    questionBlock: FrozenQuestionBlock
  ): Promise<CoreTechnicalCriticReport> {
    return this.review({
      target: "question-block",
      dimensions: QUESTION_BLOCK_DIMENSIONS,
      story,
      questionBlock
    });
  }

  private async review(input: {
    target: CoreTechnicalCriticTarget;
    dimensions: CoreTechnicalCriticDimension[];
    story: GeneratedStoryCandidate;
    questionBlock?: FrozenQuestionBlock;
  }): Promise<CoreTechnicalCriticReport> {
    const sourceContext = this.sourceContext(input.story);
    const response = criticBatchResponseSchema.parse(
      await this.dependencies.ai.generateStructured({
        operation: "core-technical-critic-" + input.target,
        modelClass: "reasoning",
        temperature: 0,
        schema: criticBatchResponseSchema,
        systemInstruction: this.systemInstruction(),
        prompt: JSON.stringify({
          task: "Audit this generated Core Technical asset once and return one independent verdict for every requested dimension. Look for disqualifying errors, not stylistic preferences.",
          expectedTarget: input.target,
          expectedDimensions: input.dimensions,
          minimumPassingScores: Object.fromEntries(
            input.dimensions.map((dimension) => [
              dimension,
              CORE_TECHNICAL_CRITIC_MINIMUM_SCORE[dimension]
            ])
          ),
          dimensionInstructions: Object.fromEntries(
            input.dimensions.map((dimension) => [dimension, DIMENSION_INSTRUCTIONS[dimension]])
          ),
          story: input.story,
          questionBlock: input.questionBlock,
          sourceContext
        })
      })
    );
    const verdictByDimension = new Map(
      response.verdicts.map((verdict) => [verdict.dimension, verdict])
    );
    const verdicts = input.dimensions.map((dimension) => verdictByDimension.get(dimension));
    if (
      response.verdicts.length !== input.dimensions.length ||
      verdictByDimension.size !== input.dimensions.length ||
      verdicts.some(
        (verdict, index) =>
          !verdict ||
          verdict.target !== input.target ||
          verdict.dimension !== input.dimensions[index]
      )
    ) {
      throw new Error(
        "Core Technical critic returned a verdict for the wrong target or dimension"
      );
    }

    return coreTechnicalCriticReportSchema.parse({
      criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
      target: input.target,
      approved: verdicts.every(
        (verdict) => verdict !== undefined && isCoreTechnicalCriticVerdictPassing(verdict)
      ),
      verdicts
    });
  }

  private sourceContext(story: GeneratedStoryCandidate) {
    const patternKeys = new Set(story.stages.map((stage) => stage.patternKey));
    const patterns = this.dependencies.patterns.filter((pattern) => patternKeys.has(pattern.key));
    const evidenceIds = new Set(patterns.flatMap((pattern) => pattern.evidenceSourceIds));
    const technicalSourceIds = new Set(patterns.flatMap((pattern) => pattern.technicalSourceIds));

    return {
      patterns,
      interviewEvidence: this.dependencies.evidenceSources.filter((source) =>
        evidenceIds.has(source.id)
      ),
      technicalSources: this.dependencies.technicalSources.filter((source) =>
        technicalSourceIds.has(source.id)
      )
    };
  }

  private systemInstruction(): string {
    return [
      "You are an independent Core Technical generation critic.",
      "Review every requested dimension independently inside one response; do not let a pass in one dimension hide a failure in another.",
      "Use the supplied pattern catalogue and source metadata as the authority boundary.",
      "Fail on any factual error, answer leak, invented mechanism, broken story dependency, unsupported stack detail, trivialized interview pattern, misleading rubric, or material difficulty mismatch relevant to a requested dimension.",
      "Every conclusion must cite concrete evidence from the supplied asset or catalogue in evidenceChecks.",
      "A pass requires zero blocking issues, every evidence check passing, and the minimum score supplied in the prompt.",
      "Return exactly one verdict for every requested dimension and no others. Set target and dimension exactly as requested. Return only data matching the supplied schema."
    ].join(" ");
  }
}

const DIMENSION_INSTRUCTIONS: Record<CoreTechnicalCriticDimension, string> = {
  "technical-correctness":
    "Trace the runtime mechanisms, expected answers, code, tests, cleanup, and production claims for technical accuracy and internal consistency.",
  "interview-relevance":
    "Verify every stage preserves a documented interview pattern's reasoning, importance, expected signals, and follow-up depth without copying source wording.",
  "story-continuity":
    "Verify the incident evolves coherently, every stage needs its named evidence or prior artifact, and removing the narrative would materially change the questions.",
  "answer-quality":
    "Verify answers are complete and concise, hints are genuinely progressive, rubrics discriminate understanding, distractors reflect real misconceptions, and tests match the reference behavior.",
  difficulty:
    "Verify the reasoning depth, workload, hints, artifacts, and expected time match the declared level consistently across all eight stages."
};

export function isCoreTechnicalCriticVerdictPassing(verdict: CoreTechnicalCriticVerdict): boolean {
  return (
    verdict.verdict === "pass" &&
    verdict.score >= CORE_TECHNICAL_CRITIC_MINIMUM_SCORE[verdict.dimension] &&
    verdict.blockingIssues.length === 0 &&
    verdict.evidenceChecks.every((check) => check.passed)
  );
}

export function assertCoreTechnicalCriticApproval(report: CoreTechnicalCriticReport): void {
  if (isCoreTechnicalCriticReportApproved(report)) return;
  const failedDimensions = report.verdicts
    .filter((verdict) => !isCoreTechnicalCriticVerdictPassing(verdict))
    .map((verdict) => verdict.dimension);
  throw new Error(
    "Core Technical generation failed independent review: " + failedDimensions.join(", ")
  );
}

export function isCoreTechnicalCriticReportApproved(report: CoreTechnicalCriticReport): boolean {
  return report.approved && report.verdicts.every(isCoreTechnicalCriticVerdictPassing);
}
