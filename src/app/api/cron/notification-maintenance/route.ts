import type { NextRequest } from "next/server";

import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { NotificationKind } from "@/server/notifications/notification.service";

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
  const lifecycleNotifications = await Promise.allSettled([
    ...expired.map((entry) =>
      app.notificationDispatcher.dispatch({
        ownerId: entry.learnerId,
        kind: NotificationKind.HELP_REQUEST_EXPIRED,
        title: `No one picked up your ${
          findQuestion(entry.questionSlug)?.question.title ?? entry.questionSlug
        } request`,
        body: "Nobody was available this time. Your teacher can still walk you through it.",
        href: `/dsa-questions/${entry.questionSlug}`,
        subjectId: entry.id
      })
    ),
    ...reconciled.map((entry) =>
      app.notificationDispatcher.dispatch({
        ownerId: entry.learnerId,
        kind: NotificationKind.HELP_REQUEST_RESOLVED,
        title: `Your ${
          findQuestion(entry.questionSlug)?.question.title ?? entry.questionSlug
        } conversation ended`,
        body: "The Trailmate room reached its time limit.",
        href: `/dsa-questions/${entry.questionSlug}`,
        subjectId: entry.id
      })
    )
  ]);
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
