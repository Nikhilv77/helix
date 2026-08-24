import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { anonymousOwnerId, authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

/**
 * Repairs sessions created by a signed-in browser while the old owner resolver
 * incorrectly fell back to its anonymous browser fingerprint.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new ApiRouteError(401, "AUTH_REQUIRED", "Sign in to access interview history", {});
    }

    const moved = await getAppContainer().interviewService.claimAnonymousHistory(
      anonymousOwnerId(request),
      authenticatedOwnerId(userId)
    );

    return apiSuccess({ moved });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
