import { z } from "zod";

import {
  CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
  coreTechnicalQuestionFormatSchema
} from "./contracts";

const identifierSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .describe(
    "A lowercase kebab-case identifier using only a-z, 0-9, and hyphens; never underscores"
  );
const contentSchema = z
  .string()
  .min(20)
  .max(4_000)
  .describe("Complete text containing at least 20 characters and no more than 4000 characters");
const conciseContentSchema = z
  .string()
  .min(8)
  .max(4_000)
  .describe("A concise but complete answer containing at least 8 characters");

export const coreTechnicalLearningGuideSchema = z
  .object({
    markdown: z
      .string()
      .min(120)
      .max(12_000)
      .describe("A detailed plain-language Markdown lesson revealed after the attempt"),
    diagram: z
      .object({
        title: z.string().min(4).max(120),
        steps: z
          .array(
            z
              .object({
                label: z.string().min(2).max(80),
                detail: z.string().min(8).max(240)
              })
              .strict()
          )
          .min(2)
          .max(6)
      })
      .strict()
  })
  .strict();

export const coreTechnicalArtifactSchema = z.object({
  kind: z.enum(["code", "logs", "trace", "metrics", "config", "scenario"]),
  title: z.string().min(4).max(120),
  content: contentSchema
});

export const coreTechnicalRunnerContractSchema = z.object({
  language: z.literal("javascript"),
  runtime: z.literal("nodejs"),
  runtimeVersion: z.literal("22"),
  entrypoint: z.string().min(3).max(120),
  timeoutMs: z.number().int().min(100).max(3_000),
  memoryMb: z.number().int().min(16).max(128),
  networkAccess: z.literal(false)
});

export const coreTechnicalTestCaseSchema = z.object({
  name: z.string().min(3).max(120),
  input: z.string().max(2_000),
  expected: z.string().max(2_000),
  /** Executed with the candidate module bound as `solution`, inside the sandbox only. */
  testCode: z.string().min(20).max(8_000)
});

export const coreTechnicalWrongSolutionSchema = z.object({
  name: z.string().min(3).max(120),
  code: z.string().min(10).max(12_000)
});

const generatedQuestionCandidateShape = {
  schemaVersion: z.literal(CORE_TECHNICAL_CATALOG_SCHEMA_VERSION),
  key: identifierSchema,
  storyKey: identifierSchema,
  stageKey: identifierSchema,
  order: z.number().int().min(1).max(8),
  format: coreTechnicalQuestionFormatSchema,
  patternKey: identifierSchema,
  topicKeys: z.array(identifierSchema).min(1),
  mechanismKeys: z.array(identifierSchema).min(1),
  prompt: contentSchema,
  artifact: coreTechnicalArtifactSchema,
  choices: z
    .array(z.string().min(1).max(400))
    .min(3)
    .max(5)
    .describe("For MCQ only: between 3 and 5 answer choices")
    .optional(),
  // Use a fixed-length array instead of a JSON Schema tuple. Gemini's
  // response-schema dialect rejects tuple-style `items: []`.
  hints: z.array(contentSchema).length(3),
  answer: z.object({
    concise: conciseContentSchema,
    explanation: contentSchema,
    correctChoiceIndex: z.number().int().min(0).max(4).optional(),
    /** Optional only so already-frozen version-one blocks remain readable. */
    learningGuide: coreTechnicalLearningGuideSchema.optional()
  }),
  rubric: z
    .array(
      z.object({
        criterion: contentSchema,
        points: z.number().int().min(1).max(10)
      })
    )
    .min(1)
    .max(6)
    .describe("Between 1 and 6 scoring criteria whose points total exactly 10"),
  commonMistakes: z
    .array(contentSchema)
    .min(1)
    .max(6)
    .describe("Between 1 and 6 realistic common mistakes"),
  interviewerFollowUps: z
    .array(contentSchema)
    .min(1)
    .max(4)
    .describe("Between 1 and 4 interviewer follow-up questions"),
  interviewConnection: contentSchema,
  starterCode: z.string().min(10).max(12_000).optional(),
  referenceSolution: z.string().min(10).max(12_000).optional(),
  publicTests: z.array(coreTechnicalTestCaseSchema).min(1).max(12).optional(),
  hiddenTests: z.array(coreTechnicalTestCaseSchema).min(1).max(20).optional(),
  wrongSolutions: z.array(coreTechnicalWrongSolutionSchema).min(1).max(6).optional(),
  runnerContract: coreTechnicalRunnerContractSchema.optional()
};

const generatedQuestionCandidateBaseSchema = z.object(generatedQuestionCandidateShape);

const providerTextSchema = z.string().max(12_000);
const providerTestCaseSchema = z.object({
  name: z.string().max(120),
  input: z.string().max(2_000),
  expected: z.string().max(2_000),
  testCode: z.string().max(8_000)
});
const providerWrongSolutionSchema = z.object({
  name: z.string().max(120),
  code: providerTextSchema
});
const generatedQuestionCandidateWireSchema = generatedQuestionCandidateBaseSchema.extend({
  choices: z.array(z.string().max(400)).max(5).optional(),
  hints: z.array(providerTextSchema).max(3),
  answer: z.object({
    concise: providerTextSchema,
    explanation: providerTextSchema,
    correctChoiceIndex: z.number().int().optional(),
    learningGuide: coreTechnicalLearningGuideSchema.optional()
  }),
  rubric: z
    .array(
      z.object({
        criterion: providerTextSchema,
        points: z.number().int()
      })
    )
    .max(6),
  commonMistakes: z.array(providerTextSchema).max(6),
  interviewerFollowUps: z.array(providerTextSchema).max(4),
  starterCode: providerTextSchema.optional(),
  referenceSolution: providerTextSchema.optional(),
  publicTests: z.array(providerTestCaseSchema).max(12).optional(),
  hiddenTests: z.array(providerTestCaseSchema).max(20).optional(),
  wrongSolutions: z.array(providerWrongSolutionSchema).max(6).optional(),
  runnerContract: z
    .object({
      language: z.string(),
      runtime: z.string(),
      runtimeVersion: z.string(),
      entrypoint: z.string(),
      timeoutMs: z.number(),
      memoryMb: z.number(),
      networkAccess: z.boolean()
    })
    .optional()
});

export const generatedQuestionCandidateSchema = generatedQuestionCandidateBaseSchema.superRefine(
  (question, context) => {
    const executable = ["debug-repair", "micro-implementation"].includes(question.format);
    const executableFields = [
      question.starterCode,
      question.referenceSolution,
      question.publicTests,
      question.hiddenTests,
      question.wrongSolutions,
      question.runnerContract
    ];

    if (executable && executableFields.some((field) => field === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Executable questions require code, tests, wrong-solution mutants, and a runner contract"
      });
    }
    if (!executable && executableFields.some((field) => field !== undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Non-executable questions cannot contain runner-only fields"
      });
    }
    if (question.format === "mcq") {
      if (
        !question.choices ||
        question.answer.correctChoiceIndex === undefined ||
        question.answer.correctChoiceIndex >= question.choices.length
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCQ questions require choices and a valid private answer index"
        });
      }
    } else if (question.choices !== undefined || question.answer.correctChoiceIndex !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only MCQ questions can contain choices or a choice index"
      });
    }
    const totalPoints = question.rubric.reduce((sum, criterion) => sum + criterion.points, 0);
    if (totalPoints !== 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Question rubric must total exactly 10 points",
        path: ["rubric"]
      });
    }
  }
);

// Provider-facing schema: structural cross-field rules are applied after the
// model response is normalized. This lets us discard irrelevant optional
// fields that some providers emit for every union branch.
export const generatedStageQuestionCandidatesWireSchema = z.object({
  candidates: z
    .array(generatedQuestionCandidateWireSchema)
    .min(1)
    .max(3)
    .describe("Return exactly 2 genuinely different question candidate objects")
});

export const generatedStageQuestionCandidatesSchema = z.object({
  candidates: z.array(generatedQuestionCandidateSchema).min(2).max(3)
});

export const frozenQuestionBlockSchema = z.object({
  schemaVersion: z.literal(CORE_TECHNICAL_CATALOG_SCHEMA_VERSION),
  storyKey: identifierSchema,
  questions: z
    .array(generatedQuestionCandidateSchema)
    .refine((questions) => questions.length === 6 || questions.length === 8, {
      message: "A Core Technical block must contain six new questions or eight legacy questions"
    })
});

export const publicCoreTechnicalQuestionSchema = z.object({
  key: identifierSchema,
  storyKey: identifierSchema,
  stageKey: identifierSchema,
  order: z.number().int().min(1).max(8),
  format: coreTechnicalQuestionFormatSchema,
  topicKeys: z.array(identifierSchema),
  prompt: contentSchema,
  artifact: coreTechnicalArtifactSchema,
  choices: z.array(z.string()).optional(),
  hintCount: z.literal(3),
  starterCode: z.string().optional(),
  publicTests: z.array(coreTechnicalTestCaseSchema).optional(),
  runnerContract: coreTechnicalRunnerContractSchema.optional(),
  interviewConnection: contentSchema.optional()
});

export type GeneratedQuestionCandidate = z.infer<typeof generatedQuestionCandidateSchema>;
export type FrozenQuestionBlock = z.infer<typeof frozenQuestionBlockSchema>;
export type PublicCoreTechnicalQuestion = z.infer<typeof publicCoreTechnicalQuestionSchema>;
export type CoreTechnicalLearningGuide = z.infer<typeof coreTechnicalLearningGuideSchema>;

/** Compatibility lesson for blocks frozen before rich learning guides shipped. */
export function coreTechnicalLearningGuideFor(
  question: GeneratedQuestionCandidate
): CoreTechnicalLearningGuide {
  if (question.answer.learningGuide) return question.answer.learningGuide;
  const mechanism = humanize(question.mechanismKeys[0] ?? question.topicKeys[0] ?? "mechanism");
  const verification = question.publicTests?.[0]
    ? `Run the saved “${question.publicTests[0].name}” case, then add an edge case that would expose the original mistake.`
    : `Check the claimed result against the supplied ${humanize(question.artifact.kind)} evidence, then state what observation would disprove your diagnosis.`;
  return coreTechnicalLearningGuideSchema.parse({
    markdown: [
      "## What is happening",
      boundedText(question.answer.explanation, 3_600),
      "## How to reason through it",
      `1. Start with **${question.artifact.title}** and state the exact behaviour you can observe.`,
      `2. Trace ownership and execution until you reach the **${mechanism}** mechanism that explains that behaviour.`,
      `3. Choose the smallest correction that changes the cause without weakening error handling, cleanup, or ordering guarantees.`,
      `4. ${verification}`,
      "## A strong interview answer",
      boundedText(question.answer.concise, 3_000),
      boundedText(question.interviewConnection, 1_500),
      "## What to avoid",
      ...question.commonMistakes.slice(0, 3).map((mistake) => `- ${boundedText(mistake, 700)}`),
      "## Try this follow-up",
      boundedText(
        question.interviewerFollowUps[0] ??
          "Explain how you would verify the same mechanism in a production system.",
        1_500
      )
    ].join("\n\n"),
    diagram: {
      title: boundedText(`How ${mechanism} connects the evidence to the fix`, 120),
      steps: [
        { label: "Observe", detail: `Read the concrete behaviour in ${question.artifact.title}.` },
        { label: "Explain", detail: `Identify the ${mechanism} behaviour causing the result.` },
        { label: "Repair", detail: boundedDiagramDetail(question.answer.concise) },
        { label: "Verify", detail: boundedDiagramDetail(verification) }
      ]
    }
  });
}

function humanize(value: string): string {
  return value.replaceAll("-", " ");
}

function boundedDiagramDetail(value: string): string {
  return boundedText(value, 240);
}

function boundedText(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trimEnd()}…`;
}

export function toPublicCoreTechnicalQuestion(
  question: GeneratedQuestionCandidate,
  attempted: boolean
): PublicCoreTechnicalQuestion {
  return publicCoreTechnicalQuestionSchema.parse({
    key: question.key,
    storyKey: question.storyKey,
    stageKey: question.stageKey,
    order: question.order,
    format: question.format,
    topicKeys: question.topicKeys,
    prompt: question.prompt,
    artifact: question.artifact,
    choices: question.choices,
    hintCount: 3,
    starterCode: question.starterCode,
    publicTests: question.publicTests,
    runnerContract: question.runnerContract,
    interviewConnection: attempted ? question.interviewConnection : undefined
  });
}

export function revealCoreTechnicalHint(
  question: GeneratedQuestionCandidate,
  hintNumber: 1 | 2 | 3
): string {
  return question.hints[hintNumber - 1]!;
}
