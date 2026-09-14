import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { canViewInterviewOperations } from "@/features/interviews/server/interview-operations-access";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";

export const dynamic = "force-dynamic";

/** Aggregate-only operations feed. It never serializes interview state. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const app = getAppContainer();
    const ownerId = userId ? authenticatedOwnerId(userId) : null;
    if (!canViewInterviewOperations(app.config, ownerId)) {
      throw new ApiRouteError(404, "NOT_FOUND", "Not found");
    }

    const rawHours = Number(request.nextUrl.searchParams.get("hours") ?? "24");
    const hours = Number.isFinite(rawHours) ? rawHours : 24;
    const response = apiSuccess(await app.interviewOperationsService.dashboard(hours));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
