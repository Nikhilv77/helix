import { z } from "zod";

/**
 * Versioned contracts for the personalized interview-planning pipeline.
 *
 * This module deliberately contains no Prisma or UI types. Resume parsing,
 * persistence, plan generation, and the interview runtime can depend on this
 * boundary without depending on one another.
 */

export const CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION = 1 as const;
export const PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION = 1 as const;

export const INTERVIEW_SESSION_KINDS = [
  "problem-solving",
  "core-technical",
  "applied-engineering",
  "architecture-system-design",
  "final-mock"
] as const;

export const ROLE_FAMILIES = [
  "frontend",
  "backend",
  "fullstack",
  "mobile",
  "data",
  "ai-ml",
  "devops-platform",
  "security",
  "qa",
  "product",
  "other"
] as const;

export const EXPERIENCE_BANDS = [
  "fresher",
  "junior",
  "mid",
  "senior",
  "staff-plus",
  "unknown"
] as const;

export const SKILL_CATEGORIES = [
  "language",
  "framework",
  "database",
  "cloud",
  "infrastructure",
  "devops",
  "ai-ml",
  "testing",
  "architecture",
  "domain",
  "tool",
  "other"
] as const;

export const SKILL_EVIDENCE_SOURCE_KINDS = [
  "work-experience",
  "project",
  "skills-section",
  "professional-summary",
  "achievement",
  "education"
] as const;

export const RELEVANCE_SIGNAL_KINDS = [
  "job-description",
  "target-role",
  "work-experience",
  "project",
  "repeated-use",
  "recency",
  "skills-mention",
  "demonstrated-ability"
] as const;

/**
 * Default precedence for Step 3's relevance engine. Demonstrated ability is an
 * adaptation signal, so it is applied after the resume/job relevance ranking.
 */
export const DEFAULT_RELEVANCE_PRIORITY = [
  "job-description",
  "target-role",
  "work-experience",
  "project",
  "repeated-use",
  "recency",
  "skills-mention"
] as const satisfies readonly RelevanceSignalKind[];

export const QUESTION_FORMATS = ["spoken", "typed", "code", "mcq", "diagram"] as const;

export const BLUEPRINT_STAGE_KINDS = [
  "warm-up",
  "core",
  "scenario",
  "design",
  "reflection",
  "mixed"
] as const;

export const BLUEPRINT_DIFFICULTIES = [
  "foundational",
  "intermediate",
  "advanced",
  "adaptive"
] as const;

export type InterviewSessionKind = (typeof INTERVIEW_SESSION_KINDS)[number];
export type RoleFamily = (typeof ROLE_FAMILIES)[number];
export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export type SkillEvidenceSourceKind = (typeof SKILL_EVIDENCE_SOURCE_KINDS)[number];
export type RelevanceSignalKind = (typeof RELEVANCE_SIGNAL_KINDS)[number];
export type QuestionFormat = (typeof QUESTION_FORMATS)[number];
export type BlueprintStageKind = (typeof BLUEPRINT_STAGE_KINDS)[number];
export type BlueprintDifficulty = (typeof BLUEPRINT_DIFFICULTIES)[number];

const nonEmptyString = z.string().trim().min(1);
const identifier = nonEmptyString.max(160);
const score01 = z.number().min(0).max(1);
const score100 = z.number().min(0).max(100);
const timestampMs = z.number().int().nonnegative();
const percentage = z.number().positive().max(100);

export const relevanceSignalSchema = z.object({
  kind: z.enum(RELEVANCE_SIGNAL_KINDS),
  /** Normalized strength of this signal before its priority is applied. */
  strength: score01,
  /** Weight selected by the relevance policy. */
  weight: score01,
  /** Contribution to the final 0–100 relevance score. */
  contribution: score100,
  reason: nonEmptyString.max(500)
});

export const skillRelevanceScoreSchema = z.object({
  score: score100,
  confidence: score01,
  signals: z.array(relevanceSignalSchema),
  reasons: z.array(nonEmptyString.max(500)).min(1)
});

export const skillEvidenceSchema = z.object({
  id: identifier,
  sourceKind: z.enum(SKILL_EVIDENCE_SOURCE_KINDS),
  /** Identifier of the experience/project entry when one exists. */
  sourceId: identifier.nullable(),
  sourceLabel: nonEmptyString.max(240),
  /** Short supporting text, not the entire resume section. */
  excerpt: z.string().trim().max(1_000).nullable(),
  recencyMonths: z.number().int().nonnegative().nullable(),
  durationMonths: z.number().int().nonnegative().nullable(),
  occurrences: z.number().int().positive(),
  confidence: score01
});

export const candidateSkillSchema = z.object({
  /** Canonical, stable key such as `react`, `spring-boot`, or `postgresql`. */
  key: identifier,
  label: nonEmptyString.max(120),
  category: z.enum(SKILL_CATEGORIES),
  aliases: z.array(nonEmptyString.max(120)),
  /** Primary skills are eligible to appear in personalized session titles. */
  primary: z.boolean(),
  evidence: z.array(skillEvidenceSchema).min(1),
  relevance: skillRelevanceScoreSchema
});

export const candidateDomainSchema = z.object({
  key: identifier,
  label: nonEmptyString.max(160),
  summary: nonEmptyString.max(700),
  skillKeys: z.array(identifier),
  evidenceIds: z.array(identifier),
  relevance: skillRelevanceScoreSchema
});

export const candidateProjectSchema = z.object({
  id: identifier,
  name: nonEmptyString.max(200),
  summary: nonEmptyString.max(1_000),
  candidateRole: z.string().trim().max(240).nullable(),
  outcome: z.string().trim().max(700).nullable(),
  skillKeys: z.array(identifier),
  evidenceIds: z.array(identifier),
  importance: score01
});

export const candidateInterviewProfileSchema = z
  .object({
    schemaVersion: z.literal(CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION),
    id: identifier,
    revision: z.number().int().positive(),
    /** Hash of the resume input used to produce this immutable revision. */
    sourceResumeFingerprint: identifier,
    generatedAt: timestampMs,
    headline: z.string().trim().max(300),
    inferredRole: z.object({
      title: nonEmptyString.max(160),
      family: z.enum(ROLE_FAMILIES),
      confidence: score01,
      rationale: nonEmptyString.max(700)
    }),
    experience: z.object({
      estimatedYears: z.number().nonnegative().max(80).nullable(),
      band: z.enum(EXPERIENCE_BANDS),
      confidence: score01
    }),
    skills: z.array(candidateSkillSchema),
    domains: z.array(candidateDomainSchema),
    importantProjects: z.array(candidateProjectSchema),
    warnings: z.array(nonEmptyString.max(700))
  })
  .superRefine((profile, context) => {
    reportDuplicateValues(
      profile.skills.map((skill) => skill.key),
      "skills",
      context
    );
    reportDuplicateValues(
      profile.domains.map((domain) => domain.key),
      "domains",
      context
    );
    reportDuplicateValues(
      profile.importantProjects.map((project) => project.id),
      "importantProjects",
      context
    );
  });

export const blueprintTopicSchema = z.object({
  key: identifier,
  label: nonEmptyString.max(160),
  targetPercent: percentage,
  skillKeys: z.array(identifier),
  objectives: z.array(nonEmptyString.max(500)).min(1)
});

export const blueprintStageSchema = z.object({
  kind: z.enum(BLUEPRINT_STAGE_KINDS),
  questionCount: z.number().int().positive().max(20),
  formats: z.array(z.enum(QUESTION_FORMATS)).min(1),
  purpose: nonEmptyString.max(700)
});

export const blueprintRubricDimensionSchema = z.object({
  key: identifier,
  label: nonEmptyString.max(160),
  weightPercent: percentage,
  strongSignals: z.array(nonEmptyString.max(500)).min(1),
  weakSignals: z.array(nonEmptyString.max(500)).min(1)
});

export const sessionBlueprintSchema = z
  .object({
    id: identifier,
    kind: z.enum(INTERVIEW_SESSION_KINDS),
    order: z.number().int().min(1).max(INTERVIEW_SESSION_KINDS.length),
    /** Personalized candidate-facing name; the stable identity is `kind`. */
    title: nonEmptyString.max(160),
    subtitle: nonEmptyString.max(240),
    durationMinutes: z.number().int().min(5).max(120),
    difficulty: z.enum(BLUEPRINT_DIFFICULTIES),
    rationale: nonEmptyString.max(1_000),
    topics: z.array(blueprintTopicSchema).min(1),
    structure: z.array(blueprintStageSchema).min(1),
    followUpPolicy: z.object({
      maxPerQuestion: z.number().int().min(0).max(5),
      probeWeakClaims: z.boolean(),
      increaseDifficultyAfterStrongAnswer: z.boolean(),
      stayWithinBlueprintTopics: z.literal(true)
    }),
    rubric: z.array(blueprintRubricDimensionSchema).min(1)
  })
  .superRefine((blueprint, context) => {
    requirePercentTotal(blueprint.topics, "targetPercent", ["topics"], context);
    requirePercentTotal(blueprint.rubric, "weightPercent", ["rubric"], context);
    reportDuplicateValues(
      blueprint.topics.map((topic) => topic.key),
      "topics",
      context
    );
    reportDuplicateValues(
      blueprint.rubric.map((dimension) => dimension.key),
      "rubric",
      context
    );
  });

export const interviewPlanSourceSnapshotSchema = z.object({
  candidateProfile: z.object({
    id: identifier,
    revision: z.number().int().positive(),
    sourceResumeFingerprint: identifier
  }),
  targetRole: z.object({
    title: nonEmptyString.max(160),
    family: z.enum(ROLE_FAMILIES),
    source: z.enum(["declared", "inferred", "job-description"])
  }),
  /** Added later without changing the plan contract. */
  jobDescription: z
    .object({
      id: identifier,
      revision: z.number().int().positive(),
      fingerprint: identifier
    })
    .nullable(),
  /** The performance revision that influenced this plan, if any. */
  performanceProfile: z
    .object({
      id: identifier,
      revision: z.number().int().positive()
    })
    .nullable(),
  /** Verified Practice evidence that influenced this plan. Optional for v1 history. */
  practiceEvidence: z
    .object({
      id: identifier,
      revision: z.number().int().positive()
    })
    .nullable()
    .optional()
});

export const personalizedInterviewPlanSchema = z
  .object({
    schemaVersion: z.literal(PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION),
    id: identifier,
    revision: z.number().int().positive(),
    status: z.enum(["draft", "ready", "superseded"]),
    generatedAt: timestampMs,
    sourceSnapshot: interviewPlanSourceSnapshotSchema,
    rationale: nonEmptyString.max(1_500),
    sessions: z.array(sessionBlueprintSchema).length(INTERVIEW_SESSION_KINDS.length)
  })
  .superRefine((plan, context) => {
    reportDuplicateValues(
      plan.sessions.map((session) => session.id),
      "sessions",
      context
    );

    INTERVIEW_SESSION_KINDS.forEach((expectedKind, index) => {
      const session = plan.sessions[index];
      if (!session) return;

      if (session.kind !== expectedKind) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sessions", index, "kind"],
          message: `Expected stable session kind ${expectedKind} at position ${index + 1}`
        });
      }
      if (session.order !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sessions", index, "order"],
          message: `Expected session order ${index + 1}`
        });
      }
    });
  });

export type RelevanceSignal = z.infer<typeof relevanceSignalSchema>;
export type SkillRelevanceScore = z.infer<typeof skillRelevanceScoreSchema>;
export type SkillEvidence = z.infer<typeof skillEvidenceSchema>;
export type CandidateSkill = z.infer<typeof candidateSkillSchema>;
export type CandidateDomain = z.infer<typeof candidateDomainSchema>;
export type CandidateInterviewProject = z.infer<typeof candidateProjectSchema>;
export type CandidateInterviewProfile = z.infer<typeof candidateInterviewProfileSchema>;
export type BlueprintTopic = z.infer<typeof blueprintTopicSchema>;
export type BlueprintStage = z.infer<typeof blueprintStageSchema>;
export type BlueprintRubricDimension = z.infer<typeof blueprintRubricDimensionSchema>;
export type SessionBlueprint = z.infer<typeof sessionBlueprintSchema>;
export type InterviewPlanSourceSnapshot = z.infer<typeof interviewPlanSourceSnapshotSchema>;
export type PersonalizedInterviewPlan = z.infer<typeof personalizedInterviewPlanSchema>;

export function parseCandidateInterviewProfile(input: unknown): CandidateInterviewProfile {
  return candidateInterviewProfileSchema.parse(input);
}

export function parsePersonalizedInterviewPlan(input: unknown): PersonalizedInterviewPlan {
  return personalizedInterviewPlanSchema.parse(input);
}

export function isPersonalizedInterviewPlan(input: unknown): input is PersonalizedInterviewPlan {
  return personalizedInterviewPlanSchema.safeParse(input).success;
}

function requirePercentTotal<T extends Record<K, number>, K extends keyof T>(
  values: T[],
  key: K,
  path: Array<string | number>,
  context: z.RefinementCtx
) {
  const total = values.reduce((sum, value) => sum + value[key], 0);
  if (Math.abs(total - 100) <= 0.001) return;

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message: `Weights must total 100; received ${Number(total.toFixed(3))}`
  });
}

function reportDuplicateValues(values: string[], path: string, context: z.RefinementCtx) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  if (!duplicates.size) return;
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message: `Values must be unique; duplicates: ${[...duplicates].join(", ")}`
  });
}
