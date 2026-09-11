import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";

import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "../src/features/practice/core-technical/domain/gold-cases";
import {
  coreTechnicalStoryReviewArtifactSchema,
  type CoreTechnicalStoryReviewArtifact
} from "../src/features/practice/core-technical/domain/review-artifact-contracts";
import { NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS } from "../src/features/practice/core-technical/domain/practice-path-blueprints";
import { getAppContainer } from "../src/server/app-container";

const REVIEW_ARTIFACT_DIRECTORY = path.resolve(
  process.cwd(),
  "src/features/practice/core-technical/domain/generated"
);

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const writeArtifacts = arguments_.includes("--write");
  const requestedCaseKey = arguments_.find((argument) => !argument.startsWith("--"));
  const selectedCases = arguments_.includes("--all")
    ? NODEJS_CORE_TECHNICAL_GOLD_CASES
    : [
        requestedCaseKey
          ? NODEJS_CORE_TECHNICAL_GOLD_CASES.find((candidate) => candidate.key === requestedCaseKey)
          : NODEJS_CORE_TECHNICAL_GOLD_CASES[0]
      ].filter((candidate) => candidate !== undefined);

  if (selectedCases.length === 0) {
    const available = NODEJS_CORE_TECHNICAL_GOLD_CASES.map((candidate) => candidate.key).join(", ");
    throw new Error("Unknown Core Technical gold case. Available cases: " + available);
  }

  const container = getAppContainer();
  const summaries = [];

  for (const goldCase of selectedCases) {
    const blueprint = NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS.find(
      (candidate) => candidate.title === goldCase.expected.storyTitle
    );
    if (!blueprint) throw new Error(`No active blueprint matches ${goldCase.key}`);
    const draft = await container.coreTechnicalGenerationPipeline.prepareReviewedDraft({
      ...goldCase.candidateContext,
      reviewedContract: {
        storyKey: blueprint.key,
        storyTitle: goldCase.expected.storyTitle,
        stagePatternKeys: goldCase.expected.stagePatternKeys,
        requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
      }
    });
    const evaluation = container.coreTechnicalGoldEvaluator.evaluateCase(goldCase, draft);
    const artifact = coreTechnicalStoryReviewArtifactSchema.parse({
      goldSetVersion: goldCase.goldSetVersion,
      caseKey: goldCase.key,
      generatedAt: new Date().toISOString(),
      ...draft,
      evaluation,
      humanReview: {
        status: "candidate",
        reviewerId: null,
        reviewedAt: null,
        notes: [
          "Generated output awaits human review of all prompts, private answers, hints, rubrics, tests, and production claims."
        ]
      }
    });

    const artifactPath = writeArtifacts ? await writeReviewArtifact(artifact) : undefined;
    summaries.push(safeSummary(artifact, artifactPath));
  }

  process.stdout.write(
    JSON.stringify(summaries.length === 1 ? summaries[0] : summaries, null, 2) + "\n"
  );
}

async function writeReviewArtifact(artifact: CoreTechnicalStoryReviewArtifact): Promise<string> {
  await mkdir(REVIEW_ARTIFACT_DIRECTORY, { recursive: true });
  const artifactPath = path.join(REVIEW_ARTIFACT_DIRECTORY, artifact.caseKey + ".json");
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  return path.relative(process.cwd(), artifactPath);
}

function safeSummary(artifact: CoreTechnicalStoryReviewArtifact, artifactPath?: string) {
  return {
    caseKey: artifact.caseKey,
    goldReviewStatus: artifact.evaluation.humanReviewStatus,
    generatedStoryReviewStatus: artifact.humanReview.status,
    artifactPath,
    story: {
      key: artifact.story.key,
      title: artifact.story.title,
      difficulty: artifact.story.difficulty,
      expectedMinutes: artifact.story.expectedMinutes,
      primaryTopicKey: artifact.story.primaryTopicKey,
      secondaryTopicKeys: artifact.story.secondaryTopicKeys,
      stages: artifact.story.stages.map((stage) => ({
        order: stage.order,
        title: stage.title,
        format: stage.format,
        patternKey: stage.patternKey,
        artifactKey: stage.artifactKey
      }))
    },
    questions: artifact.questionBlock.questions.map((question) => ({
      order: question.order,
      key: question.key,
      format: question.format,
      patternKey: question.patternKey,
      mechanismKeys: question.mechanismKeys,
      publicTestCount: question.publicTests?.length ?? 0,
      hiddenTestCount: question.hiddenTests?.length ?? 0,
      hasRunnerContract: Boolean(question.runnerContract)
    })),
    criticScores: {
      story: Object.fromEntries(
        artifact.storyReview.verdicts.map((verdict) => [verdict.dimension, verdict.score])
      ),
      questionBlock: Object.fromEntries(
        artifact.questionBlockReview.verdicts.map((verdict) => [verdict.dimension, verdict.score])
      )
    },
    evaluation: artifact.evaluation
  };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write("Core Technical generation failed: " + message + "\n");
  const cause = error && typeof error === "object" && "cause" in error ? error.cause : undefined;
  if (cause instanceof ZodError) {
    const issues = cause.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    process.stderr.write("Schema issues: " + JSON.stringify(issues, null, 2) + "\n");
  } else if (cause && typeof cause === "object") {
    const diagnostic = {
      name: "name" in cause ? String(cause.name) : undefined,
      status: "status" in cause ? String(cause.status) : undefined,
      message: "message" in cause ? String(cause.message).slice(0, 700) : undefined
    };
    process.stderr.write("Provider diagnostic: " + JSON.stringify(diagnostic, null, 2) + "\n");
  }
  process.exitCode = 1;
});
