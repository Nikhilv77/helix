import { describe, expect, it, vi } from "vitest";

import { CORE_TECHNICAL_CATALOG_SCHEMA_VERSION } from "@/features/practice/core-technical/domain/contracts";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "@/features/practice/core-technical/domain/interview-patterns";
import {
  coreTechnicalLearningGuideFor,
  toPublicCoreTechnicalQuestion,
  type GeneratedQuestionCandidate
} from "@/features/practice/core-technical/domain/question-contracts";
import { coreTechnicalPracticePathBlueprint } from "@/features/practice/core-technical/domain/practice-path-blueprints";
import type { GeneratedStoryCandidate } from "@/features/practice/core-technical/domain/story-contracts";
import type { AiService } from "@/server/ai/ai.service";

import { CoreTechnicalQuestionGenerator } from "./question-generator";

function story(): GeneratedStoryCandidate {
  const blueprint = coreTechnicalPracticePathBlueprint("javascript-values-copying-mutation");
  if (!blueprint) throw new Error("Missing values-and-mutation question-generator fixture");
  return structuredClone(blueprint);
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
      "You are given production artifact " +
      order +
      ". Provide the exact reasoning needed to resolve this incident stage using variant " +
      variant +
      ". Explain the evidence aloud, identify the underlying mechanism, and propose the smallest safe correction.",
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
      learningGuide: {
        markdown:
          "## What is happening\nThe artifact exposes the runtime mechanism.\n\n## How to reason through it\nTrace ownership and execution in order.\n\n## A strong interview answer\nName the cause, evidence, and smallest safe repair.\n\n## What to avoid\n- Do not describe only the symptom.",
        diagram: {
          title: "Evidence to repair",
          steps: [
            { label: "Observe", detail: "Read the concrete runtime evidence." },
            { label: "Explain", detail: "Trace the mechanism in execution order." },
            { label: "Repair", detail: "Apply the smallest safe correction." }
          ]
        }
      },
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
  it("generates two candidates per stage and freezes one valid six-question block", async () => {
    const storyValue = story();
    const { generator, generateStructured } = createGenerator(storyValue);

    const block = await generator.generateDraftBlock(storyValue);

    expect(block.questions).toHaveLength(6);
    expect(new Set(block.questions.map((item) => item.patternKey)).size).toBe(6);
    expect(generateStructured).toHaveBeenCalledTimes(6);
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ modelClass: "reasoning" })
    );
  });

  it("does not expose private answers, rubrics, hints, or hidden tests", () => {
    const privateQuestion = question(story(), 5, "private");

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

  it("builds the complete learning guide contract for legacy frozen questions", () => {
    const legacyQuestion = question(story(), 3, "legacy");
    delete legacyQuestion.answer.learningGuide;

    const guide = coreTechnicalLearningGuideFor(legacyQuestion);
    const headings = [
      "## What is happening",
      "## How to reason through it",
      "## A strong interview answer",
      "## What to avoid"
    ];

    const positions = headings.map((heading) => guide.markdown.indexOf(heading));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(guide.diagram.steps.map(({ label }) => label)).toEqual([
      "Observe",
      "Explain",
      "Repair",
      "Verify"
    ]);
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
