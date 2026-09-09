import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import {
  resumeExtractionSchema,
  resumeFileSchema
} from "@/features/onboarding/contracts/resume-extraction";
import { personaById } from "@/lib/avatars/personas";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { LEVELS, ROLES } from "@/features/interviews/server/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    .transform((id) => personaById(id)?.id ?? null),
  resumeFile: resumeFileSchema,
  extraction: resumeExtractionSchema
});

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
    const existing = await app.profileService.get(ownerId);
    if (existing.onboardingCompletedAt) {
      throw new ApiRouteError(
        409,
        "ONBOARDING_ALREADY_COMPLETED",
        "Use the resume update review to replace an existing resume."
      );
    }
    const { targetRole, level, teacherId, extraction, resumeFile } = body.data;
    const profile = await app.profileService.completeOnboarding(ownerId, {
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
    const frontendRoadmap =
      targetRole === "fullstack"
        ? await app.frontendRoadmapService.ensureFrontendRoadmap(ownerId)
        : null;

    logger.log(
      JSON.stringify({
        event: "onboarding.completed",
        ownerId,
        targetRole,
        level,
        frontendRoadmapId: frontendRoadmap?.roadmapId ?? null
      })
    );

    // Welcome delivery is durable and idempotent, but it must never hold the
    // onboarding response hostage to Clerk or the email provider.
    after(() =>
      app.teacherNotificationService
        .welcome({
          ownerId,
          teacherId,
          candidateName: extraction.fullName,
          targetRole,
          focusAreas: extraction.focusAreas
        })
        .catch((error) =>
          logger.error(
            JSON.stringify({
              event: "teacher.welcome.failed",
              ownerId,
              reason: error instanceof Error ? error.message : String(error)
            })
          )
        )
    );

    return apiSuccess({
      profile,
      resumeFile,
      extraction,
      frontendRoadmap
    });
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
