import { z } from "zod";
import {
  APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION,
  appliedEngineeringDifficultySchema,
  appliedEngineeringIdentifierSchema,
  appliedEngineeringProductionSignalSchema,
  appliedEngineeringQuestionFormatSchema
} from "./contracts";

const meaningfulTextSchema = z.string().trim().min(20).max(1_200);

export const REQUIRED_APPLIED_ENGINEERING_STAGE_FORMATS = [
  ["mcq"],
  ["artifact-diagnosis", "written"],
  ["written"],
  ["artifact-diagnosis", "written"],
  ["debug-repair"],
  ["micro-implementation"],
  ["production-decision", "written"],
  ["production-decision", "written"]
] as const;

export const appliedEngineeringIncidentStageSchema = z
  .object({
    order: z.number().int().min(1).max(8),
    key: appliedEngineeringIdentifierSchema,
    title: z.string().trim().min(4).max(100),
    format: appliedEngineeringQuestionFormatSchema,
    patternKey: appliedEngineeringIdentifierSchema,
    objective: meaningfulTextSchema,
    artifactKey: appliedEngineeringIdentifierSchema,
    productionSignalKeys: z.array(appliedEngineeringProductionSignalSchema).min(1).max(5),
    incidentDependency: meaningfulTextSchema
  })
  .strict();

const incidentStagesSchema = z
  .array(appliedEngineeringIncidentStageSchema)
  .length(8)
  .superRefine((stages, context) => {
    const stageKeys = new Set<string>();
    stages.forEach((stage, index) => {
      if (stage.order !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "order"],
          message: "Incident stages must be ordered from 1 through 8"
        });
      }
      if (stageKeys.has(stage.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "key"],
          message: "Incident stage keys must be unique"
        });
      }
      stageKeys.add(stage.key);
      const allowed = REQUIRED_APPLIED_ENGINEERING_STAGE_FORMATS[index];
      if (!allowed?.includes(stage.format as never)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "format"],
          message: "Stage format does not match the Applied Engineering block contract"
        });
      }
    });
  });

const appliedEngineeringIncidentBaseSchema = z
  .object({
    schemaVersion: z.literal(APPLIED_ENGINEERING_CATALOG_SCHEMA_VERSION),
    key: appliedEngineeringIdentifierSchema,
    title: z.string().trim().min(5).max(120),
    premise: meaningfulTextSchema,
    incident: meaningfulTextSchema,
    customerImpact: meaningfulTextSchema,
    candidateRole: meaningfulTextSchema,
    constraints: z.array(meaningfulTextSchema).min(2).max(6),
    primaryTopicKey: appliedEngineeringIdentifierSchema,
    secondaryTopicKeys: z.array(appliedEngineeringIdentifierSchema).min(1).max(5),
    productionSignalKeys: z.array(appliedEngineeringProductionSignalSchema).min(5).max(16),
    difficulty: appliedEngineeringDifficultySchema,
    prerequisiteIncidentKeys: z.array(appliedEngineeringIdentifierSchema),
    expectedMinutes: z.number().int().min(40).max(55),
    realismAnchors: z.array(meaningfulTextSchema).min(3).max(8),
    targetFitExplanation: meaningfulTextSchema,
    coverageExplanation: meaningfulTextSchema,
    stages: incidentStagesSchema
  })
  .strict();

function validateIncidentTopics(
  incident: z.infer<typeof appliedEngineeringIncidentBaseSchema>,
  context: z.RefinementCtx
) {
  if (incident.secondaryTopicKeys.includes(incident.primaryTopicKey)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["secondaryTopicKeys"],
      message: "The primary incident topic cannot also be secondary"
    });
  }
}

export const appliedEngineeringIncidentSchema =
  appliedEngineeringIncidentBaseSchema.superRefine(validateIncidentTopics);

export const appliedEngineeringIncidentScoreSchema = z
  .object({
    baselineGapTransfer: z.number().int().min(0).max(25),
    targetRoleJob: z.number().int().min(0).max(20),
    resumeProjectRelevance: z.number().int().min(0).max(15),
    productionEvidenceCoverage: z.number().int().min(0).max(20),
    realism: z.number().int().min(0).max(10),
    novelty: z.number().int().min(0).max(10),
    total: z.number().int().min(0).max(100)
  })
  .strict();

export const selectedAppliedEngineeringIncidentSchema = appliedEngineeringIncidentBaseSchema
  .extend({
    score: appliedEngineeringIncidentScoreSchema,
    selectionReason: meaningfulTextSchema
  })
  .superRefine(validateIncidentTopics);

export type AppliedEngineeringIncidentStage = z.infer<typeof appliedEngineeringIncidentStageSchema>;
export type AppliedEngineeringIncident = z.infer<typeof appliedEngineeringIncidentSchema>;
export type SelectedAppliedEngineeringIncident = z.infer<
  typeof selectedAppliedEngineeringIncidentSchema
>;
