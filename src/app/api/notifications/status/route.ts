import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lightweight badge/version read used between full inbox refreshes. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    const status = await app.notificationService.pollingStatus(ownerId);
    after(() => app.notificationDispatcher.retryPendingBestEffort());
    return apiSuccess(status);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
