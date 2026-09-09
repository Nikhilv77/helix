import { z } from "zod";
import {
  ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
  ARCHITECTURE_DESIGN_STAGES,
  architectureDesignArtifactKindSchema,
  architectureDesignDimensionSchema,
  architectureDesignIdentifierSchema,
  architectureDesignQuestionFormatSchema
} from "./contracts";

const contentSchema = z.string().trim().min(20).max(12_000);
const conciseContentSchema = z.string().trim().min(8).max(4_000);

export const architectureDesignArtifactSchema = z
  .object({
    key: architectureDesignIdentifierSchema,
    kind: architectureDesignArtifactKindSchema,
    title: z.string().trim().min(4).max(120),
    content: contentSchema,
    caption: z.string().trim().min(8).max(500).optional()
  })
  .strict();

export const architectureDesignRubricItemSchema = z
  .object({
    criterion: z.string().trim().min(8).max(1_000),
    points: z.number().int().min(1).max(10),
    dimensionKeys: z.array(architectureDesignDimensionSchema).min(1).max(5)
  })
  .strict();

const architectureDesignQuestionBaseSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION),
    key: architectureDesignIdentifierSchema,
    scenarioKey: architectureDesignIdentifierSchema,
    stageKey: architectureDesignIdentifierSchema,
    order: z.number().int().min(1).max(4),
    format: architectureDesignQuestionFormatSchema,
    topicKeys: z.array(architectureDesignIdentifierSchema).min(1).max(6),
    dimensionKeys: z.array(architectureDesignDimensionSchema).min(1).max(5),
    prompt: contentSchema,
    artifact: architectureDesignArtifactSchema,
    choices: z.array(z.string().trim().min(1).max(500)).min(3).max(5).optional(),
    hints: z.array(contentSchema).length(3),
    referenceAnswer: z
      .object({ summary: conciseContentSchema, explanation: contentSchema })
      .strict(),
    correctChoiceIndex: z.number().int().min(0).max(4).optional(),
    rubric: z.array(architectureDesignRubricItemSchema).min(1).max(6),
    commonMistakes: z.array(contentSchema).min(1).max(6),
    interviewerFollowUps: z.array(contentSchema).min(1).max(4),
    transferConnection: contentSchema
  })
  .strict();

export const architectureDesignQuestionSchema = architectureDesignQuestionBaseSchema.superRefine(
  (question, context) => {
    const expected = ARCHITECTURE_DESIGN_STAGES[question.order - 1];
    if (
      !expected ||
      question.stageKey !== expected.key ||
      !expected.formats.includes(question.format as never)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stageKey"],
        message: "Question does not match its fixed Architecture stage"
      });
    }
    if (expected && !sameValues(question.dimensionKeys, expected.dimensionKeys)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensionKeys"],
        message: "Question must assess its canonical stage dimensions"
      });
    }
    if (question.format === "mcq") {
      if (
        !question.choices ||
        question.correctChoiceIndex === undefined ||
        question.correctChoiceIndex >= question.choices.length
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCQ questions require choices and a valid private answer index"
        });
      }
    } else if (question.choices !== undefined || question.correctChoiceIndex !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only MCQ questions can contain choices or a choice index"
      });
    }
    if (question.rubric.reduce((total, item) => total + item.points, 0) !== 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rubric"],
        message: "Architecture question rubrics must total exactly 10 points"
      });
    }
    const allowedDimensions = new Set(question.dimensionKeys);
    if (
      question.rubric.some((item) => item.dimensionKeys.some((key) => !allowedDimensions.has(key)))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rubric"],
        message: "Rubric dimensions must belong to the question"
      });
    }
  }
);

export const architectureDesignQuestionBlockSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION),
    scenarioKey: architectureDesignIdentifierSchema,
    questions: z.array(architectureDesignQuestionSchema).length(4)
  })
  .strict()
  .superRefine((block, context) => {
    const keys = new Set<string>();
    block.questions.forEach((question, index) => {
      if (question.order !== index + 1 || question.scenarioKey !== block.scenarioKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index],
          message: "Questions must be ordered and belong to the frozen scenario"
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

export const publicArchitectureDesignQuestionSchema = z
  .object({
    key: architectureDesignIdentifierSchema,
    scenarioKey: architectureDesignIdentifierSchema,
    stageKey: architectureDesignIdentifierSchema,
    order: z.number().int().min(1).max(4),
    format: architectureDesignQuestionFormatSchema,
    topicKeys: z.array(architectureDesignIdentifierSchema),
    dimensionKeys: z.array(architectureDesignDimensionSchema),
    prompt: contentSchema,
    artifact: architectureDesignArtifactSchema,
    choices: z.array(z.string()).optional(),
    hintCount: z.literal(3),
    transferConnection: contentSchema.optional()
  })
  .strict();

export const publicArchitectureDesignQuestionBlockSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION),
    scenarioKey: architectureDesignIdentifierSchema,
    questions: z.array(publicArchitectureDesignQuestionSchema).length(4)
  })
  .strict();

export type ArchitectureDesignArtifact = z.infer<typeof architectureDesignArtifactSchema>;
export type ArchitectureDesignQuestion = z.infer<typeof architectureDesignQuestionSchema>;
export type ArchitectureDesignQuestionBlock = z.infer<typeof architectureDesignQuestionBlockSchema>;
export type PublicArchitectureDesignQuestion = z.infer<
  typeof publicArchitectureDesignQuestionSchema
>;

export function toPublicArchitectureDesignQuestion(
  question: ArchitectureDesignQuestion,
  attempted: boolean
): PublicArchitectureDesignQuestion {
  return publicArchitectureDesignQuestionSchema.parse({
    key: question.key,
    scenarioKey: question.scenarioKey,
    stageKey: question.stageKey,
    order: question.order,
    format: question.format,
    topicKeys: question.topicKeys,
    dimensionKeys: question.dimensionKeys,
    prompt: question.prompt,
    artifact: question.artifact,
    choices: question.choices,
    hintCount: 3,
    ...(attempted ? { transferConnection: question.transferConnection } : {})
  });
}

export function toPublicArchitectureDesignQuestionBlock(
  block: ArchitectureDesignQuestionBlock,
  attemptedQuestionKeys: ReadonlySet<string> = new Set()
) {
  return publicArchitectureDesignQuestionBlockSchema.parse({
    schemaVersion: block.schemaVersion,
    scenarioKey: block.scenarioKey,
    questions: block.questions.map((question) =>
      toPublicArchitectureDesignQuestion(question, attemptedQuestionKeys.has(question.key))
    )
  });
}

export function revealArchitectureDesignHint(
  question: ArchitectureDesignQuestion,
  hintNumber: 1 | 2 | 3
): string {
  return question.hints[hintNumber - 1]!;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
