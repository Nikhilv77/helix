import { z } from "zod";

import {
  generatedStoryCandidateSchema,
  generatedStoryCandidatesSchema,
  generatedReviewedStoryCandidateWireSchema,
  REQUIRED_STORY_STAGE_FORMATS,
  selectedStorySchema,
  type CoreTechnicalDifficulty,
  type GeneratedStoryCandidate,
  type SelectedCoreTechnicalStory
} from "@/features/practice/core-technical/domain/story-contracts";
import type {
  CoreTechnicalDomainMap,
  CoreTechnicalInterviewPattern
} from "@/features/practice/core-technical/domain/contracts";
import type { AiService } from "@/server/ai/ai.service";

const identifierSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const storyGeneratorInputSchema = z.object({
  role: z.string().min(2),
  seniority: z.enum(["junior", "mid", "senior", "staff"]),
  language: z.string().min(2),
  runtime: z.string().min(2),
  framework: z.string().min(2).optional(),
  technology: z.string().min(2).max(80).optional(),
  targetJob: z.string().min(2).max(160),
  targetCompany: z.string().min(2).max(160).optional(),
  baselineState: z.enum(["UNKNOWN", "GUIDED", "STANDARD", "STRETCH"]),
  weakMechanismKeys: z.array(z.string()).default([]),
  unassessedMechanismKeys: z.array(z.string()).default([]),
  recentTopicKeys: z.array(z.string()).default([]),
  excludedTopicKeys: z.array(z.string()).default([]),
  personalizePresentation: z.boolean().optional().default(false),
  reviewedContract: z
    .object({
      storyKey: identifierSchema.optional(),
      storyTitle: z.string().min(5).max(100),
      stagePatternKeys: z.array(z.string()).length(8),
      requiredStoryTopicKeys: z.array(z.string()).min(2).max(4)
    })
    .optional()
});

export type StoryGeneratorInput = z.input<typeof storyGeneratorInputSchema>;

type StoryGeneratorDependencies = {
  ai: Pick<AiService, "generateStructured">;
  domainMap: CoreTechnicalDomainMap;
  patterns: CoreTechnicalInterviewPattern[];
};

const SENIORITY_RANK = {
  junior: 0,
  mid: 1,
  senior: 2,
  staff: 3
} as const;

const IMPORTANCE_WEIGHT = {
  essential: 1,
  high: 0.75,
  supporting: 0.5
} as const;

const reviewedStoryCandidateResponseSchema = z.object({
  candidates: z.array(generatedReviewedStoryCandidateWireSchema).length(1)
});

export class CoreTechnicalStoryGenerator {
  constructor(private readonly dependencies: StoryGeneratorDependencies) {}

  async generate(rawInput: StoryGeneratorInput): Promise<SelectedCoreTechnicalStory> {
    const input = storyGeneratorInputSchema.parse(rawInput);
    this.assertSupportedStack(input);

    const eligiblePatterns = this.dependencies.patterns.filter(
      (pattern) =>
        pattern.status === "published" &&
        pattern.roles.includes(input.role) &&
        pattern.languages.includes(input.language) &&
        pattern.runtimes.includes(input.runtime) &&
        this.supportsSeniority(pattern, input.seniority) &&
        (!input.framework ||
          pattern.frameworks.length === 0 ||
          pattern.frameworks.includes(input.framework)) &&
        !pattern.topicKeys.some((topicKey) => input.excludedTopicKeys.includes(topicKey))
    );

    if (eligiblePatterns.length < 8) {
      throw new Error(
        "Core Technical needs at least eight eligible interview patterns for the confirmed stack"
      );
    }
    if (
      input.reviewedContract?.stagePatternKeys.some(
        (patternKey) => !eligiblePatterns.some((pattern) => pattern.key === patternKey)
      )
    ) {
      throw new Error(
        "The reviewed story contract contains a pattern that is not eligible for the confirmed stack"
      );
    }

    const responseSchema = input.reviewedContract
      ? reviewedStoryCandidateResponseSchema
      : generatedStoryCandidatesSchema;
    const result = responseSchema.parse(
      await this.dependencies.ai.generateStructured({
        operation: "core-technical-story-candidates",
        modelClass: "reasoning",
        temperature: 0.35,
        schema: responseSchema,
        systemInstruction: this.systemInstruction(),
        prompt: this.buildPrompt(input, eligiblePatterns)
      })
    );

    const candidates = input.reviewedContract
      ? result.candidates.map((candidate) =>
          this.normalizeReviewedCandidate(candidate, input, eligiblePatterns)
        )
      : generatedStoryCandidateSchema.array().parse(result.candidates);
    const evaluated = candidates.map((candidate) => ({
      candidate,
      errors: this.validateCandidate(candidate, input, eligiblePatterns)
    }));
    const scored = evaluated
      .filter((item) => item.errors.length === 0)
      .map(({ candidate }) => ({ candidate, score: this.scoreCandidate(candidate, input) }));

    if (scored.length === 0) {
      throw new Error(
        "Core Technical story generation returned no candidate that passed the catalogue contract: " +
          evaluated.map((item) => item.errors.join(", ")).join(" | ")
      );
    }

    scored.sort(
      (left, right) =>
        right.score.total - left.score.total ||
        left.candidate.key.localeCompare(right.candidate.key)
    );
    const winner = scored[0];
    if (!winner) throw new Error("Core Technical story selection failed");

    return selectedStorySchema.parse({
      ...winner.candidate,
      score: winner.score,
      selectionReason:
        "Selected for " +
        input.targetJob +
        " because it combines important interview patterns with " +
        (input.weakMechanismKeys.length > 0
          ? "the candidate's current evidence gaps."
          : "broad, previously unassessed coverage.")
    });
  }

  private assertSupportedStack(input: z.output<typeof storyGeneratorInputSchema>): void {
    const { domainMap } = this.dependencies;
    if (
      input.language !== domainMap.language ||
      input.runtime !== domainMap.runtime ||
      !domainMap.roles.includes(input.role)
    ) {
      throw new Error("The confirmed stack does not match this Core Technical domain map");
    }
  }

  private supportsSeniority(
    pattern: CoreTechnicalInterviewPattern,
    seniority: keyof typeof SENIORITY_RANK
  ): boolean {
    const lowestSupportedRank = Math.min(
      ...pattern.seniorities.map((item) => SENIORITY_RANK[item])
    );
    return SENIORITY_RANK[seniority] >= lowestSupportedRank;
  }

  private validateCandidate(
    candidate: GeneratedStoryCandidate,
    input: z.output<typeof storyGeneratorInputSchema>,
    eligiblePatterns: CoreTechnicalInterviewPattern[]
  ): string[] {
    const errors: string[] = [];
    const topics = new Map(this.dependencies.domainMap.topics.map((topic) => [topic.key, topic]));
    const eligibleByKey = new Map(eligiblePatterns.map((pattern) => [pattern.key, pattern]));
    const selectedTopicKeys = new Set([candidate.primaryTopicKey, ...candidate.secondaryTopicKeys]);

    if (candidate.secondaryTopicKeys.includes(candidate.primaryTopicKey)) {
      errors.push("primary topic repeated as a secondary topic");
    }
    if (input.reviewedContract) {
      const generatedPatternKeys = candidate.stages.map((stage) => stage.patternKey);
      if (!input.personalizePresentation && candidate.title !== input.reviewedContract.storyTitle) {
        errors.push("candidate title differs from the reviewed contract");
      }
      if (
        generatedPatternKeys.some(
          (patternKey, index) => patternKey !== input.reviewedContract?.stagePatternKeys[index]
        )
      ) {
        errors.push("candidate stage order differs from the reviewed contract");
      }
      if (
        input.reviewedContract.requiredStoryTopicKeys.some(
          (topicKey) => !selectedTopicKeys.has(topicKey)
        )
      ) {
        errors.push("candidate omits a required reviewed story topic");
      }
    }
    if (candidate.difficulty !== this.difficultyFor(input.baselineState)) {
      errors.push("candidate difficulty does not match baseline calibration");
    }
    if ([...selectedTopicKeys].some((topicKey) => !topics.has(topicKey))) {
      errors.push("unknown story topic");
    }
    if (
      input.excludedTopicKeys.some((topicKey) => !candidate.forbiddenTopicKeys.includes(topicKey))
    ) {
      errors.push("candidate omitted a requested forbidden topic");
    }

    const patternKeys = candidate.stages.map((stage) => stage.patternKey);
    if (new Set(patternKeys).size !== patternKeys.length) {
      errors.push("interview pattern repeated within the block");
    }

    let connectedStageCount = 0;
    for (const stage of candidate.stages) {
      const pattern = eligibleByKey.get(stage.patternKey);
      if (!pattern) {
        errors.push("ineligible pattern: " + stage.patternKey);
        continue;
      }
      if (!pattern.formats.includes(stage.format)) {
        errors.push("pattern does not support stage format: " + stage.patternKey);
      }
      if (pattern.topicKeys.some((topicKey) => selectedTopicKeys.has(topicKey))) {
        connectedStageCount += 1;
      }
    }
    if (connectedStageCount < 4) {
      errors.push("too few stages are connected to the primary story topics");
    }

    const artifactKeys = candidate.stages.map((stage) => stage.artifactKey);
    if (new Set(artifactKeys).size < 4) {
      errors.push("story does not evolve through enough concrete artifacts");
    }

    return errors;
  }

  private normalizeReviewedCandidate(
    candidate: z.infer<typeof generatedReviewedStoryCandidateWireSchema>,
    input: z.output<typeof storyGeneratorInputSchema>,
    eligiblePatterns: CoreTechnicalInterviewPattern[]
  ): GeneratedStoryCandidate {
    if (!input.reviewedContract) return generatedStoryCandidateSchema.parse(candidate);

    const patternByKey = new Map(eligiblePatterns.map((pattern) => [pattern.key, pattern]));
    const requiredTopics = input.reviewedContract.requiredStoryTopicKeys;
    return generatedStoryCandidateSchema.parse({
      ...candidate,
      key: input.reviewedContract.storyKey ?? candidate.key,
      title: input.personalizePresentation ? candidate.title : input.reviewedContract.storyTitle,
      primaryTopicKey: requiredTopics[0],
      secondaryTopicKeys: requiredTopics.slice(1),
      mechanismKeys: input.reviewedContract.stagePatternKeys.map(
        (patternKey) => patternByKey.get(patternKey)?.mechanismKeys[0]
      ),
      difficulty: this.difficultyFor(input.baselineState),
      forbiddenTopicKeys: input.excludedTopicKeys,
      realismAnchors: candidate.realismAnchors.slice(0, 6),
      stages: candidate.stages.map((stage, index) => ({
        ...stage,
        order: index + 1,
        format: REQUIRED_STORY_STAGE_FORMATS[index]?.find((format) =>
          patternByKey
            .get(input.reviewedContract!.stagePatternKeys[index]!)
            ?.formats.includes(format)
        ),
        patternKey: input.reviewedContract!.stagePatternKeys[index]
      }))
    });
  }

  private scoreCandidate(
    candidate: GeneratedStoryCandidate,
    input: z.output<typeof storyGeneratorInputSchema>
  ) {
    const topicByKey = new Map(
      this.dependencies.domainMap.topics.map((topic) => [topic.key, topic])
    );
    const patternByKey = new Map(
      this.dependencies.patterns.map((pattern) => [pattern.key, pattern])
    );
    const selectedTopics = [candidate.primaryTopicKey, ...candidate.secondaryTopicKeys];
    const importanceAverage =
      selectedTopics.reduce(
        (sum, topicKey) =>
          sum + IMPORTANCE_WEIGHT[topicByKey.get(topicKey)?.importance ?? "supporting"],
        0
      ) / selectedTopics.length;
    const interviewAverage =
      candidate.stages.reduce(
        (sum, stage) =>
          sum + IMPORTANCE_WEIGHT[patternByKey.get(stage.patternKey)?.importance ?? "supporting"],
        0
      ) / candidate.stages.length;
    const newTopicRatio =
      selectedTopics.filter((topicKey) => !input.recentTopicKeys.includes(topicKey)).length /
      selectedTopics.length;
    const evidenceTargets = new Set([...input.weakMechanismKeys, ...input.unassessedMechanismKeys]);
    const evidenceHitRatio =
      evidenceTargets.size === 0
        ? 1
        : candidate.mechanismKeys.filter((key) => evidenceTargets.has(key)).length /
          evidenceTargets.size;

    const score = {
      domainImportance: Math.round(importanceAverage * 20),
      realism: Math.min(15, candidate.realismAnchors.length * 4),
      interviewDensity: Math.round(interviewAverage * 20),
      coherence: new Set(candidate.stages.map((stage) => stage.artifactKey)).size >= 6 ? 15 : 12,
      stackFit: 15,
      personalizedCoverage: Math.round(
        Math.min(1, newTopicRatio * 0.5 + evidenceHitRatio * 0.5) * 15
      )
    };

    return {
      ...score,
      total: Object.values(score).reduce((sum, value) => sum + value, 0)
    };
  }

  private systemInstruction(): string {
    return [
      "You design practical Core Technical interview learning paths built from situations candidates actually recognize.",
      "Use only the supplied, source-reviewed interview patterns.",
      "Preserve the pattern's actual reasoning and difficulty, but prefer common interview fundamentals over obscure trivia.",
      "Give the path a direct, task-led title such as 'Fix a slow database request' or 'Trace an async JavaScript bug'. Never use a vague cinematic incident title.",
      "Each stage must be a relatable question that can be explained aloud, while still using the prior evidence when continuity helps learning.",
      "Never copy source wording or invent claims about a real employer's interview.",
      "Return only data matching the supplied schema."
    ].join(" ");
  }

  private buildPrompt(
    input: z.output<typeof storyGeneratorInputSchema>,
    eligiblePatterns: CoreTechnicalInterviewPattern[]
  ): string {
    const difficulty = this.difficultyFor(input.baselineState);
    const catalogue = eligiblePatterns.map((pattern) => ({
      key: pattern.key,
      title: pattern.title,
      normalizedPrompt: pattern.normalizedPrompt,
      topicKeys: pattern.topicKeys,
      mechanismKeys: pattern.mechanismKeys,
      formats: pattern.formats,
      importance: pattern.importance,
      expectedSignals: pattern.expectedSignals,
      commonMistakes: pattern.commonMistakes,
      followUps: pattern.followUps
    }));

    return JSON.stringify({
      task: input.reviewedContract
        ? "Generate exactly 1 story candidate implementing the reviewed contract with exactly 8 ordered stages."
        : "Generate 3 to 5 distinct story candidates and exactly 8 ordered stages per candidate.",
      fixedStageFormats: [
        "mcq",
        "predict-explain",
        "written",
        "spoken or written",
        "artifact-diagnosis",
        "debug-repair",
        "micro-implementation",
        "written or spoken"
      ],
      rules: [
        "Use eight different eligible pattern keys in each candidate.",
        "Use only topic, mechanism, and pattern keys supplied below.",
        "Every key you create, including story, stage, and artifact keys, must be lowercase kebab-case matching ^[a-z0-9]+(?:-[a-z0-9]+)*$.",
        "candidateRole must be one complete sentence of at least 20 characters.",
        "mechanismKeys must contain 4 to 12 items; include each stage pattern's first mechanism key and omit redundant secondary mechanisms when necessary.",
        "Provide 3 to 6 distinct realismAnchors, each a complete sentence of at least 20 characters.",
        "Make the situation immediately recognizable for the target job and selected technology.",
        "Write a short action-led title that tells the learner what they will fix, trace, design, or explain.",
        "Prefer small API, database, async, testing, memory, or request examples over an elaborate fictional company incident.",
        "Every stage title and objective must be plain enough for a candidate to restate naturally in an interview.",
        "Make each storyDependency name the prior fact or artifact required by that stage.",
        "Keep the whole block within 40 to 50 minutes.",
        "Put every excluded topic in forbiddenTopicKeys."
      ],
      candidate: {
        role: input.role,
        seniority: input.seniority,
        language: input.language,
        runtime: input.runtime,
        framework: input.framework,
        technology: input.technology ?? input.framework ?? input.runtime,
        targetJob: input.targetJob,
        targetCompany: input.targetCompany,
        difficulty,
        weakMechanismKeys: input.weakMechanismKeys,
        unassessedMechanismKeys: input.unassessedMechanismKeys,
        recentTopicKeys: input.recentTopicKeys,
        excludedTopicKeys: input.excludedTopicKeys
      },
      reviewedContract: input.reviewedContract,
      personalizePresentation: input.personalizePresentation,
      domainTopics: this.dependencies.domainMap.topics,
      eligibleInterviewPatterns: catalogue
    });
  }

  private difficultyFor(
    baselineState: z.output<typeof storyGeneratorInputSchema>["baselineState"]
  ): CoreTechnicalDifficulty {
    if (baselineState === "UNKNOWN") return "guided";
    return baselineState.toLowerCase() as CoreTechnicalDifficulty;
  }
}
