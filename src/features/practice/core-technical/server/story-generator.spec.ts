import { describe, expect, it, vi } from "vitest";

import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "@/features/practice/core-technical/domain/interview-patterns";
import {
  CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
  type CoreTechnicalInterviewPattern
} from "@/features/practice/core-technical/domain/contracts";
import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "@/features/practice/core-technical/domain/gold-cases";
import type { GeneratedStoryCandidate } from "@/features/practice/core-technical/domain/story-contracts";
import type { AiService } from "@/server/ai/ai.service";

import { CoreTechnicalStoryGenerator } from "./story-generator";

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

function candidate(
  key: string,
  options: {
    primaryTopicKey?: string;
    secondaryTopicKeys?: string[];
    mechanismKeys?: string[];
    realismAnchors?: string[];
  } = {}
): GeneratedStoryCandidate {
  return {
    schemaVersion: CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
    key,
    title: "A production operation loses control",
    premise:
      "The candidate owns a Node.js service that processes customer operations through several asynchronous stages.",
    incident:
      "A routine release creates inconsistent state, rising memory, and delayed responses during a traffic spike.",
    candidateRole:
      "Act as the on-call backend engineer who must trace the operation and make the smallest safe repair.",
    primaryTopicKey: options.primaryTopicKey ?? "async-scheduling",
    secondaryTopicKeys: options.secondaryTopicKeys ?? [
      "javascript-values-and-mutation",
      "javascript-scope-and-closures",
      "nodejs-resource-lifecycle"
    ],
    mechanismKeys: options.mechanismKeys ?? [
      "event-loop",
      "microtask-queue",
      "heap-retention",
      "resource-cleanup"
    ],
    difficulty: "standard",
    prerequisiteTopicKeys: ["javascript-values-and-mutation"],
    expectedMinutes: 45,
    forbiddenTopicKeys: [],
    realismAnchors: options.realismAnchors ?? [
      "The service exposes an observable latency increase under a reproducible workload.",
      "The incident includes logs and metrics captured from the same failed operation.",
      "The repair must preserve a concrete downstream API and its cleanup behavior."
    ],
    targetFitExplanation:
      "The incident exercises everyday backend ownership and production reasoning for the target role.",
    coverageExplanation:
      "The stages combine high-priority JavaScript mechanisms with Node.js runtime consequences seen in interviews.",
    stages: stagePlan.map(([format, patternKey], index) => ({
      order: index + 1,
      key: "stage-" + (index + 1),
      title: "Investigate operation stage " + (index + 1),
      format,
      patternKey,
      objective:
        "Use the current incident evidence to demonstrate the selected interview mechanism accurately.",
      artifactKey: "artifact-" + (index + 1),
      storyDependency:
        "This stage uses the operation evidence produced by the immediately preceding investigation step."
    }))
  };
}

function createGenerator(
  response: { candidates: GeneratedStoryCandidate[] },
  patterns: CoreTechnicalInterviewPattern[] = NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
) {
  const generateStructured = vi.fn().mockResolvedValue(response);
  const ai = { generateStructured } as unknown as Pick<AiService, "generateStructured">;

  return {
    generateStructured,
    generator: new CoreTechnicalStoryGenerator({
      ai,
      domainMap: NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
      patterns
    })
  };
}

const validInput = {
  role: "backend",
  seniority: "senior" as const,
  language: "javascript",
  runtime: "nodejs",
  targetJob: "Senior Backend Engineer",
  baselineState: "STANDARD" as const,
  weakMechanismKeys: ["event-loop", "microtask-queue"],
  unassessedMechanismKeys: ["heap-retention"],
  recentTopicKeys: ["javascript-modules"]
};

describe("CoreTechnicalStoryGenerator", () => {
  it("uses the reasoning model and selects the strongest valid candidate", async () => {
    const broad = candidate("broad-operation-story");
    const repeated = candidate("repeated-operation-story");
    repeated.stages[7] = {
      ...repeated.stages[7]!,
      patternKey: repeated.stages[0]!.patternKey
    };
    const weak = candidate("weak-operation-story", {
      mechanismKeys: ["commonjs", "esm", "package-exports", "shallow-copy"],
      realismAnchors: [
        "The module error appears only after a realistic production deployment change.",
        "The package manifest and runtime error are available as concrete evidence.",
        "The proposed repair must retain compatibility with an existing consumer."
      ]
    });
    const { generator, generateStructured } = createGenerator({
      candidates: [weak, repeated, broad]
    });

    const result = await generator.generate(validInput);

    expect(result.key).toBe("broad-operation-story");
    expect(result.stages).toHaveLength(8);
    expect(result.score.total).toBeGreaterThan(0);
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "core-technical-story-candidates",
        modelClass: "reasoning"
      })
    );
  });

  it("rejects a stack that the domain map does not support", async () => {
    const { generator, generateStructured } = createGenerator({
      candidates: [candidate("one-story"), candidate("two-story"), candidate("three-story")]
    });

    await expect(generator.generate({ ...validInput, runtime: "python" })).rejects.toThrow(
      "does not match"
    );
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("fails closed when every generated candidate violates catalogue rules", async () => {
    const candidates = ["one-story", "two-story", "three-story"].map((key) => {
      const item = candidate(key);
      item.stages[7] = {
        ...item.stages[7]!,
        patternKey: item.stages[0]!.patternKey
      };
      return item;
    });
    const { generator } = createGenerator({ candidates });

    await expect(generator.generate(validInput)).rejects.toThrow("no candidate that passed");
  });

  it("requests one candidate when a reviewed story contract fixes the creative decision", async () => {
    const goldCase = NODEJS_CORE_TECHNICAL_GOLD_CASES[0]!;
    const reviewedCandidate = candidate("reviewed-story", {
      primaryTopicKey: goldCase.expected.requiredStoryTopicKeys[0],
      secondaryTopicKeys: goldCase.expected.requiredStoryTopicKeys.slice(1)
    });
    reviewedCandidate.title = goldCase.expected.storyTitle;
    reviewedCandidate.difficulty = "guided";
    reviewedCandidate.stages = reviewedCandidate.stages.map((stage, index) => ({
      ...stage,
      patternKey: goldCase.expected.stagePatternKeys[index]!
    }));
    const { generator, generateStructured } = createGenerator({
      candidates: [reviewedCandidate]
    });

    await expect(
      generator.generate({
        ...goldCase.candidateContext,
        reviewedContract: {
          storyTitle: goldCase.expected.storyTitle,
          stagePatternKeys: goldCase.expected.stagePatternKeys,
          requiredStoryTopicKeys: goldCase.expected.requiredStoryTopicKeys
        }
      })
    ).resolves.toMatchObject({ title: goldCase.expected.storyTitle });

    const aiRequest = generateStructured.mock.calls[0]?.[0];
    expect(aiRequest.schema.safeParse({ candidates: [reviewedCandidate] }).success).toBe(true);
    expect(
      aiRequest.schema.safeParse({ candidates: [reviewedCandidate, reviewedCandidate] }).success
    ).toBe(false);
  });
});
