import { z } from "zod";
import {
  ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION,
  ARCHITECTURE_DESIGN_STAGES,
  architectureDesignDifficultySchema,
  architectureDesignDimensionSchema,
  architectureDesignIdentifierSchema,
  architectureDesignQuestionFormatSchema,
  architectureDesignRoleSchema,
  architectureDesignSenioritySchema
} from "./contracts";

const meaningfulTextSchema = z.string().trim().min(20).max(2_000);

export const architectureDesignScenarioStageSchema = z
  .object({
    order: z.number().int().min(1).max(4),
    key: architectureDesignIdentifierSchema,
    title: z.string().trim().min(4).max(100),
    format: architectureDesignQuestionFormatSchema,
    objective: meaningfulTextSchema,
    artifactKey: architectureDesignIdentifierSchema,
    dimensionKeys: z.array(architectureDesignDimensionSchema).min(1).max(5),
    scenarioDependency: meaningfulTextSchema
  })
  .strict();

const architectureDesignScenarioStagesSchema = z
  .array(architectureDesignScenarioStageSchema)
  .length(4)
  .superRefine((stages, context) => {
    stages.forEach((stage, index) => {
      const expected = ARCHITECTURE_DESIGN_STAGES[index]!;
      if (
        stage.order !== expected.order ||
        stage.key !== expected.key ||
        stage.title !== expected.title ||
        !expected.formats.includes(stage.format as never)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Scenario stage does not match the fixed Architecture interview arc"
        });
      }
      if (!sameValues(stage.dimensionKeys, expected.dimensionKeys)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "dimensionKeys"],
          message: "Scenario stage must cover its canonical Architecture dimensions"
        });
      }
    });
  });

export const architectureDesignScenarioSchema = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_DESIGN_CATALOG_SCHEMA_VERSION),
    key: architectureDesignIdentifierSchema,
    title: z.string().trim().min(5).max(120),
    premise: meaningfulTextSchema,
    candidateRole: meaningfulTextSchema,
    functionalRequirements: z.array(meaningfulTextSchema).min(2).max(8),
    nonGoals: z.array(meaningfulTextSchema).min(1).max(6),
    constraints: z.array(meaningfulTextSchema).min(2).max(8),
    scaleProfile: z.array(meaningfulTextSchema).min(2).max(8),
    roles: z.array(architectureDesignRoleSchema).min(1),
    seniorities: z.array(architectureDesignSenioritySchema).min(1),
    difficulties: z.array(architectureDesignDifficultySchema).min(1),
    primaryTopicKey: architectureDesignIdentifierSchema,
    secondaryTopicKeys: z.array(architectureDesignIdentifierSchema).min(1).max(6),
    dimensionKeys: z.array(architectureDesignDimensionSchema).length(16),
    targetKeywords: z.array(z.string().trim().min(2).max(80)).min(2).max(16),
    expectedMinutes: z.number().int().min(45).max(60),
    realismAnchors: z.array(meaningfulTextSchema).min(3).max(8),
    targetFitExplanation: meaningfulTextSchema,
    coverageExplanation: meaningfulTextSchema,
    stages: architectureDesignScenarioStagesSchema
  })
  .strict()
  .superRefine((scenario, context) => {
    if (new Set(scenario.dimensionKeys).size !== architectureDesignDimensionSchema.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensionKeys"],
        message: "Every reviewed Architecture scenario must cover all sixteen dimensions"
      });
    }
    if (scenario.secondaryTopicKeys.includes(scenario.primaryTopicKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryTopicKeys"],
        message: "The primary scenario topic cannot also be secondary"
      });
    }
  });

export type ArchitectureDesignScenarioStage = z.infer<typeof architectureDesignScenarioStageSchema>;
export type ArchitectureDesignScenario = z.infer<typeof architectureDesignScenarioSchema>;

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
