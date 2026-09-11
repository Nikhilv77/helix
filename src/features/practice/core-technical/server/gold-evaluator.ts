import {
  CORE_TECHNICAL_GOLD_SET_VERSION,
  coreTechnicalGoldCaseSchema,
  coreTechnicalGoldEvaluationReportSchema,
  coreTechnicalGoldEvaluationSuiteReportSchema,
  type CoreTechnicalGoldCase,
  type CoreTechnicalGoldEvaluationReport,
  type CoreTechnicalGoldEvaluationSuiteReport
} from "@/features/practice/core-technical/domain/gold-evaluation-contracts";
import type { CoreTechnicalInterviewPattern } from "@/features/practice/core-technical/domain/contracts";
import { coreTechnicalCriticReportSchema } from "@/features/practice/core-technical/domain/critic-contracts";
import {
  frozenQuestionBlockSchema,
  toPublicCoreTechnicalQuestion
} from "@/features/practice/core-technical/domain/question-contracts";
import { generatedStoryCandidateSchema } from "@/features/practice/core-technical/domain/story-contracts";

import { isCoreTechnicalCriticReportApproved } from "./generation-critic";
import type { ReviewedCoreTechnicalDraft } from "./generation-pipeline";

const QUALITY_PASS_SCORE = 90;
const PRIVATE_PUBLIC_KEYS = new Set([
  "answer",
  "rubric",
  "hints",
  "hiddenTests",
  "wrongSolutions",
  "referenceSolution",
  "patternKey",
  "mechanismKeys",
  "interviewerFollowUps",
  "commonMistakes",
  "correctChoiceIndex"
]);

const STORY_CRITIC_DIMENSIONS = [
  "technical-correctness",
  "interview-relevance",
  "story-continuity",
  "difficulty"
] as const;
const BLOCK_CRITIC_DIMENSIONS = [
  ...STORY_CRITIC_DIMENSIONS.slice(0, 3),
  "answer-quality",
  "difficulty"
] as const;

type EvaluationOutput = Pick<
  ReviewedCoreTechnicalDraft,
  "story" | "storyReview" | "questionBlock" | "questionBlockReview"
>;

export class CoreTechnicalGoldEvaluator {
  constructor(
    private readonly dependencies: {
      patterns: CoreTechnicalInterviewPattern[];
    }
  ) {}

  evaluateCase(
    rawGoldCase: CoreTechnicalGoldCase,
    output: EvaluationOutput
  ): CoreTechnicalGoldEvaluationReport {
    const goldCase = coreTechnicalGoldCaseSchema.parse(rawGoldCase);
    const storyResult = generatedStoryCandidateSchema.safeParse(output.story);
    const blockResult = frozenQuestionBlockSchema.safeParse(output.questionBlock);
    const storyReviewResult = coreTechnicalCriticReportSchema.safeParse(output.storyReview);
    const blockReviewResult = coreTechnicalCriticReportSchema.safeParse(output.questionBlockReview);
    const hardFailures: string[] = [];
    const metrics: CoreTechnicalGoldEvaluationReport["metrics"] = [];

    const contractEarned =
      (storyResult.success ? 4 : 0) +
      (blockResult.success ? 4 : 0) +
      (storyReviewResult.success ? 3 : 0) +
      (blockReviewResult.success ? 4 : 0);
    metrics.push(
      metric("contract-validity", contractEarned, 15, [
        ...(!storyResult.success ? ["Story contract validation failed"] : []),
        ...(!blockResult.success ? ["Question-block contract validation failed"] : []),
        ...(!storyReviewResult.success ? ["Story critic report validation failed"] : []),
        ...(!blockReviewResult.success ? ["Question-block critic report validation failed"] : [])
      ])
    );
    if (contractEarned !== 15) {
      hardFailures.push("Generated output failed one or more frozen contracts");
    }

    const story = storyResult.success ? storyResult.data : null;
    const block = blockResult.success ? blockResult.data : null;

    const stageMatches = story
      ? story.stages.filter(
          (stage, index) => stage.patternKey === goldCase.expected.stagePatternKeys[index]
        ).length
      : 0;
    const titleMatches = story?.title === goldCase.expected.storyTitle;
    const expectedCount = goldCase.expected.stagePatternKeys.length;
    const stageBlueprintEarned = Math.round(
      ((stageMatches + (titleMatches ? 1 : 0)) / (expectedCount + 1)) * 15
    );
    metrics.push(
      metric("stage-blueprint", stageBlueprintEarned, 15, [
        ...(stageMatches !== expectedCount
          ? [stageMatches + ` of ${expectedCount} stage patterns match the gold blueprint`]
          : []),
        ...(!titleMatches ? ["Story title differs from the gold blueprint"] : [])
      ])
    );
    if (stageMatches !== expectedCount || !titleMatches) {
      hardFailures.push("Generated stages do not match the reviewed interview blueprint");
    }

    const selectedStoryTopics = story
      ? new Set([story.primaryTopicKey, ...story.secondaryTopicKeys])
      : new Set<string>();
    const topicMatches = goldCase.expected.requiredStoryTopicKeys.filter((topicKey) =>
      selectedStoryTopics.has(topicKey)
    ).length;
    const mechanismMatches = block
      ? block.questions.filter(
          (question, index) =>
            question.mechanismKeys[0] === goldCase.expected.requiredPrimaryMechanismKeys[index]
        ).length
      : 0;
    const coverageChecks =
      goldCase.expected.requiredStoryTopicKeys.length +
      goldCase.expected.requiredPrimaryMechanismKeys.length;
    const coverageEarned = Math.round(((topicMatches + mechanismMatches) / coverageChecks) * 15);
    metrics.push(
      metric("coverage", coverageEarned, 15, [
        ...(topicMatches !== goldCase.expected.requiredStoryTopicKeys.length
          ? ["One or more required story topics are missing"]
          : []),
        ...(mechanismMatches !== expectedCount
          ? [mechanismMatches + ` of ${expectedCount} primary mechanisms match`]
          : [])
      ])
    );

    const storyQualityChecks = story
      ? [
          story.difficulty === goldCase.expected.difficulty,
          story.expectedMinutes >= goldCase.expected.expectedMinutes.minimum &&
            story.expectedMinutes <= goldCase.expected.expectedMinutes.maximum,
          this.connectedStageCount(story) >= goldCase.expected.minimumConnectedStages,
          new Set(story.stages.map((stage) => stage.artifactKey)).size >=
            goldCase.expected.minimumUniqueArtifacts,
          new Set(story.realismAnchors).size >= 3
        ]
      : [false, false, false, false, false];
    const storyQualityEarned = storyQualityChecks.filter(Boolean).length * 2;
    metrics.push(
      metric("story-quality", storyQualityEarned, 10, [
        ...(!storyQualityChecks[0] ? ["Difficulty does not match the gold case"] : []),
        ...(!storyQualityChecks[1] ? ["Expected time is outside the gold range"] : []),
        ...(!storyQualityChecks[2] ? ["Too few stages connect to the declared story topics"] : []),
        ...(!storyQualityChecks[3]
          ? ["The incident does not evolve through enough unique artifacts"]
          : []),
        ...(!storyQualityChecks[4] ? ["The story lacks distinct production realism anchors"] : [])
      ])
    );
    if (!storyQualityChecks[0]) {
      hardFailures.push("Generated difficulty differs from the gold expectation");
    }

    const linkageMatches =
      story && block
        ? block.questions.filter((question, index) => {
            const stage = story.stages[index];
            return (
              stage !== undefined &&
              question.storyKey === story.key &&
              question.stageKey === stage.key &&
              question.order === stage.order &&
              question.format === stage.format &&
              question.patternKey === stage.patternKey
            );
          }).length
        : 0;
    const uniqueQuestionData = block
      ? new Set(block.questions.map((question) => question.key)).size === expectedCount &&
        new Set(block.questions.map((question) => question.prompt)).size === expectedCount &&
        new Set(block.questions.map((question) => question.mechanismKeys[0])).size === expectedCount
      : false;
    const executableEvidence = block
      ? block.questions.filter((question) =>
          ["debug-repair", "micro-implementation"].includes(question.format)
        ).length === 2 &&
        block.questions
          .filter((question) => ["debug-repair", "micro-implementation"].includes(question.format))
          .every((question) => {
            return Boolean(
              question.starterCode &&
              question.referenceSolution &&
              question.publicTests?.length &&
              question.hiddenTests?.length &&
              question.runnerContract
            );
          })
      : false;
    const questionIntegrityEarned =
      Math.round((linkageMatches / expectedCount) * 12) +
      (uniqueQuestionData ? 4 : 0) +
      (executableEvidence ? 4 : 0);
    metrics.push(
      metric("question-integrity", questionIntegrityEarned, 20, [
        ...(linkageMatches !== expectedCount
          ? [linkageMatches + ` of ${expectedCount} questions match their frozen story stage`]
          : []),
        ...(!uniqueQuestionData ? ["Question keys, prompts, or primary mechanisms repeat"] : []),
        ...(!executableEvidence ? ["Executable stages lack complete runner evidence"] : [])
      ])
    );
    if (linkageMatches !== expectedCount || !uniqueQuestionData || !executableEvidence) {
      hardFailures.push("Question-block integrity requirements failed");
    }

    const storyCriticsApproved =
      storyReviewResult.success &&
      storyReviewResult.data.target === "story" &&
      hasExactDimensions(
        storyReviewResult.data.verdicts.map((verdict) => verdict.dimension),
        STORY_CRITIC_DIMENSIONS
      ) &&
      isCoreTechnicalCriticReportApproved(storyReviewResult.data);
    const blockCriticsApproved =
      blockReviewResult.success &&
      blockReviewResult.data.target === "question-block" &&
      hasExactDimensions(
        blockReviewResult.data.verdicts.map((verdict) => verdict.dimension),
        BLOCK_CRITIC_DIMENSIONS
      ) &&
      isCoreTechnicalCriticReportApproved(blockReviewResult.data);
    metrics.push(
      metric(
        "critic-approval",
        (storyCriticsApproved ? 7 : 0) + (blockCriticsApproved ? 8 : 0),
        15,
        [
          ...(!storyCriticsApproved
            ? ["Story did not pass every required independent critic"]
            : []),
          ...(!blockCriticsApproved
            ? ["Question block did not pass every required independent critic"]
            : [])
        ]
      )
    );
    if (!storyCriticsApproved || !blockCriticsApproved) {
      hardFailures.push("Independent critic approval is incomplete or failed");
    }

    const publicSafetyPassed = block
      ? block.questions.every((question) => {
          const beforeAttempt = toPublicCoreTechnicalQuestion(question, false);
          const afterAttempt = toPublicCoreTechnicalQuestion(question, true);
          return (
            beforeAttempt.interviewConnection === undefined &&
            afterAttempt.interviewConnection === question.interviewConnection &&
            !containsForbiddenKey(beforeAttempt) &&
            !containsForbiddenKey(afterAttempt)
          );
        })
      : false;
    metrics.push(
      metric("public-safety", publicSafetyPassed ? 10 : 0, 10, [
        ...(!publicSafetyPassed
          ? ["A public question view exposed or misplaced private evaluation data"]
          : [])
      ])
    );
    if (!publicSafetyPassed) {
      hardFailures.push("Private question data is not safely separated");
    }

    const totalScore = metrics.reduce((sum, item) => sum + item.earned, 0);
    const qualityPassed = totalScore >= QUALITY_PASS_SCORE && hardFailures.length === 0;
    return coreTechnicalGoldEvaluationReportSchema.parse({
      goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
      caseKey: goldCase.key,
      qualityPassed,
      releaseEligible: qualityPassed && goldCase.review.status === "approved",
      humanReviewStatus: goldCase.review.status,
      totalScore,
      metrics,
      hardFailures
    });
  }

  evaluateSuite(
    cases: Array<{ goldCase: CoreTechnicalGoldCase; output: EvaluationOutput }>
  ): CoreTechnicalGoldEvaluationSuiteReport {
    if (cases.length === 0) {
      throw new Error("Core Technical gold evaluation requires at least one case");
    }
    const caseReports = cases.map(({ goldCase, output }) => this.evaluateCase(goldCase, output));
    const passed = caseReports.filter((report) => report.qualityPassed).length;
    return coreTechnicalGoldEvaluationSuiteReportSchema.parse({
      goldSetVersion: CORE_TECHNICAL_GOLD_SET_VERSION,
      qualityPassRate: Math.round((passed / caseReports.length) * 100),
      allQualityPassed: passed === caseReports.length,
      releaseEligible: caseReports.every((report) => report.releaseEligible),
      caseReports
    });
  }

  private connectedStageCount(
    story: NonNullable<ReturnType<typeof generatedStoryCandidateSchema.safeParse>["data"]>
  ): number {
    const selectedTopics = new Set([story.primaryTopicKey, ...story.secondaryTopicKeys]);
    const patternByKey = new Map(
      this.dependencies.patterns.map((pattern) => [pattern.key, pattern])
    );
    return story.stages.filter((stage) =>
      patternByKey.get(stage.patternKey)?.topicKeys.some((topicKey) => selectedTopics.has(topicKey))
    ).length;
  }
}

function metric(
  key: CoreTechnicalGoldEvaluationReport["metrics"][number]["key"],
  earned: number,
  available: number,
  findings: string[]
): CoreTechnicalGoldEvaluationReport["metrics"][number] {
  return { key, earned: Math.min(earned, available), available, findings };
}

function hasExactDimensions(actual: string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, nested]) => PRIVATE_PUBLIC_KEYS.has(key) || containsForbiddenKey(nested)
  );
}

export function assertCoreTechnicalGoldReleaseEligibility(
  report: CoreTechnicalGoldEvaluationReport | CoreTechnicalGoldEvaluationSuiteReport
): void {
  if (report.releaseEligible) return;
  throw new Error(
    "Core Technical gold evaluation is not release eligible; quality and human approval are both required"
  );
}
