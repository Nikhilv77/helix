import { describe, expect, it, vi } from "vitest";

import { CORE_TECHNICAL_CATALOG_SCHEMA_VERSION } from "@/lib/practice/core-technical/contracts";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "@/lib/practice/core-technical/interview-patterns";
import {
  toPublicCoreTechnicalQuestion,
  type GeneratedQuestionCandidate
} from "@/lib/practice/core-technical/question-contracts";
import type { GeneratedStoryCandidate } from "@/lib/practice/core-technical/story-contracts";
import type { AiService } from "@/server/ai/ai.service";

import { CoreTechnicalQuestionGenerator } from "./question-generator";

const stagePlan = [
  ["mcq", "javascript-identity-mutation-copy"],
  ["predict-explain", "javascript-event-loop-order"],
  ["written", "javascript-closure-lifetime"],
  ["spoken", "nodejs-worker-thread-isolation"],
  ["artifact-diagnosis", "nodejs-resource-leak-diagnosis"],
  ["debug-repair", "nodejs-commonjs-esm-boundary"],
  ["micro-implementation", "nodejs-stream-backpressure"],
  ["written", "javascript-async-error-propagation"]
] as const;

function story(): GeneratedStoryCandidate {
  return {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    key: "follow-the-operation",
    title: "Follow the operation through a production failure",
    premise:
      "A Node.js request passes through several asynchronous stages while customer traffic increases unexpectedly.",
    incident:
      "The latest release produces delayed responses, retained resources, and confusing output from one operation.",
    candidateRole:
      "Act as the backend engineer responsible for tracing the evidence and making a safe bounded repair.",
    primaryTopicKey: "async-scheduling",
    secondaryTopicKeys: [
      "javascript-values-and-mutation",
      "javascript-scope-and-closures",
      "nodejs-resource-lifecycle"
    ],
    mechanismKeys: ["event-loop", "reference-identity", "heap-retention", "resource-cleanup"],
    difficulty: "standard",
    prerequisiteTopicKeys: ["javascript-values-and-mutation"],
    expectedMinutes: 45,
    forbiddenTopicKeys: [],
    realismAnchors: [
      "The service has a reproducible latency increase under a bounded production-like workload.",
      "The incident supplies correlated logs and metrics from one failed customer operation.",
      "The final repair must preserve the existing downstream request and cleanup contract."
    ],
    targetFitExplanation:
      "The incident reflects the runtime ownership expected from a senior backend engineer.",
    coverageExplanation:
      "The sequence covers important JavaScript reasoning and its Node.js production consequences.",
    stages: stagePlan.map(([format, patternKey], index) => ({
      order: index + 1,
      key: "stage-" + (index + 1),
      title: "Trace incident stage " + (index + 1),
      format,
      patternKey,
      objective:
        "Use the current evidence to explain or repair the interview mechanism for this stage.",
      artifactKey: "artifact-" + (index + 1),
      storyDependency:
        "Use the concrete output retained from the preceding incident investigation step."
    }))
  };
}

function question(
  storyValue: GeneratedStoryCandidate,
  order: number,
  variant: string
): GeneratedQuestionCandidate {
  const stage = storyValue.stages[order - 1]!;
  const pattern = NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS.find(
    (item) => item.key === stage.patternKey
  )!;
  const executable = ["debug-repair", "micro-implementation"].includes(stage.format);
  const mcq = stage.format === "mcq";

  return {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    key: stage.key + "-candidate-" + variant,
    storyKey: storyValue.key,
    stageKey: stage.key,
    order,
    format: stage.format,
    patternKey: pattern.key,
    topicKeys: pattern.topicKeys,
    mechanismKeys: pattern.mechanismKeys,
    prompt:
      "Inspect production artifact " +
      order +
      " and provide the exact reasoning needed to resolve this incident stage using variant " +
      variant +
      ".",
    artifact: {
      kind: executable ? "code" : "scenario",
      title: "Evidence for incident stage " + order,
      content:
        "This artifact contains the operation evidence required to answer the current technical question."
    },
    ...(mcq
      ? {
          choices: [
            "The first technically plausible explanation",
            "The explanation consistent with the runtime mechanism",
            "A common but incorrect scheduling assumption"
          ]
        }
      : {}),
    hints: [
      "First identify which concrete values and runtime boundary control the observed behavior.",
      "Next trace the governing mechanism in execution order without assuming asynchronous means parallel.",
      "Finally connect that trace to the smallest repair and state its production consequence."
    ],
    answer: {
      concise:
        "The correct answer follows the referenced mechanism and preserves the operation's explicit lifecycle.",
      explanation:
        "A complete answer traces the mechanism from the supplied artifact, explains the observed result, and applies a bounded repair with cleanup.",
      ...(mcq ? { correctChoiceIndex: 1 } : {})
    },
    rubric: [
      {
        criterion: "Correctly identifies and traces the governing runtime or JavaScript mechanism.",
        points: 6
      },
      {
        criterion: "Connects the mechanism to a safe repair and its production consequences.",
        points: 4
      }
    ],
    commonMistakes: [
      "Describes the symptom without tracing the mechanism that actually produced the artifact."
    ],
    interviewerFollowUps: [
      "Explain how the solution behaves under failure, cancellation, and increased concurrency."
    ],
    interviewConnection:
      "This practical incident tests the same mechanism and reasoning expected in a standard technical interview.",
    ...(executable
      ? {
          starterCode: "export function repair(value) {\n  // Implement the bounded repair.\n}\n",
          referenceSolution:
            "export function repair(value) {\n  return Promise.resolve(value);\n}\n",
          publicTests: [
            {
              name: "handles normal input",
              input: "value",
              expected: "value",
              testCode: "return (await solution.repair('value')) === 'value';"
            }
          ],
          hiddenTests: [
            {
              name: "does not leak state",
              input: "second-value",
              expected: "second-value",
              testCode: "return (await solution.repair('second-value')) === 'second-value';"
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

function createGenerator(storyValue: GeneratedStoryCandidate) {
  const generateStructured = vi.fn(async (request: { operation: string }) => {
    const match = /stage-(\d+)/.exec(request.operation);
    const order = Number(match?.[1]);
    return {
      candidates: [question(storyValue, order, "a"), question(storyValue, order, "b")]
    };
  });
  const ai = { generateStructured } as unknown as Pick<AiService, "generateStructured">;
  return {
    generateStructured,
    generator: new CoreTechnicalQuestionGenerator({
      ai,
      patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS,
      concurrency: 2
    })
  };
}

describe("CoreTechnicalQuestionGenerator", () => {
  it("generates two candidates per stage and freezes one valid 8-question block", async () => {
    const storyValue = story();
    const { generator, generateStructured } = createGenerator(storyValue);

    const block = await generator.generateDraftBlock(storyValue);

    expect(block.questions).toHaveLength(8);
    expect(new Set(block.questions.map((item) => item.patternKey)).size).toBe(8);
    expect(generateStructured).toHaveBeenCalledTimes(8);
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ modelClass: "reasoning" })
    );
  });

  it("does not expose private answers, rubrics, hints, or hidden tests", () => {
    const privateQuestion = question(story(), 7, "private");

    const publicQuestion = toPublicCoreTechnicalQuestion(privateQuestion, false);

    expect(publicQuestion.interviewConnection).toBeUndefined();
    expect("answer" in publicQuestion).toBe(false);
    expect("rubric" in publicQuestion).toBe(false);
    expect("hints" in publicQuestion).toBe(false);
    expect("hiddenTests" in publicQuestion).toBe(false);
    expect("referenceSolution" in publicQuestion).toBe(false);
    expect("wrongSolutions" in publicQuestion).toBe(false);
    expect(publicQuestion.publicTests).toHaveLength(1);
  });

  it("reveals the interview connection only after an attempt", () => {
    const privateQuestion = question(story(), 1, "connection");

    expect(toPublicCoreTechnicalQuestion(privateQuestion, true).interviewConnection).toContain(
      "standard technical interview"
    );
  });

  it("rejects questions that introduce an unrelated mechanism", async () => {
    const storyValue = story();
    const { generator, generateStructured } = createGenerator(storyValue);
    generateStructured.mockImplementation(async (request: { operation: string }) => {
      const order = Number(/stage-(\d+)/.exec(request.operation)?.[1]);
      const first = question(storyValue, order, "a");
      const second = question(storyValue, order, "b");
      if (order === 3) {
        first.mechanismKeys = ["unrelated-mechanism"];
        second.mechanismKeys = ["unrelated-mechanism"];
      }
      return { candidates: [first, second] };
    });

    await expect(generator.generateDraftBlock(storyValue)).rejects.toThrow(
      "fewer than two valid candidates for story stage 3"
    );
  });
});
