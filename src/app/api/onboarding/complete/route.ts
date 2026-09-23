import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import {
  resumeExtractionSchema,
  resumeFileSchema
} from "@/features/onboarding/contracts/resume-extraction";
import { selectableTeacherById } from "@/lib/avatars/personas";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { LEVELS, ROLES } from "@/features/interviews/server/types";
import { verifyResumePreview } from "@/features/profile/server/resume-preview-token";

export const dynamic = "force-dynamic";

const logger = new Logger("OnboardingComplete");

const completeSchema = z.object({
  targetRole: z.enum(ROLES),
  level: z.enum(LEVELS),
  /**
   * The teacher chosen on the first onboarding step. Validated against the
   * registry rather than stored as free text, so an unknown id cannot be
   * written to the profile and later fail to resolve to a model.
   */
  teacherId: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((id) => selectableTeacherById(id)?.id ?? null),
  resumeFile: resumeFileSchema.extend({
    contentFingerprint: z.string().regex(/^sha256-[a-f0-9]{64}$/)
  }),
  extraction: resumeExtractionSchema,
  confirmationToken: z.string().regex(/^[a-f0-9]{64}$/),
  previewExpiresAt: z.number().int().positive()
}).strict();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const body = completeSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new ApiRouteError(
        400,
        "ONBOARDING_COMPLETE_INVALID",
        "Trailgrad could not finish onboarding from this resume preview."
      );
    }

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    const { targetRole, level, teacherId, extraction, resumeFile, confirmationToken, previewExpiresAt } =
      body.data;
    const signingSecret = app.config.interviewAuthSecret;
    if (
      !signingSecret ||
      !verifyResumePreview(
        { resumeFile, extraction },
        ownerId,
        previewExpiresAt,
        confirmationToken,
        signingSecret
      )
    ) {
      throw new ApiRouteError(
        409,
        "RESUME_PREVIEW_EXPIRED",
        "This resume preview expired or changed. Analyse the file again."
      );
    }

    const existing = await app.profileService.onboardingState(ownerId);
    if (existing.onboardingCompletedAt) {
      throw new ApiRouteError(
        409,
        "ONBOARDING_ALREADY_COMPLETED",
        "Use the resume update review to replace an existing resume."
      );
    }
    await app.profileService.completeOnboarding(ownerId, {
      targetRole,
      level,
      teacherId,
      headline: extraction.headline,
      context: extraction.context,
      focusAreas: extraction.focusAreas,
      stories: extraction.stories,
      resume: {
        fileName: resumeFile.fileName,
        mimeType: resumeFile.mimeType,
        contentFingerprint: resumeFile.contentFingerprint,
        confidence: extraction.confidence,
        fullName: extraction.fullName,
        skills: extraction.skills,
        warnings: extraction.warnings,
        experience: extraction.experience,
        education: extraction.education,
        certifications: extraction.certifications,
        projects: extraction.projects,
        achievements: extraction.achievements,
        practiceQuestions: extraction.practiceQuestions,
        roadmap: extraction.roadmap,
        document: extraction.document,
        evidence: extraction.evidence
      }
    });
    logger.log(
      JSON.stringify({
        event: "onboarding.completed",
        ownerId,
        targetRole,
        level,
        frontendRoadmapDeferred: targetRole === "fullstack"
      })
    );

    // These writes are durable/idempotent but are not required for the browser
    // to enter the product. Run them concurrently after the response instead
    // of adding roadmap, Clerk, and email latency to the completion click.
    after(async () => {
      const [roadmapResult, welcomeResult] = await Promise.allSettled([
        targetRole === "fullstack"
          ? app.frontendRoadmapService.ensureFrontendRoadmap(ownerId)
          : Promise.resolve(null),
        app.teacherNotificationService.welcome({
          ownerId,
          teacherId,
          candidateName: extraction.fullName,
          targetRole,
          focusAreas: extraction.focusAreas
        })
      ]);
      if (roadmapResult.status === "rejected") {
        logger.error(
          JSON.stringify({
            event: "onboarding.roadmap.failed",
            ownerId,
            reason: describeError(roadmapResult.reason)
          })
        );
      }
      if (welcomeResult.status === "rejected") {
        logger.error(
          JSON.stringify({
            event: "teacher.welcome.failed",
            ownerId,
            reason: describeError(welcomeResult.reason)
          })
        );
      }
    });

    const response = apiSuccess({ completed: true as const });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    if (!(error instanceof ApiRouteError)) {
      logger.error(
        JSON.stringify({
          event: "onboarding.complete.failed",
          reason: error instanceof Error ? error.message : String(error)
        }),
        error
      );
    }
    return apiError(error, request.nextUrl.pathname);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
