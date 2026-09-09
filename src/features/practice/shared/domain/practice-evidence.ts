import { z } from "zod";

export const CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const PRACTICE_MASTERY_SCORE = 82 as const;
export const PRACTICE_WEAK_SCORE = 65 as const;

const identifier = z.string().trim().min(1).max(180);
const score100 = z.number().min(0).max(100);
const confidence = z.number().min(0).max(1);
const timestampMs = z.number().int().nonnegative();

export const practiceTopicEvidenceSchema = z.object({
  topicKey: identifier,
  score: score100,
  sampleSize: z.number().int().positive(),
  lastObservedAt: timestampMs
});

export const practiceSkillEvidenceSchema = z.object({
  skillKey: identifier,
  score: score100,
  confidence,
  sampleSize: z.number().int().positive(),
  lastObservedAt: timestampMs,
  trend: z.number().min(-100).max(100).nullable(),
  topicKeys: z.array(identifier).min(1),
  hintsUsed: z.number().int().nonnegative(),
  hintDependenceRate: confidence,
  repeatedAttemptCount: z.number().int().nonnegative(),
  retryDependenceRate: confidence
});

export const recentPracticeQuestionEvidenceSchema = z.object({
  attemptId: identifier,
  questionId: identifier,
  sourceType: z.enum(["PREP", "DSA"]),
  title: z.string().trim().min(1).max(300),
  format: z.enum(["mcq", "typed", "spoken", "diagram", "code", "predict-run", "find-the-flaw", "diagnose"]),
  score: score100,
  observedAt: timestampMs,
  hintsUsed: z.number().int().nonnegative(),
  attemptOrdinal: z.number().int().positive(),
  topicKeys: z.array(identifier).min(1)
});

export const practiceCodeEvidenceSchema = z.object({
  attemptId: identifier,
  questionId: identifier,
  language: identifier,
  score: score100,
  accepted: z.boolean(),
  testsPassed: z.number().int().nonnegative(),
  testCount: z.number().int().nonnegative(),
  observedAt: timestampMs
});

export const candidatePracticeEvidenceSchema = z
  .object({
    schemaVersion: z.literal(CANDIDATE_PRACTICE_EVIDENCE_SCHEMA_VERSION),
    id: identifier,
    revision: z.number().int().positive(),
    sourceAttemptFingerprint: identifier,
    generatedAt: timestampMs,
    verifiedAttemptCount: z.number().int().positive(),
    verifiedQuestionCount: z.number().int().positive(),
    sourceAttemptIds: z.array(identifier).min(1),
    skills: z.array(practiceSkillEvidenceSchema).min(1),
    masteryTopics: z.array(practiceTopicEvidenceSchema),
    weakTopics: z.array(practiceTopicEvidenceSchema),
    recentQuestions: z.array(recentPracticeQuestionEvidenceSchema).max(25),
    codeEvidence: z.array(practiceCodeEvidenceSchema).max(25)
  })
  .superRefine((evidence, context) => {
    reportDuplicates(evidence.sourceAttemptIds, "sourceAttemptIds", context);
    reportDuplicates(
      evidence.skills.map((skill) => skill.skillKey),
      "skills",
      context
    );
    reportDuplicates(
      evidence.masteryTopics.map((topic) => topic.topicKey),
      "masteryTopics",
      context
    );
    reportDuplicates(
      evidence.weakTopics.map((topic) => topic.topicKey),
      "weakTopics",
      context
    );
    reportDuplicates(
      evidence.recentQuestions.map((question) => question.attemptId),
      "recentQuestions",
      context
    );
    reportDuplicates(
      evidence.codeEvidence.map((attempt) => attempt.attemptId),
      "codeEvidence",
      context
    );
  });

export type PracticeTopicEvidence = z.infer<typeof practiceTopicEvidenceSchema>;
export type PracticeSkillEvidence = z.infer<typeof practiceSkillEvidenceSchema>;
export type RecentPracticeQuestionEvidence = z.infer<
  typeof recentPracticeQuestionEvidenceSchema
>;
export type PracticeCodeEvidence = z.infer<typeof practiceCodeEvidenceSchema>;
export type CandidatePracticeEvidence = z.infer<typeof candidatePracticeEvidenceSchema>;

export function parseCandidatePracticeEvidence(input: unknown): CandidatePracticeEvidence {
  return candidatePracticeEvidenceSchema.parse(input);
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
