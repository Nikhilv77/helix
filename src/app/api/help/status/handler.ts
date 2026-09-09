import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { reconcileHelpForOwnerBestEffort } from "@/features/peer-help/server/help-maintenance";


/** Tiny change detector; full Trailmate data is fetched only when this moves. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    await reconcileHelpForOwnerBestEffort(app, ownerId);
    return apiSuccess(await app.helpHistoryService.pollingStatus(ownerId));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
