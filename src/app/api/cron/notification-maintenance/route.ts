import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { dispatchHelpLifecycleNotifications } from "@/features/peer-help/server/help-maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Scheduled expiry, invitation cleanup, and durable email retry work. */
export async function GET(request: NextRequest) {
  const app = getAppContainer();
  const secret = app.config.cronSecret;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [expired, reconciled] = await Promise.all([
    app.helpRequestService.expireStaleAndReport(),
    app.helpSessionService.reconcileStale()
  ]);
  const lifecycleNotifications = await dispatchHelpLifecycleNotifications(
    app.notificationDispatcher,
    expired,
    reconciled
  );
  const [purgedInvitations, emailRetry] = await Promise.all([
    app.notificationService.purgeAllExpiredHelpRequestNotifications(),
    app.notificationDispatcher.retryPending()
  ]);

  return Response.json({
    success: true,
    data: {
      expiredRequests: expired.length,
      reconciledSessions: reconciled.length,
      lifecycleNotifications: lifecycleNotifications.filter(
        (result) => result.status === "fulfilled"
      ).length,
      failedLifecycleNotifications: lifecycleNotifications.filter(
        (result) => result.status === "rejected"
      ).length,
      purgedInvitations,
      emailRetry
    }
  });
}
