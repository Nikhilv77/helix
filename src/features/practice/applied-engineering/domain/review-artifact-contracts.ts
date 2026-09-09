import { z } from "zod";
import { selectedAppliedEngineeringIncidentSchema } from "./incident-contracts";
import { appliedEngineeringQuestionBlockSchema } from "./question-contracts";

export const APPLIED_ENGINEERING_REVIEW_ARTIFACT_VERSION = 1 as const;
export const APPLIED_ENGINEERING_CONTENT_AUDIT_VERSION = "applied-engineering-content-audit-v1";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const appliedEngineeringHumanReviewSchema = z
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
        message: "Approved incident artifacts require a reviewer and review date"
      });
    }
    if (review.status === "candidate" && attested) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Candidate incident artifacts cannot contain an approval attestation"
      });
    }
  });

export const appliedEngineeringReviewArtifactSchema = z
  .object({
    artifactVersion: z.literal(APPLIED_ENGINEERING_REVIEW_ARTIFACT_VERSION),
    auditVersion: z.literal(APPLIED_ENGINEERING_CONTENT_AUDIT_VERSION),
    caseKey: z
      .string()
      .min(2)
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    authoredAt: z.string().datetime({ offset: true }),
    incident: selectedAppliedEngineeringIncidentSchema,
    questionBlock: appliedEngineeringQuestionBlockSchema,
    humanReview: appliedEngineeringHumanReviewSchema
  })
  .strict();

export type AppliedEngineeringHumanReview = z.infer<typeof appliedEngineeringHumanReviewSchema>;
export type AppliedEngineeringReviewArtifact = z.infer<
  typeof appliedEngineeringReviewArtifactSchema
>;
