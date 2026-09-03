import { z } from "zod";

const titleText = z.string().trim().min(1).max(120);
const roastLine = z.string().trim().min(1).max(220);
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

export const ResumeRoastProblemSchema = z
  .object({
    joke: roastLine,
    issue: compactText,
    recruiterImpact: compactText,
    improvement: compactText,
    evidenceAnchors: EvidenceAnchorsSchema
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

export const ResumeRoastVerdictSchema = z
  .object({
    band: z.enum(["needs-serious-work", "has-potential", "solid", "strong", "difficult-to-roast"]),
    explanation: compactText,
    targetFitScore: z.number().int().min(0).max(100)
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
    actionPlan: z.array(ResumeRoastActionSchema).min(1).max(3)
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
  z
    .object({
      type: z.literal("action_plan"),
      actionPlan: z.array(ResumeRoastActionSchema).min(1).max(3)
    })
    .strict(),
  z.object({ type: z.literal("done") }).strict(),
  z
    .object({
      type: z.literal("error"),
      code: z.enum(["generation-failed", "invalid-response", "timeout", "cancelled"]),
      retryable: z.boolean()
    })
    .strict()
]);

export type ResumeRoastTarget = z.infer<typeof ResumeRoastTargetSchema>;
export type ResumeRoastResult = z.infer<typeof ResumeRoastResultSchema>;
export type ResumeRoastStreamEvent = z.infer<typeof ResumeRoastStreamEventSchema>;
