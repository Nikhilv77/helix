import { z } from "zod";

/** Serializable public contracts for the Resume Roast feature. */

const titleText = z.string().trim().min(1).max(120);
const roastLine = z.string().trim().min(1).max(300);
const compactText = z.string().trim().min(1).max(360);
const bulletText = z.string().trim().min(1).max(1_500);
const spokenSummaryText = z.string().trim().min(1).max(800);

/** Stable target choices. Labels intentionally mirror the product requirements. */
export const RESUME_ROAST_ROLE_OPTIONS = [
  { value: "software-engineer", label: "Software Engineer" },
  { value: "frontend-engineer", label: "Frontend Engineer" },
  { value: "backend-engineer", label: "Backend Engineer" },
  { value: "full-stack-engineer", label: "Full-stack Engineer" },
  { value: "mobile-engineer", label: "Mobile Engineer" },
  { value: "data-or-ml-engineer", label: "Data or ML Engineer" },
  { value: "devops-cloud-or-sre", label: "DevOps, Cloud or SRE" },
  { value: "engineering-manager", label: "Engineering Manager" },
  { value: "internship-or-new-grad", label: "Internship or New Grad" },
  { value: "not-sure-yet", label: "Not sure yet" }
] as const;

export const RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS = [
  { value: "early-stage-startup", label: "Early-stage startup" },
  { value: "growing-startup", label: "Growing startup" },
  { value: "product-company", label: "Product company" },
  { value: "big-tech", label: "Big Tech" },
  { value: "consulting-or-service-company", label: "Consulting or service company" },
  { value: "remote-or-international-role", label: "Remote or international role" },
  { value: "anywhere-that-will-hire-me", label: "Anywhere that will hire me" }
] as const;

export const RESUME_ROAST_LEVEL_OPTIONS = [
  { value: "internship-or-new-grad", label: "Internship or New Grad" },
  { value: "junior", label: "Junior" },
  { value: "mid-level", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "staff-or-principal", label: "Staff or Principal" },
  { value: "manager", label: "Manager" }
] as const;

function labelsFor<T extends readonly { value: string; label: string }[]>(options: T) {
  return Object.fromEntries(options.map(({ value, label }) => [value, label])) as Record<
    T[number]["value"],
    T[number]["label"]
  >;
}

export const RESUME_ROAST_ROLE_LABELS = labelsFor(RESUME_ROAST_ROLE_OPTIONS);
export const RESUME_ROAST_COMPANY_ENVIRONMENT_LABELS = labelsFor(
  RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS
);
export const RESUME_ROAST_LEVEL_LABELS = labelsFor(RESUME_ROAST_LEVEL_OPTIONS);

const roleValues = RESUME_ROAST_ROLE_OPTIONS.map((option) => option.value) as [
  (typeof RESUME_ROAST_ROLE_OPTIONS)[number]["value"],
  ...(typeof RESUME_ROAST_ROLE_OPTIONS)[number]["value"][]
];
const companyEnvironmentValues = RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS.map(
  (option) => option.value
) as [
  (typeof RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS)[number]["value"],
  ...(typeof RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS)[number]["value"][]
];
const levelValues = RESUME_ROAST_LEVEL_OPTIONS.map((option) => option.value) as [
  (typeof RESUME_ROAST_LEVEL_OPTIONS)[number]["value"],
  ...(typeof RESUME_ROAST_LEVEL_OPTIONS)[number]["value"][]
];

export const ResumeRoastTargetSchema = z
  .object({
    role: z.enum(roleValues),
    companyEnvironment: z.enum(companyEnvironmentValues),
    level: z.enum(levelValues)
  })
  .strict();

const EvidenceAnchorsSchema = z.array(z.string().trim().min(1).max(500)).min(1).max(3);

export const ResumeRoastStrengthSchema = z
  .object({
    headline: titleText,
    explanation: compactText,
    evidenceAnchors: EvidenceAnchorsSchema
  })
  .strict();

/**
 * The five areas a recruiter and hiring manager actually judge, in the order
 * they judge them. Keys are persisted inside saved scorecards.
 */
export const RESUME_ROAST_DIMENSIONS = [
  {
    key: "roleFit",
    label: "Role fit",
    question: "Does this read like someone who does this job?"
  },
  {
    key: "impact",
    label: "Proof of impact",
    question: "Did anything change because of this person?"
  },
  {
    key: "ownership",
    label: "Level and ownership",
    question: "Have they worked at the level they're applying for?"
  },
  {
    key: "technical",
    label: "Technical credibility",
    question: "Would an engineer on the team believe it?"
  },
  {
    key: "readability",
    label: "Ten-second skim",
    question: "Can a recruiter get the story in ten seconds?"
  }
] as const;

export type ResumeRoastDimensionKey = (typeof RESUME_ROAST_DIMENSIONS)[number]["key"];
const dimensionKeys = RESUME_ROAST_DIMENSIONS.map((dimension) => dimension.key) as [
  ResumeRoastDimensionKey,
  ...ResumeRoastDimensionKey[]
];

export const ResumeRoastProblemSchema = z
  .object({
    joke: roastLine,
    issue: compactText,
    recruiterImpact: compactText,
    improvement: compactText,
    evidenceAnchors: EvidenceAnchorsSchema,
    /** Which scorecard area this problem costs points in (v7+). */
    dimension: z.enum(dimensionKeys).optional(),
    /** The resume text the jab is about, copied server-side from its anchor (v7+). */
    quote: z.string().trim().min(1).max(500).optional()
  })
  .strict();

export const ResumeRoastRewriteSchema = z
  .object({
    before: bulletText,
    after: bulletText,
    rationale: compactText,
    evidenceAnchor: z.string().trim().min(1).max(500)
  })
  .strict();

export const ResumeRoastBandSchema = z.enum([
  "needs-serious-work",
  "has-potential",
  "solid",
  "strong",
  "difficult-to-roast"
]);

export const ResumeRoastVerdictSchema = z
  .object({
    band: ResumeRoastBandSchema,
    explanation: compactText,
    // Legacy 0-100 model guess, kept so roasts saved before the rubric stay
    // readable. Rubric roasts carry `scorecard.overall` instead.
    targetFitScore: z.number().int().min(0).max(100).optional()
  })
  .strict();

export const ResumeRoastDimensionScoreSchema = z
  .object({
    score: z.number().int().min(1).max(5),
    note: compactText,
    evidenceAnchors: z.array(z.string().trim().min(1).max(500)).max(3)
  })
  .strict();

export const ResumeRoastScorecardSchema = z
  .object({
    rubricVersion: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9.-]+$/),
    /** Computed in code from the dimension scores, weights and gates; 1-10. */
    overall: z.number().int().min(1).max(10),
    dimensions: z
      .object({
        roleFit: ResumeRoastDimensionScoreSchema,
        impact: ResumeRoastDimensionScoreSchema,
        ownership: ResumeRoastDimensionScoreSchema,
        technical: ResumeRoastDimensionScoreSchema,
        readability: ResumeRoastDimensionScoreSchema
      })
      .strict()
  })
  .strict();

export const ResumeRoastActionSchema = z
  .object({
    priority: z.number().int().min(1).max(3),
    action: roastLine,
    rationale: compactText
  })
  .strict();

export const ResumeRoastResultSchema = z
  .object({
    openingRoast: roastLine,
    // Optional keeps saved v1-v4 roasts readable. New generations are explicitly
    // prompted to provide the dedicated voice script.
    spokenSummary: spokenSummaryText.optional(),
    strength: ResumeRoastStrengthSchema,
    problems: z.array(ResumeRoastProblemSchema).max(3),
    rewrite: ResumeRoastRewriteSchema.nullable(),
    verdict: ResumeRoastVerdictSchema,
    // Absent on roasts saved before the rubric (prompt v6 and earlier).
    scorecard: ResumeRoastScorecardSchema.optional(),
    actionPlan: z.array(ResumeRoastActionSchema).max(3)
  })
  .strict()
  .superRefine((result, context) => {
    for (const [index, action] of result.actionPlan.entries()) {
      if (action.priority !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actionPlan", index, "priority"],
          message: "Action priorities must be ordered sequentially from 1."
        });
      }
    }
  });

export const ResumeRoastStreamEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("session"),
      roastId: z.string().uuid(),
      replayed: z.boolean(),
      target: ResumeRoastTargetSchema
    })
    .strict(),
  z.object({ type: z.literal("opening_roast"), openingRoast: roastLine }).strict(),
  z.object({ type: z.literal("spoken_summary"), spokenSummary: spokenSummaryText }).strict(),
  z.object({ type: z.literal("strength"), strength: ResumeRoastStrengthSchema }).strict(),
  z.object({ type: z.literal("problem"), problem: ResumeRoastProblemSchema }).strict(),
  z.object({ type: z.literal("rewrite"), rewrite: ResumeRoastRewriteSchema }).strict(),
  z.object({ type: z.literal("verdict"), verdict: ResumeRoastVerdictSchema }).strict(),
  z.object({ type: z.literal("scorecard"), scorecard: ResumeRoastScorecardSchema }).strict(),
  z
    .object({
      type: z.literal("action_plan"),
      actionPlan: z.array(ResumeRoastActionSchema).max(3)
    })
    .strict(),
  z.object({ type: z.literal("done") }).strict(),
  z
    .object({
      type: z.literal("error"),
      code: z.enum([
        "generation-failed",
        "invalid-response",
        "rate-limited",
        "timeout",
        "cancelled"
      ]),
      retryable: z.boolean()
    })
    .strict()
]);

/**
 * What an overall score means, phrased the way a recruiter would say it.
 * Shared by the UI and prompts so "an 8" means the same thing everywhere.
 */
export const RESUME_ROAST_SCORE_MEANINGS = [
  {
    min: 9,
    label: "Shortlist on sight",
    description: "A recruiter would send this to the hiring manager as it is."
  },
  {
    min: 7,
    label: "Would shortlist",
    description: "Clearly fits the role. A few fixes turn it into an easy yes."
  },
  {
    min: 5,
    label: "Borderline",
    description:
      "Relevant, but the reader has to guess at impact or level. It gets through only if the pile is thin."
  },
  {
    min: 3,
    label: "Not yet",
    description: "Some relevant pieces, but it doesn't make the case for this role and level."
  },
  {
    min: 1,
    label: "Wrong pile",
    description: "Reads like a different role or level altogether."
  }
] as const;

export function resumeRoastScoreMeaning(overall: number) {
  return (
    RESUME_ROAST_SCORE_MEANINGS.find((meaning) => overall >= meaning.min) ??
    RESUME_ROAST_SCORE_MEANINGS[RESUME_ROAST_SCORE_MEANINGS.length - 1]!
  );
}

export type ResumeRoastTarget = z.infer<typeof ResumeRoastTargetSchema>;
export type ResumeRoastResult = z.infer<typeof ResumeRoastResultSchema>;
export type ResumeRoastStreamEvent = z.infer<typeof ResumeRoastStreamEventSchema>;
export type ResumeRoastScorecard = z.infer<typeof ResumeRoastScorecardSchema>;
export type ResumeRoastDimensionScore = z.infer<typeof ResumeRoastDimensionScoreSchema>;
export type ResumeRoastBand = z.infer<typeof ResumeRoastBandSchema>;
