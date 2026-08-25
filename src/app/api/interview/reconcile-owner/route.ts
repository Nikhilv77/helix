import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import {
  anonymousOwnerIdFromRequest,
  authenticatedOwnerId,
  clearInterviewOwnerCookie
} from "@/server/interview/owner";

export const dynamic = "force-dynamic";

/** Moves only the sessions proven by this browser's signed anonymous cookie. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new ApiRouteError(401, "AUTH_REQUIRED", "Sign in to access interview history", {});
    }

    const app = getAppContainer();
    const anonymousOwnerId = anonymousOwnerIdFromRequest(request, app.config);
    const moved = anonymousOwnerId
      ? await app.interviewService.claimAnonymousHistory(
          anonymousOwnerId,
          authenticatedOwnerId(userId)
        )
      : 0;

    const response = apiSuccess({ moved });
    return anonymousOwnerId ? clearInterviewOwnerCookie(response, app.config) : response;
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
