import { z } from "zod";

import {
  CORE_TECHNICAL_CATALOG_SCHEMA_VERSION,
  coreTechnicalQuestionFormatSchema
} from "./contracts";

const identifierSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .describe(
    "A lowercase kebab-case identifier using only a-z, 0-9, and hyphens; never underscores"
  );
const meaningfulTextSchema = z.string().min(20).max(700);

export const coreTechnicalDifficultySchema = z.enum(["guided", "standard", "stretch"]);

export const REQUIRED_STORY_STAGE_FORMATS = [
  ["mcq"],
  ["predict-explain"],
  ["written"],
  ["spoken", "written"],
  ["artifact-diagnosis"],
  ["debug-repair"],
  ["micro-implementation"],
  ["written", "spoken"]
] as const;

export const generatedStoryStageSchema = z.object({
  order: z.number().int().min(1).max(8),
  key: identifierSchema,
  title: z.string().min(4).max(100),
  format: coreTechnicalQuestionFormatSchema,
  patternKey: identifierSchema,
  objective: meaningfulTextSchema,
  artifactKey: identifierSchema,
  storyDependency: meaningfulTextSchema
});

const generatedStoryStagesSchema = z
  .array(generatedStoryStageSchema)
  .length(8)
  .superRefine((stages, context) => {
    stages.forEach((stage, index) => {
      if (stage.order !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Story stages must be ordered from 1 through 8",
          path: [index, "order"]
        });
      }

      const allowedFormats = REQUIRED_STORY_STAGE_FORMATS[index];
      if (!allowedFormats?.includes(stage.format as never)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Stage format does not match the fixed block contract",
          path: [index, "format"]
        });
      }
    });
  });

export const generatedStoryCandidateSchema = z.object({
  schemaVersion: z.literal(CORE_TECHNICAL_CATALOG_SCHEMA_VERSION),
  key: identifierSchema,
  title: z.string().min(5).max(100),
  premise: meaningfulTextSchema,
  incident: meaningfulTextSchema,
  candidateRole: meaningfulTextSchema,
  primaryTopicKey: identifierSchema,
  secondaryTopicKeys: z.array(identifierSchema).min(1).max(3),
  mechanismKeys: z
    .array(identifierSchema)
    .min(4)
    .max(12)
    .describe("Between 4 and 12 mechanism identifiers, never more than 12"),
  difficulty: coreTechnicalDifficultySchema,
  prerequisiteTopicKeys: z.array(identifierSchema),
  expectedMinutes: z.number().int().min(40).max(50),
  forbiddenTopicKeys: z.array(identifierSchema),
  realismAnchors: z.array(meaningfulTextSchema).min(3).max(6),
  targetFitExplanation: meaningfulTextSchema,
  coverageExplanation: meaningfulTextSchema,
  stages: generatedStoryStagesSchema
});

// The provider-facing reviewed-story schema permits extra candidate coverage.
// The generator normalizes it back to the exact reviewed blueprint before the
// frozen contract is validated.
export const generatedReviewedStoryCandidateWireSchema = generatedStoryCandidateSchema.extend({
  secondaryTopicKeys: z.array(identifierSchema).min(1).max(10),
  mechanismKeys: z.array(identifierSchema).min(4).max(30),
  realismAnchors: z.array(meaningfulTextSchema).min(1).max(8)
});

export const generatedStoryCandidatesSchema = z.object({
  candidates: z.array(generatedStoryCandidateSchema).min(3).max(5)
});

export const storyScoreSchema = z.object({
  domainImportance: z.number().int().min(0).max(20),
  realism: z.number().int().min(0).max(15),
  interviewDensity: z.number().int().min(0).max(20),
  coherence: z.number().int().min(0).max(15),
  stackFit: z.number().int().min(0).max(15),
  personalizedCoverage: z.number().int().min(0).max(15),
  total: z.number().int().min(0).max(100)
});

export const selectedStorySchema = generatedStoryCandidateSchema.extend({
  score: storyScoreSchema,
  selectionReason: meaningfulTextSchema
});

export type CoreTechnicalDifficulty = z.infer<typeof coreTechnicalDifficultySchema>;
export type GeneratedStoryCandidate = z.infer<typeof generatedStoryCandidateSchema>;
export type SelectedCoreTechnicalStory = z.infer<typeof selectedStorySchema>;
