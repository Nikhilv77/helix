import { z } from "zod";

export const CORE_TECHNICAL_CATALOG_SCHEMA_VERSION = 1 as const;

const identifierSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const labelSchema = z.string().min(2).max(160);
const descriptionSchema = z.string().min(12).max(600);
const sourceUrlSchema = z.string().url().startsWith("https://");
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const coreTechnicalImportanceSchema = z.enum(["essential", "high", "supporting"]);

export const coreTechnicalPublicationStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "retired"
]);

export const coreTechnicalQuestionFormatSchema = z.enum([
  "mcq",
  "predict-explain",
  "written",
  "spoken",
  "artifact-diagnosis",
  "debug-repair",
  "micro-implementation",
  "production-decision"
]);

export const interviewEvidenceSourceSchema = z.object({
  id: identifierSchema,
  kind: z.enum(["first-person-report", "reviewed-question-set", "interviewer-guide"]),
  publisher: labelSchema,
  title: labelSchema,
  url: sourceUrlSchema,
  reviewedAt: isoDateSchema
});

export const technicalSourceSchema = z.object({
  id: identifierSchema,
  publisher: labelSchema,
  title: labelSchema,
  url: sourceUrlSchema,
  reviewedAt: isoDateSchema
});

export const coreTechnicalInterviewPatternSchema = z.object({
  schemaVersion: z.literal(CORE_TECHNICAL_CATALOG_SCHEMA_VERSION),
  key: identifierSchema,
  title: labelSchema,
  normalizedPrompt: descriptionSchema,
  mechanismKeys: z.array(identifierSchema).min(1),
  topicKeys: z.array(identifierSchema).min(1),
  roles: z.array(identifierSchema).min(1),
  seniorities: z.array(z.enum(["junior", "mid", "senior", "staff"])).min(1),
  languages: z.array(identifierSchema).min(1),
  runtimes: z.array(identifierSchema).min(1),
  frameworks: z.array(identifierSchema),
  formats: z.array(coreTechnicalQuestionFormatSchema).min(1),
  importance: coreTechnicalImportanceSchema,
  evidenceSourceIds: z.array(identifierSchema).min(2),
  technicalSourceIds: z.array(identifierSchema).min(1),
  expectedSignals: z.array(descriptionSchema).min(2),
  commonMistakes: z.array(descriptionSchema).min(1),
  followUps: z.array(descriptionSchema).min(1),
  status: coreTechnicalPublicationStatusSchema,
  lastReviewedAt: isoDateSchema
});

export const coreTechnicalDomainTopicSchema = z.object({
  key: identifierSchema,
  title: labelSchema,
  importance: coreTechnicalImportanceSchema,
  description: descriptionSchema,
  mechanismKeys: z.array(identifierSchema).min(1),
  prerequisiteTopicKeys: z.array(identifierSchema),
  interviewPatternKeys: z.array(identifierSchema).min(1)
});

export const coreTechnicalDomainMapSchema = z.object({
  schemaVersion: z.literal(CORE_TECHNICAL_CATALOG_SCHEMA_VERSION),
  key: identifierSchema,
  title: labelSchema,
  roles: z.array(identifierSchema).min(1),
  language: identifierSchema,
  runtime: identifierSchema,
  runtimeVersion: labelSchema,
  topics: z.array(coreTechnicalDomainTopicSchema).min(1),
  lastReviewedAt: isoDateSchema
});

export type CoreTechnicalImportance = z.infer<typeof coreTechnicalImportanceSchema>;
export type CoreTechnicalQuestionFormat = z.infer<typeof coreTechnicalQuestionFormatSchema>;
export type InterviewEvidenceSource = z.infer<typeof interviewEvidenceSourceSchema>;
export type TechnicalSource = z.infer<typeof technicalSourceSchema>;
export type CoreTechnicalInterviewPattern = z.infer<typeof coreTechnicalInterviewPatternSchema>;
export type CoreTechnicalDomainTopic = z.infer<typeof coreTechnicalDomainTopicSchema>;
export type CoreTechnicalDomainMap = z.infer<typeof coreTechnicalDomainMapSchema>;

export function parseCoreTechnicalInterviewPatterns(
  patterns: unknown
): CoreTechnicalInterviewPattern[] {
  return z.array(coreTechnicalInterviewPatternSchema).parse(patterns);
}

export function parseCoreTechnicalDomainMap(domainMap: unknown): CoreTechnicalDomainMap {
  return coreTechnicalDomainMapSchema.parse(domainMap);
}
