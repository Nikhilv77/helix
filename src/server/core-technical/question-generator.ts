import { z } from "zod";

import {
  frozenQuestionBlockSchema,
  generatedQuestionCandidateSchema,
  generatedStageQuestionCandidatesWireSchema,
  type FrozenQuestionBlock,
  type GeneratedQuestionCandidate
} from "@/lib/practice/core-technical/question-contracts";
import {
  generatedStoryCandidateSchema,
  type GeneratedStoryCandidate
} from "@/lib/practice/core-technical/story-contracts";
import type { CoreTechnicalInterviewPattern } from "@/lib/practice/core-technical/contracts";
import type { AiService } from "@/server/ai/ai.service";

type QuestionGeneratorDependencies = {
  ai: Pick<AiService, "generateStructured">;
  patterns: CoreTechnicalInterviewPattern[];
  concurrency?: number;
};

export class CoreTechnicalQuestionGenerator {
  private readonly concurrency: number;

  constructor(private readonly dependencies: QuestionGeneratorDependencies) {
    this.concurrency = Math.max(1, Math.min(4, dependencies.concurrency ?? 2));
  }

  async generateDraftBlock(
    rawStory: GeneratedStoryCandidate,
    options: { normalizeReviewedMetadata?: boolean } = {}
  ): Promise<FrozenQuestionBlock> {
    const story = generatedStoryCandidateSchema.parse(rawStory);
    const patternByKey = new Map(
      this.dependencies.patterns.map((pattern) => [pattern.key, pattern])
    );

    const questions = await mapWithConcurrency(story.stages, this.concurrency, async (stage) => {
      const pattern = patternByKey.get(stage.patternKey);
      if (!pattern || pattern.status !== "published") {
        throw new Error(
          "Story stage references an unpublished interview pattern: " + stage.patternKey
        );
      }

      const validCandidates: GeneratedQuestionCandidate[] = [];
      const rejectedCandidateReasons: string[] = [];
      for (let round = 1; round <= 2 && validCandidates.length < 2; round += 1) {
        const response = generatedStageQuestionCandidatesWireSchema.parse(
          await this.dependencies.ai.generateStructured({
            operation:
              "core-technical-question-stage-" + stage.order + (round === 1 ? "" : "-additional"),
            modelClass: "reasoning",
            temperature: 0.25,
            schema: generatedStageQuestionCandidatesWireSchema,
            systemInstruction: this.systemInstruction(),
            prompt: this.buildPrompt(story, stage, pattern, validCandidates)
          })
        );

        for (const rawCandidate of response.candidates) {
          const parsed = generatedQuestionCandidateSchema.safeParse(
            normalizeProviderCandidate(
              rawCandidate,
              story,
              stage,
              pattern,
              options.normalizeReviewedMetadata === true
            )
          );
          if (!parsed.success) {
            rejectedCandidateReasons.push(
              parsed.error.issues
                .map((issue) => issue.path.join(".") + ": " + issue.message)
                .join(", ")
            );
            continue;
          }
          const contractErrors = this.validateCandidate(parsed.data, story, stage, pattern);
          if (contractErrors.length > 0) {
            rejectedCandidateReasons.push(contractErrors.join(", "));
            continue;
          }
          if (
            !validCandidates.some(
              (candidate) =>
                candidate.key === parsed.data.key || candidate.prompt === parsed.data.prompt
            )
          ) {
            validCandidates.push(parsed.data);
          } else {
            rejectedCandidateReasons.push("candidate key or prompt duplicates another candidate");
          }
        }
      }
      if (validCandidates.length < 2) {
        throw new Error(
          "Question generation returned fewer than two valid candidates for story stage " +
            stage.order +
            ": " +
            rejectedCandidateReasons.join(" | ")
        );
      }

      return validCandidates.sort(
        (left, right) =>
          this.scoreCandidate(right) - this.scoreCandidate(left) ||
          left.key.localeCompare(right.key)
      )[0]!;
    });

    this.assertWholeBlock(questions);
    return frozenQuestionBlockSchema.parse({
      schemaVersion: story.schemaVersion,
      storyKey: story.key,
      questions
    });
  }

  private validateCandidate(
    candidate: GeneratedQuestionCandidate,
    story: GeneratedStoryCandidate,
    stage: GeneratedStoryCandidate["stages"][number],
    pattern: CoreTechnicalInterviewPattern
  ): string[] {
    const errors: string[] = [];
    if (candidate.storyKey !== story.key) errors.push("wrong story key");
    if (candidate.stageKey !== stage.key) errors.push("wrong stage key");
    if (candidate.order !== stage.order) errors.push("wrong stage order");
    if (candidate.format !== stage.format) errors.push("wrong question format");
    if (candidate.patternKey !== pattern.key) errors.push("wrong interview pattern");
    if (!sameValues(candidate.topicKeys, pattern.topicKeys)) {
      errors.push("question topic keys differ from its interview pattern");
    }
    if (!sameValues(candidate.mechanismKeys, pattern.mechanismKeys)) {
      errors.push("question mechanism keys differ from its interview pattern");
    }
    if (new Set(candidate.hints).size !== 3) {
      errors.push("hints are not progressive and distinct");
    }
    return errors;
  }

  private assertWholeBlock(questions: GeneratedQuestionCandidate[]): void {
    if (new Set(questions.map((question) => question.key)).size !== 8) {
      throw new Error("Generated Core Technical question keys must be unique");
    }
    if (new Set(questions.map((question) => question.prompt)).size !== 8) {
      throw new Error("Generated Core Technical prompts must be unique");
    }
    const primaryMechanisms = questions.map((question) => question.mechanismKeys[0]);
    if (new Set(primaryMechanisms).size !== primaryMechanisms.length) {
      throw new Error("Generated Core Technical block repeats a primary mechanism");
    }
  }

  private scoreCandidate(candidate: GeneratedQuestionCandidate): number {
    const depth =
      candidate.answer.explanation.length +
      candidate.rubric.reduce((sum, criterion) => sum + criterion.criterion.length, 0);
    const interviewValue =
      candidate.commonMistakes.length * 15 + candidate.interviewerFollowUps.length * 15;
    const executableEvidence =
      (candidate.publicTests?.length ?? 0) * 10 + (candidate.hiddenTests?.length ?? 0) * 10;
    return Math.min(1_000, depth + interviewValue + executableEvidence);
  }

  private systemInstruction(): string {
    return [
      "You create rigorous Core Technical interview-practice questions inside one continuing production incident.",
      "Preserve the supplied interview pattern's mechanism and expected reasoning.",
      "The story is a delivery vehicle, not decoration: the prompt must require its incident evidence or artifact.",
      "Write a complete correct private answer, a discriminating 10-point rubric, realistic mistakes, and interviewer follow-ups.",
      "Hints must progress from orientation to mechanism to near-solution without revealing the answer immediately.",
      "For executable questions, use deterministic Node.js 22 code with no network, filesystem, clock, randomness, or external packages.",
      "Never put the answer, hidden tests, rubric, or correct choice into the public prompt or artifact.",
      "Return only data matching the supplied schema."
    ].join(" ");
  }

  private buildPrompt(
    story: GeneratedStoryCandidate,
    stage: GeneratedStoryCandidate["stages"][number],
    pattern: CoreTechnicalInterviewPattern,
    existingCandidates: GeneratedQuestionCandidate[]
  ): string {
    return JSON.stringify({
      task: "Return exactly 2 genuinely different candidate bundles for this one stage. The candidates array must contain 2 objects, never 1.",
      story: {
        key: story.key,
        title: story.title,
        premise: story.premise,
        incident: story.incident,
        candidateRole: story.candidateRole,
        difficulty: story.difficulty,
        expectedMinutesForWholeBlock: story.expectedMinutes,
        stages: story.stages.map((item) => ({
          order: item.order,
          key: item.key,
          title: item.title,
          artifactKey: item.artifactKey,
          storyDependency: item.storyDependency
        }))
      },
      currentStage: stage,
      interviewPattern: {
        key: pattern.key,
        title: pattern.title,
        normalizedPrompt: pattern.normalizedPrompt,
        topicKeys: pattern.topicKeys,
        mechanismKeys: pattern.mechanismKeys,
        expectedSignals: pattern.expectedSignals,
        commonMistakes: pattern.commonMistakes,
        followUps: pattern.followUps,
        evidenceSourceIds: pattern.evidenceSourceIds,
        technicalSourceIds: pattern.technicalSourceIds
      },
      mustDifferFrom: existingCandidates.map((candidate) => ({
        key: candidate.key,
        prompt: candidate.prompt,
        artifact: candidate.artifact.content
      })),
      hardRules: [
        "Copy storyKey, stageKey, order, format, patternKey, topicKeys, and mechanismKeys exactly from the supplied contract.",
        "Every prompt, artifact content, hint, explanation, rubric criterion, mistake, follow-up, and interview connection must contain at least 20 characters; the concise answer must contain at least 8.",
        "Use exactly three distinct progressive hints and between 1 and 6 rubric criteria totaling exactly 10 points.",
        "MCQ distractors must represent realistic misconceptions, not joke answers.",
        "Debug and implementation formats require starter code, reference solution, public tests, hidden tests, common wrong-solution mutants, and the pinned runner contract.",
        "Every executable test must include testCode: an async-function body that receives the imported candidate module as solution and returns true only when the assertion passes. Do not read files, use the network, spawn processes, inspect environment variables, or print secrets.",
        "Add 1-3 wrongSolutions with realistic compiling implementations based on the listed common mistakes; the public or hidden tests must reject every mutant.",
        "For executable formats set runnerContract exactly to language javascript, runtime nodejs, runtimeVersion 22, entrypoint solution.mjs, timeoutMs 1000, memoryMb 64, and networkAccess false.",
        "The interviewConnection must plainly name the standard interview reasoning practised, but is private until after an attempt.",
        "Do not reuse any key, prompt, or artifact listed in mustDifferFrom; change the scenario evidence and reasoning angle materially."
      ]
    });
  }
}

async function mapWithConcurrency<Input, Output>(
  values: Input[],
  concurrency: number,
  transform: (value: Input, index: number) => Promise<Output>
): Promise<Output[]> {
  const output = new Array<Output>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await transform(values[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return output;
}

function sameValues(left: string[], right: string[]): boolean {
  const sortedRight = [...right].sort();
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === sortedRight[index])
  );
}

function normalizeProviderCandidate(
  candidate: z.infer<typeof generatedStageQuestionCandidatesWireSchema>["candidates"][number],
  story: GeneratedStoryCandidate,
  stage: GeneratedStoryCandidate["stages"][number],
  pattern: CoreTechnicalInterviewPattern,
  normalizeReviewedMetadata: boolean
): unknown {
  const normalized = structuredClone(candidate);
  if (normalizeReviewedMetadata) {
    normalized.storyKey = story.key;
    normalized.stageKey = stage.key;
    normalized.order = stage.order;
    normalized.format = stage.format;
    normalized.patternKey = pattern.key;
    normalized.topicKeys = pattern.topicKeys;
    normalized.mechanismKeys = pattern.mechanismKeys;
  }
  const executable = ["debug-repair", "micro-implementation"].includes(normalized.format);

  if (normalized.format !== "mcq") {
    delete normalized.choices;
    delete normalized.answer.correctChoiceIndex;
  }
  if (!executable) {
    delete normalized.starterCode;
    delete normalized.referenceSolution;
    delete normalized.publicTests;
    delete normalized.hiddenTests;
    delete normalized.wrongSolutions;
    delete normalized.runnerContract;
  }
  return normalized;
}
