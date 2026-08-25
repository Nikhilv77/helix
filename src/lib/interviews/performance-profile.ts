import { z } from "zod";

export const CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION = 3 as const;

/** Cross-round signals produced by the two specialized interview engines. */
export const PROBLEM_SOLVING_SKILL_KEY = "problem-solving" as const;
export const DSA_PATTERN_SKILL_PREFIX = "dsa-pattern:" as const;
export const BEHAVIORAL_SKILL_PREFIX = "behavioral:" as const;
export const BEHAVIORAL_DIMENSIONS = ["ownership", "decision", "specificity", "outcome"] as const;

export type BehavioralDimension = (typeof BEHAVIORAL_DIMENSIONS)[number];

export function dsaPatternSkillKey(pattern: string): string {
  return `${DSA_PATTERN_SKILL_PREFIX}${pattern}`;
}

export function behavioralSkillKey(dimension: BehavioralDimension): string {
  return `${BEHAVIORAL_SKILL_PREFIX}${dimension}`;
}

const identifier = z.string().trim().min(1).max(180);
const score100 = z.number().min(0).max(100);
const confidence = z.number().min(0).max(1);
const timestampMs = z.number().int().nonnegative();

export const demonstratedRubricPerformanceSchema = z.object({
  rubricKey: identifier,
  score: score100,
  sampleSize: z.number().int().positive()
});

export const demonstratedSkillProfileSchema = z.object({
  skillKey: identifier,
  /** Demonstrated proficiency on a 0-100 scale, independent of resume relevance. */
  score: score100,
  confidence,
  /** Number of attributable interview questions contributing to this signal. */
  sampleSize: z.number().int().positive(),
  lastObservedAt: timestampMs,
  /** Difference between the newest and oldest observed question score. */
  trend: z.number().min(-100).max(100).nullable(),
  topicKeys: z.array(identifier).min(1),
  rubricPerformance: z.array(demonstratedRubricPerformanceSchema)
});

/**
 * Immutable aggregate of completed adaptive interview sessions. Personalized
 * blueprints contribute technical skills; specialized DSA and resume rounds
 * contribute problem-solving and behavioral signals.
 */
export const candidatePerformanceProfileSchema = z
  .object({
    schemaVersion: z.literal(CANDIDATE_PERFORMANCE_PROFILE_SCHEMA_VERSION),
    id: identifier,
    revision: z.number().int().positive(),
    sourceSessionFingerprint: identifier,
    generatedAt: timestampMs,
    completedSessionCount: z.number().int().positive(),
    answeredQuestionCount: z.number().int().positive(),
    sourceSessionIds: z.array(identifier).min(1),
    skills: z.array(demonstratedSkillProfileSchema).min(1)
  })
  .superRefine((profile, context) => {
    reportDuplicates(profile.sourceSessionIds, "sourceSessionIds", context);
    reportDuplicates(
      profile.skills.map((skill) => skill.skillKey),
      "skills",
      context
    );
  });

export type DemonstratedRubricPerformance = z.infer<typeof demonstratedRubricPerformanceSchema>;
export type DemonstratedSkillProfile = z.infer<typeof demonstratedSkillProfileSchema>;
export type CandidatePerformanceProfile = z.infer<typeof candidatePerformanceProfileSchema>;

export function parseCandidatePerformanceProfile(input: unknown): CandidatePerformanceProfile {
  return candidatePerformanceProfileSchema.parse(input);
}

function reportDuplicates(values: string[], path: string, context: z.RefinementCtx): void {
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
