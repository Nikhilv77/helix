import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resumeExtractionSchema, resumeFileSchema } from "@/app/api/onboarding/complete/route";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { verifyResumePreview } from "@/server/profile/resume-preview-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const confirmationSchema = z
  .object({
    resumeFile: resumeFileSchema.extend({
      contentFingerprint: z.string().regex(/^sha256-[a-f0-9]{64}$/)
    }),
    extraction: resumeExtractionSchema,
    confirmationToken: z.string().regex(/^[a-f0-9]{64}$/),
    previewExpiresAt: z.number().int().positive()
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const body = confirmationSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new ApiRouteError(
        400,
        "RESUME_CONFIRMATION_INVALID",
        "Trailgrad could not confirm this resume preview. Analyse the file again."
      );
    }

    const ownerId = authenticatedOwnerId(userId);
    const { resumeFile, extraction, confirmationToken, previewExpiresAt } = body.data;
    const signingSecret = getAppContainer().config.interviewAuthSecret;
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
    const profile = await getAppContainer().profileService.confirmResumeUpdate(ownerId, {
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
    });
    const response = apiSuccess({ profile });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return apiError(
      error instanceof ApiRouteError
        ? error
        : new ApiRouteError(
            503,
            "RESUME_PERSISTENCE_FAILED",
            "The resume could not be saved. Your current resume is still active."
          ),
      request.nextUrl.pathname
    );
  }
}
