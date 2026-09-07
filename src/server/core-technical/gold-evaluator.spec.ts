import { describe, expect, it } from "vitest";

import {
  CORE_TECHNICAL_CRITIC_VERSION,
  type CoreTechnicalCriticDimension,
  type CoreTechnicalCriticReport
} from "@/lib/practice/core-technical/critic-contracts";
import type { CoreTechnicalGoldCase } from "@/lib/practice/core-technical/gold-evaluation-contracts";
import { coreTechnicalGoldCaseSchema } from "@/lib/practice/core-technical/gold-evaluation-contracts";
import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "@/lib/practice/core-technical/gold-cases";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "@/lib/practice/core-technical/interview-patterns";
import {
  CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
  type CoreTechnicalInterviewPattern
} from "@/lib/practice/core-technical/contracts";
import type {
  FrozenQuestionBlock,
  GeneratedQuestionCandidate
} from "@/lib/practice/core-technical/question-contracts";
import {
  REQUIRED_STORY_STAGE_FORMATS,
  type SelectedCoreTechnicalStory
} from "@/lib/practice/core-technical/story-contracts";

import {
  assertCoreTechnicalGoldReleaseEligibility,
  CoreTechnicalGoldEvaluator
} from "./gold-evaluator";

const patternByKey = new Map(
  NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS.map((pattern) => [pattern.key, pattern])
);

function approvedGoldCase(goldCase: CoreTechnicalGoldCase) {
  return coreTechnicalGoldCaseSchema.parse({
    ...goldCase,
    review: {
      status: "approved",
      reviewerId: "human-reviewer",
      reviewedAt: "2026-09-06",
      notes: [
        "The reviewer verified the technical mechanisms, interview value, progression, and expected difficulty."
      ]
    }
  });
}

function criticReport(
  target: "story" | "question-block",
  options: { lowTechnicalScore?: boolean } = {}
): CoreTechnicalCriticReport {
  const dimensions: CoreTechnicalCriticDimension[] =
    target === "story"
      ? ["technical-correctness", "interview-relevance", "story-continuity", "difficulty"]
      : [
          "technical-correctness",
          "interview-relevance",
          "story-continuity",
          "answer-quality",
          "difficulty"
        ];
  return {
    criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
    target,
    approved: true,
    verdicts: dimensions.map((dimension) => ({
      criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
      target,
      dimension,
      verdict: "pass",
      score: options.lowTechnicalScore && dimension === "technical-correctness" ? 70 : 95,
      confidence: "high",
      summary:
        "The generated material satisfies this independent benchmark review dimension with concrete evidence.",
      evidenceChecks: [
        {
          claim: "The generated mechanism matches the reviewed interview pattern.",
          evidence:
            "The question identifiers, expected reasoning, and answer explanation agree with the catalogue.",
          passed: true
        },
        {
          claim: "The generated stage uses the evolving incident evidence directly.",
          evidence:
            "The prompt and artifact preserve the dependency declared by the reviewed story stage.",
          passed: true
        }
      ],
      blockingIssues: [],
      requiredChanges: []
    }))
  };
}

function formatForStage(pattern: CoreTechnicalInterviewPattern, index: number) {
  const allowed = REQUIRED_STORY_STAGE_FORMATS[index] ?? [];
  const format = pattern.formats.find((item) => allowed.includes(item as never));
  if (!format) throw new Error("Gold fixture pattern has no valid stage format");
  return format;
}

function generatedOutput(goldCase: CoreTechnicalGoldCase) {
  const storyKey = goldCase.key + "-output";
  const stages = goldCase.expected.stagePatternKeys.map((patternKey, index) => {
    const pattern = patternByKey.get(patternKey)!;
    return {
      order: index + 1,
      key: "stage-" + (index + 1),
      title: "Investigate production stage " + (index + 1),
      format: formatForStage(pattern, index),
      patternKey,
      objective:
        "Use the current production evidence to explain or repair the exact reviewed interview mechanism.",
      artifactKey: "incident-artifact-" + (index + 1),
      storyDependency:
        "This stage depends on the concrete evidence produced by the preceding operation investigation."
    };
  });
  const story: SelectedCoreTechnicalStory = {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    key: storyKey,
    title: goldCase.expected.storyTitle,
    premise:
      "A Node.js backend operation crosses asynchronous boundaries while traffic and downstream latency increase.",
    incident:
      "The latest release produces inconsistent output, delayed responses, and resources that remain active unexpectedly.",
    candidateRole:
      "Own the incident as the backend engineer, explain each mechanism, and make the smallest production-safe repair.",
    primaryTopicKey: goldCase.expected.requiredStoryTopicKeys[0]!,
    secondaryTopicKeys: goldCase.expected.requiredStoryTopicKeys.slice(1),
    mechanismKeys: goldCase.expected.requiredPrimaryMechanismKeys,
    difficulty: goldCase.expected.difficulty,
    prerequisiteTopicKeys: [],
    expectedMinutes: 45,
    forbiddenTopicKeys: goldCase.candidateContext.excludedTopicKeys,
    realismAnchors: [
      "Correlated request logs show the same operation crossing each asynchronous boundary.",
      "Runtime metrics expose latency, active resources, and memory behavior under a bounded load.",
      "The repair must preserve an existing downstream contract and explicit cleanup ownership."
    ],
    targetFitExplanation:
      "The work reflects the runtime reasoning and production ownership required by the target backend role.",
    coverageExplanation:
      "The sequence covers eight distinct source-backed interview mechanisms through one evolving operation.",
    stages,
    score: {
      domainImportance: 20,
      realism: 15,
      interviewDensity: 20,
      coherence: 15,
      stackFit: 15,
      personalizedCoverage: 15,
      total: 100
    },
    selectionReason:
      "Selected because the story covers the candidate's weak and unassessed mechanisms for the target role."
  };
  const questions = stages.map((stage, index) =>
    generatedQuestion(story, stage, patternByKey.get(stage.patternKey)!, index)
  );
  const questionBlock: FrozenQuestionBlock = {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    storyKey,
    questions
  };
  return {
    story,
    storyReview: criticReport("story"),
    questionBlock,
    questionBlockReview: criticReport("question-block")
  };
}

function generatedQuestion(
  story: SelectedCoreTechnicalStory,
  stage: SelectedCoreTechnicalStory["stages"][number],
  pattern: CoreTechnicalInterviewPattern,
  index: number
): GeneratedQuestionCandidate {
  const executable = ["debug-repair", "micro-implementation"].includes(stage.format);
  const mcq = stage.format === "mcq";
  return {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    key: "gold-question-" + (index + 1),
    storyKey: story.key,
    stageKey: stage.key,
    order: stage.order,
    format: stage.format,
    patternKey: pattern.key,
    topicKeys: pattern.topicKeys,
    mechanismKeys: pattern.mechanismKeys,
    prompt:
      "Inspect incident artifact " +
      (index + 1) +
      " and provide the reasoning required to resolve this production stage.",
    artifact: {
      kind: executable ? "code" : "scenario",
      title: "Incident evidence for stage " + (index + 1),
      content:
        "The artifact contains concrete runtime evidence from the same operation and must be used in the answer."
    },
    ...(mcq
      ? {
          choices: [
            "A plausible answer based on a common misconception",
            "The answer consistent with the reviewed runtime mechanism",
            "An answer that describes the symptom but not its cause"
          ]
        }
      : {}),
    hints: [
      "Start by identifying the exact runtime boundary and values visible in this artifact.",
      "Trace the reviewed mechanism in execution order and connect it to the observed symptom.",
      "State the smallest safe correction and include its cleanup or failure consequence."
    ],
    answer: {
      concise:
        "The correct response traces the reviewed mechanism and preserves explicit lifecycle ownership.",
      explanation:
        "A complete response uses the supplied evidence, explains why the mechanism produces the result, and gives a bounded repair with production consequences.",
      ...(mcq ? { correctChoiceIndex: 1 } : {})
    },
    rubric: [
      {
        criterion: "Correctly identifies and traces the governing JavaScript or Node.js mechanism.",
        points: 6
      },
      {
        criterion: "Connects the mechanism to a safe repair and realistic production consequences.",
        points: 4
      }
    ],
    commonMistakes: [
      "Describes the visible symptom without tracing the mechanism that produced the supplied artifact."
    ],
    interviewerFollowUps: [
      "Explain how the proposed behavior changes under failure, cancellation, and increased concurrency."
    ],
    interviewConnection:
      "This incident tests the same technical reasoning expected from the referenced interview pattern.",
    ...(executable
      ? {
          starterCode:
            "export async function repair(value) {\n  // Implement the bounded repair.\n}\n",
          referenceSolution:
            "export async function repair(value) {\n  return await Promise.resolve(value);\n}\n",
          publicTests: [
            {
              name: "returns normal value",
              input: "normal",
              expected: "normal",
              testCode: "return (await solution.repair('normal')) === 'normal';"
            }
          ],
          hiddenTests: [
            {
              name: "preserves second value",
              input: "second",
              expected: "second",
              testCode: "return (await solution.repair('second')) === 'second';"
            }
          ],
          wrongSolutions: [
            {
              name: "drops the value",
              code: "export async function repair() { return undefined; }"
            }
          ],
          runnerContract: {
            language: "javascript",
            runtime: "nodejs",
            runtimeVersion: "22",
            entrypoint: "solution.mjs",
            timeoutMs: 1_000,
            memoryMb: 64,
            networkAccess: false
          }
        }
      : {})
  };
}

describe("CoreTechnicalGoldEvaluator", () => {
  const evaluator = new CoreTechnicalGoldEvaluator({
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
  });

  it("scores a conforming candidate benchmark without claiming human approval", () => {
    const goldCase = candidateGoldCase(NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!);

    const report = evaluator.evaluateCase(goldCase, generatedOutput(goldCase));

    expect(report.qualityPassed).toBe(true);
    expect(report.totalScore).toBe(100);
    expect(report.humanReviewStatus).toBe("candidate");
    expect(report.releaseEligible).toBe(false);
    expect(() => assertCoreTechnicalGoldReleaseEligibility(report)).toThrow("human approval");
  });

  it("allows release certification only after a human attestation", () => {
    const goldCase = approvedGoldCase(NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!);

    const report = evaluator.evaluateCase(goldCase, generatedOutput(goldCase));

    expect(report.releaseEligible).toBe(true);
    expect(() => assertCoreTechnicalGoldReleaseEligibility(report)).not.toThrow();
  });

  it("fails a generated story that departs from the gold stage blueprint", () => {
    const goldCase = NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!;
    const output = generatedOutput(goldCase);
    output.story.stages[0]!.patternKey = "nodejs-commonjs-esm-boundary";

    const report = evaluator.evaluateCase(goldCase, output);

    expect(report.qualityPassed).toBe(false);
    expect(report.hardFailures).toContain(
      "Generated stages do not match the reviewed interview blueprint"
    );
  });

  it("recomputes critic thresholds instead of trusting an approved boolean", () => {
    const goldCase = NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!;
    const output = generatedOutput(goldCase);
    output.storyReview = criticReport("story", { lowTechnicalScore: true });

    const report = evaluator.evaluateCase(goldCase, output);

    expect(report.qualityPassed).toBe(false);
    expect(report.hardFailures).toContain("Independent critic approval is incomplete or failed");
  });

  it("evaluates the complete two-case benchmark suite", () => {
    const cases = NODEJS_CORE_TECHNICAL_GOLD_CASES.map((item) => approvedGoldCase(item));

    const report = evaluator.evaluateSuite(
      cases.map((goldCase) => ({
        goldCase,
        output: generatedOutput(goldCase)
      }))
    );

    expect(report.qualityPassRate).toBe(100);
    expect(report.allQualityPassed).toBe(true);
    expect(report.releaseEligible).toBe(true);
    expect(report.caseReports).toHaveLength(2);
  });
});

function candidateGoldCase(goldCase: CoreTechnicalGoldCase): CoreTechnicalGoldCase {
  return {
    ...structuredClone(goldCase),
    review: {
      status: "candidate",
      reviewerId: null,
      reviewedAt: null,
      notes: ["This fixture deliberately exercises the fail-closed pre-approval evaluation path."]
    }
  };
}
