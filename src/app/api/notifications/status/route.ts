import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { Logger } from "@/server/common/logger";

export const dynamic = "force-dynamic";
const logger = new Logger("NotificationStatus");

/** Lightweight badge/version read used between full inbox refreshes. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    const { coachingDue, ...status } =
      await app.notificationService.pollingStatusWithCoaching(ownerId);
    if (coachingDue) {
      after(async () => {
        try {
          await app.teacherNotificationService.dispatchDueForOwner(ownerId);
        } catch (error) {
          logger.error({
            event: "teacher.coaching.dispatch_failed",
            ownerId,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      });
    }
    after(() => app.notificationDispatcher.retryPendingBestEffort());
    return apiSuccess({ ...status, coachingScheduled: coachingDue });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
