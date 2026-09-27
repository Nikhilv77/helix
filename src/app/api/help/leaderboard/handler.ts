import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { TOP_HELPERS_CACHE_LIMIT } from "@/features/peer-help/server/help-history.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";

/** The full Top Trailmates list behind "View all". Served from the shared cache. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const helpers = await getAppContainer().helpHistoryService.topHelpers(TOP_HELPERS_CACHE_LIMIT);
    return apiSuccess({ helpers });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
