import { z } from "zod";
import { architectureDesignQuestionBlockSchema } from "./question-contracts";
import { architectureDesignScenarioSchema } from "./scenario-contracts";

export const ARCHITECTURE_DESIGN_REVIEW_ARTIFACT_VERSION = 1 as const;
export const ARCHITECTURE_DESIGN_CONTENT_AUDIT_VERSION =
  "architecture-design-content-audit-v1" as const;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const architectureDesignHumanReviewSchema = z
  .object({
    status: z.enum(["candidate", "approved", "rejected"]),
    reviewerId: z.string().trim().min(2).max(160).nullable(),
    reviewedAt: isoDateSchema.nullable(),
    notes: z.array(z.string().trim().min(20).max(700)).min(1).max(8)
  })
  .strict()
  .superRefine((review, context) => {
    const attested = review.reviewerId !== null && review.reviewedAt !== null;
    if (review.status === "approved" && !attested) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Approved Architecture artifacts require a human reviewer and review date"
      });
    }
    if (review.status === "candidate" && attested) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Candidate Architecture artifacts cannot contain an approval attestation"
      });
    }
  });

export const architectureDesignReviewArtifactSchema = z
  .object({
    artifactVersion: z.literal(ARCHITECTURE_DESIGN_REVIEW_ARTIFACT_VERSION),
    auditVersion: z.literal(ARCHITECTURE_DESIGN_CONTENT_AUDIT_VERSION),
    caseKey: z
      .string()
      .min(2)
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    authoredAt: z.string().datetime({ offset: true }),
    authoring: z
      .object({
        mode: z.literal("ai-assisted"),
        provider: z.string().trim().min(1).max(80),
        model: z.string().trim().min(1).max(120),
        promptVersion: z.string().trim().min(2).max(160)
      })
      .strict(),
    scenario: architectureDesignScenarioSchema,
    questionBlock: architectureDesignQuestionBlockSchema,
    humanReview: architectureDesignHumanReviewSchema
  })
  .strict();

export type ArchitectureDesignHumanReview = z.infer<typeof architectureDesignHumanReviewSchema>;
export type ArchitectureDesignReviewArtifact = z.infer<
  typeof architectureDesignReviewArtifactSchema
>;
