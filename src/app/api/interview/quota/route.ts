import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { attachInterviewOwnerCookie, resolveInterviewOwner } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    return attachInterviewOwnerCookie(
      apiSuccess(await app.interviewService.quota(owner.ownerId)),
      owner,
      app.config
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
