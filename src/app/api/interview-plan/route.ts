import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";

export const dynamic = "force-dynamic";

/** Returns the current immutable five-session plan, creating it on first use. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    requireCompletedPreparationOnboarding(await app.profileService.get(ownerId));
    const plan = await app.personalizedInterviewPlanningService.activePlan(ownerId);
    return apiSuccess(plan);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
