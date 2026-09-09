import { z } from "zod";
import {
  APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION,
  appliedEngineeringArtifactKindSchema,
  appliedEngineeringIdentifierSchema,
  appliedEngineeringProductionSignalSchema,
  appliedEngineeringQuestionFormatSchema
} from "./contracts";

const contentSchema = z.string().trim().min(20).max(12_000);
const conciseContentSchema = z.string().trim().min(8).max(4_000);

export const appliedEngineeringArtifactSchema = z
  .object({
    key: appliedEngineeringIdentifierSchema,
    kind: appliedEngineeringArtifactKindSchema,
    title: z.string().trim().min(4).max(120),
    content: contentSchema,
    language: z.string().trim().min(1).max(40).optional(),
    caption: z.string().trim().min(8).max(500).optional()
  })
  .strict();

export const appliedEngineeringRunnerContractSchema = z
  .object({
    language: z.literal("javascript"),
    runtime: z.literal("nodejs"),
    runtimeVersion: z.literal("22"),
    entrypoint: z.string().min(3).max(120),
    timeoutMs: z.number().int().min(100).max(3_000),
    memoryMb: z.number().int().min(16).max(128),
    networkAccess: z.literal(false)
  })
  .strict();

export const appliedEngineeringTestCaseSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    input: z.string().max(2_000),
    expected: z.string().max(2_000),
    testCode: z.string().min(20).max(8_000)
  })
  .strict();

export const appliedEngineeringWrongSolutionSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    code: z.string().min(10).max(12_000)
  })
  .strict();

const appliedEngineeringQuestionBaseSchema = z
  .object({
    schemaVersion: z.literal(APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION),
    key: appliedEngineeringIdentifierSchema,
    incidentKey: appliedEngineeringIdentifierSchema,
    stageKey: appliedEngineeringIdentifierSchema,
    order: z.number().int().min(1).max(8),
    format: appliedEngineeringQuestionFormatSchema,
    patternKey: appliedEngineeringIdentifierSchema,
    topicKeys: z.array(appliedEngineeringIdentifierSchema).min(1).max(6),
    productionSignalKeys: z.array(appliedEngineeringProductionSignalSchema).min(1).max(5),
    prompt: contentSchema,
    artifact: appliedEngineeringArtifactSchema,
    choices: z.array(z.string().min(1).max(500)).min(3).max(5).optional(),
    hints: z.array(contentSchema).length(3),
    answer: z
      .object({
        concise: conciseContentSchema,
        explanation: contentSchema,
        correctChoiceIndex: z.number().int().min(0).max(4).optional()
      })
      .strict(),
    rubric: z
      .array(
        z
          .object({
            criterion: z.string().trim().min(8).max(1_000),
            points: z.number().int().min(1).max(10)
          })
          .strict()
      )
      .min(1)
      .max(6),
    commonMistakes: z.array(contentSchema).min(1).max(6),
    interviewerFollowUps: z.array(contentSchema).min(1).max(4),
    interviewConnection: contentSchema,
    starterCode: z.string().min(10).max(12_000).optional(),
    referenceSolution: z.string().min(10).max(12_000).optional(),
    publicTests: z.array(appliedEngineeringTestCaseSchema).min(1).max(12).optional(),
    hiddenTests: z.array(appliedEngineeringTestCaseSchema).min(1).max(20).optional(),
    wrongSolutions: z.array(appliedEngineeringWrongSolutionSchema).min(1).max(6).optional(),
    runnerContract: appliedEngineeringRunnerContractSchema.optional()
  })
  .strict();

export const appliedEngineeringQuestionSchema = appliedEngineeringQuestionBaseSchema.superRefine(
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
          "Executable questions require starter/reference code, tests, mutants, and a runner contract"
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
    if (question.rubric.reduce((total, item) => total + item.points, 0) !== 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rubric"],
        message: "Question rubric must total exactly 10 points"
      });
    }
  }
);

export const appliedEngineeringQuestionBlockSchema = z
  .object({
    schemaVersion: z.literal(APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION),
    incidentKey: appliedEngineeringIdentifierSchema,
    questions: z.array(appliedEngineeringQuestionSchema).length(8)
  })
  .strict()
  .superRefine((block, context) => {
    const keys = new Set<string>();
    block.questions.forEach((question, index) => {
      if (question.order !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "order"],
          message: "Block questions must be ordered from 1 through 8"
        });
      }
      if (question.incidentKey !== block.incidentKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "incidentKey"],
          message: "Every question must belong to the frozen incident"
        });
      }
      if (keys.has(question.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "key"],
          message: "Block question keys must be unique"
        });
      }
      keys.add(question.key);
    });
  });

export const publicAppliedEngineeringQuestionSchema = z
  .object({
    key: appliedEngineeringIdentifierSchema,
    incidentKey: appliedEngineeringIdentifierSchema,
    stageKey: appliedEngineeringIdentifierSchema,
    order: z.number().int().min(1).max(8),
    format: appliedEngineeringQuestionFormatSchema,
    topicKeys: z.array(appliedEngineeringIdentifierSchema),
    productionSignalKeys: z.array(appliedEngineeringProductionSignalSchema),
    prompt: contentSchema,
    artifact: appliedEngineeringArtifactSchema,
    choices: z.array(z.string()).optional(),
    hintCount: z.literal(3),
    starterCode: z.string().optional(),
    publicTests: z.array(appliedEngineeringTestCaseSchema).optional(),
    runnerContract: appliedEngineeringRunnerContractSchema.optional(),
    interviewConnection: contentSchema.optional()
  })
  .strict();

export type AppliedEngineeringArtifact = z.infer<typeof appliedEngineeringArtifactSchema>;
export type AppliedEngineeringQuestion = z.infer<typeof appliedEngineeringQuestionSchema>;
export type AppliedEngineeringQuestionBlock = z.infer<typeof appliedEngineeringQuestionBlockSchema>;
export type PublicAppliedEngineeringQuestion = z.infer<
  typeof publicAppliedEngineeringQuestionSchema
>;

export function toPublicAppliedEngineeringQuestion(
  question: AppliedEngineeringQuestion,
  attempted: boolean
): PublicAppliedEngineeringQuestion {
  return publicAppliedEngineeringQuestionSchema.parse({
    key: question.key,
    incidentKey: question.incidentKey,
    stageKey: question.stageKey,
    order: question.order,
    format: question.format,
    topicKeys: question.topicKeys,
    productionSignalKeys: question.productionSignalKeys,
    prompt: question.prompt,
    artifact: question.artifact,
    choices: question.choices,
    hintCount: 3,
    starterCode: question.starterCode,
    publicTests: question.publicTests,
    runnerContract: question.runnerContract,
    ...(attempted ? { interviewConnection: question.interviewConnection } : {})
  });
}

export function revealAppliedEngineeringHint(
  question: AppliedEngineeringQuestion,
  hintNumber: 1 | 2 | 3
): string {
  return question.hints[hintNumber - 1]!;
}
