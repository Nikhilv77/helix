import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Maya's session plan. Built on first request after onboarding and reused
 * until the candidate replaces their resume, which clears it.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();

    const profile = await app.profileService.get(ownerId);
    requireCompletedPreparationOnboarding(profile);

    const existing = await app.profileService.curriculum(ownerId);
    if (existing) return apiSuccess(existing);

    const curriculum = await app.curriculumService.build(profile);
    await app.profileService.saveCurriculum(ownerId, curriculum);

    return apiSuccess(curriculum);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
