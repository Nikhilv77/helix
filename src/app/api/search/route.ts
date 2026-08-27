import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.string().trim().min(1).max(80);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
    if (!parsed.success) {
      throw new ApiRouteError(400, "INVALID_SEARCH_QUERY", "Search must be 1 to 80 characters");
    }

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.workspaceSearch, ownerId);

    return apiSuccess(await app.workspaceSearchService.search(ownerId, parsed.data));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
