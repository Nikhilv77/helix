import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { presentHelpInboxRequest } from "@/server/help/help-inbox-presenter";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const helperId = authenticatedOwnerId(userId);

    const app = getAppContainer();

    // Fetched first: the listing has to exclude blocked pairs, not just the
    // claim path, or a blocked learner's request still shows up to be clicked.
    const blockedIds = await app.helpSafetyService.blockedIds(helperId);

    const [open, claimed, helpedPeopleCount] = await Promise.all([
      app.helpRequestService.openRequestsForHelper(helperId, 20, blockedIds),
      app.helpRequestService.claimedByHelper(helperId),
      app.helpRequestService.helpedPeopleCount(helperId)
    ]);
    const learnerProfiles = await app.helpHistoryService.participants(
      [...open, ...claimed].map((row) => row.learnerId)
    );

    return apiSuccess({
      // Current source code is disclosed only after this helper owns the
      // request. Eligible helpers may preview the summary before claiming.
      open: open.map((row) =>
        presentHelpInboxRequest(row, false, learnerProfiles.get(row.learnerId) ?? null)
      ),
      claimed: claimed.map((row) =>
        presentHelpInboxRequest(row, true, learnerProfiles.get(row.learnerId) ?? null)
      ),
      helpedPeopleCount
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
