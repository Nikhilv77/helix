import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { resolveOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const app = getAppContainer();
    const ownerId = await resolveOwnerId(request, app.config);
    return apiSuccess(await app.interviewService.quota(ownerId));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
