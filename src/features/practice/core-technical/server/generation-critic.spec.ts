import { describe, expect, it, vi } from "vitest";

import {
  CORE_TECHNICAL_CRITIC_VERSION,
  type CoreTechnicalCriticDimension,
  type CoreTechnicalCriticTarget,
  type CoreTechnicalCriticVerdict
} from "@/features/practice/core-technical/domain/critic-contracts";
import {
  CORE_TECHNICAL_INTERVIEW_EVIDENCE,
  CORE_TECHNICAL_SOURCES,
  NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
} from "@/features/practice/core-technical/domain/interview-patterns";
import type { FrozenQuestionBlock } from "@/features/practice/core-technical/domain/question-contracts";
import type { GeneratedStoryCandidate } from "@/features/practice/core-technical/domain/story-contracts";
import type { AiService } from "@/server/ai/ai.service";

import {
  assertCoreTechnicalCriticApproval,
  CoreTechnicalGenerationCritic
} from "./generation-critic";

function verdict(
  target: CoreTechnicalCriticTarget,
  dimension: CoreTechnicalCriticDimension,
  overrides: Partial<CoreTechnicalCriticVerdict> = {}
): CoreTechnicalCriticVerdict {
  return {
    criticVersion: CORE_TECHNICAL_CRITIC_VERSION,
    target,
    dimension,
    verdict: "pass",
    score: 95,
    confidence: "high",
    summary:
      "The supplied asset meets the required quality threshold for this independent review dimension.",
    evidenceChecks: [
      {
        claim: "The generated asset preserves the selected catalogue mechanism accurately.",
        evidence:
          "The stage pattern key and its expected reasoning are consistent in the supplied generation contract.",
        passed: true
      },
      {
        claim: "The generated asset contains enough concrete evidence for this verdict.",
        evidence:
          "The story stages and referenced source metadata provide two independently checkable anchors.",
        passed: true
      }
    ],
    blockingIssues: [],
    requiredChanges: [],
    ...overrides
  };
}

function story(): GeneratedStoryCandidate {
  return {
    key: "critic-story",
    stages: [{ patternKey: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS[0]!.key }]
  } as GeneratedStoryCandidate;
}

function createCritic(
  createVerdict: (
    target: CoreTechnicalCriticTarget,
    dimension: CoreTechnicalCriticDimension
  ) => CoreTechnicalCriticVerdict = verdict
) {
  const generateStructured = vi.fn(
    async (request: { prompt: string; modelClass: string; temperature: number }) => {
      const prompt = JSON.parse(request.prompt) as {
        expectedTarget: CoreTechnicalCriticTarget;
        expectedDimensions: CoreTechnicalCriticDimension[];
      };
      return {
        verdicts: prompt.expectedDimensions.map((dimension) =>
          createVerdict(prompt.expectedTarget, dimension)
        )
      };
    }
  );
  const ai = { generateStructured } as unknown as Pick<AiService, "generateStructured">;
  return {
    generateStructured,
    critic: new CoreTechnicalGenerationCritic({
      ai,
      patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS,
      evidenceSources: CORE_TECHNICAL_INTERVIEW_EVIDENCE,
      technicalSources: CORE_TECHNICAL_SOURCES
    })
  };
}

describe("CoreTechnicalGenerationCritic", () => {
  it("reviews all four story dimensions in one model call", async () => {
    const { critic, generateStructured } = createCritic();

    const report = await critic.reviewStory(story());

    expect(report.approved).toBe(true);
    expect(report.verdicts.map((item) => item.dimension)).toEqual([
      "technical-correctness",
      "interview-relevance",
      "story-continuity",
      "difficulty"
    ]);
    expect(generateStructured).toHaveBeenCalledTimes(1);
    const request = generateStructured.mock.calls[0]![0];
    expect(request.modelClass).toBe("reasoning");
    expect(request.temperature).toBe(0);
    expect(request.prompt).toContain('"expectedDimensions"');
  });

  it("runs all five block critics including answer quality", async () => {
    const { critic, generateStructured } = createCritic();

    const report = await critic.reviewQuestionBlock(story(), {
      storyKey: "critic-story",
      questions: []
    } as unknown as FrozenQuestionBlock);

    expect(report.approved).toBe(true);
    expect(report.verdicts.map((item) => item.dimension)).toContain("answer-quality");
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a nominal pass is below its dimension threshold", async () => {
    const { critic } = createCritic((target, dimension) =>
      verdict(target, dimension, {
        score: dimension === "technical-correctness" ? 89 : 95
      })
    );

    const report = await critic.reviewStory(story());

    expect(report.approved).toBe(false);
    expect(() => assertCoreTechnicalCriticApproval(report)).toThrow("technical-correctness");
  });

  it("fails closed on a blocking issue or failed evidence check", async () => {
    const { critic } = createCritic((target, dimension) =>
      verdict(
        target,
        dimension,
        dimension === "story-continuity"
          ? {
              blockingIssues: [
                {
                  code: "decorative-story",
                  message:
                    "The questions remain unchanged when the production narrative is removed.",
                  stageKey: null,
                  questionKey: null
                }
              ]
            }
          : {}
      )
    );

    expect((await critic.reviewStory(story())).approved).toBe(false);
  });

  it("rejects a critic response for the wrong independent dimension", async () => {
    const { critic } = createCritic((target) => verdict(target, "technical-correctness"));

    await expect(critic.reviewStory(story())).rejects.toThrow("wrong target or dimension");
  });
});
