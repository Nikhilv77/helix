import { findQuestion } from "@/features/practice/dsa/domain/dsa";
import { NotificationKind } from "@/features/notifications/server/notification.service";
import type { NotificationDispatcher } from "@/features/notifications/server/notification-dispatcher";
import type { NotificationService } from "@/features/notifications/server/notification.service";
import type { HelpRequestService } from "./help-request.service";
import type { HelpSessionService, ReconciledHelpConversation } from "./help-session.service";
import { Logger } from "@/server/common/logger";

const logger = new Logger("HelpMaintenance");

export interface HelpMaintenanceDependencies {
  helpRequestService: Pick<HelpRequestService, "expireStaleForLearner">;
  helpSessionService: Pick<HelpSessionService, "reconcileStaleForOwner">;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch">;
}

export interface HelpOwnerMaintenanceSummary {
  expiredRequests: number;
  reconciledSessions: number;
  failedNotifications: number;
}

export interface GlobalHelpMaintenanceDependencies {
  helpRequestService: Pick<HelpRequestService, "expireStaleAndReport">;
  helpSessionService: Pick<HelpSessionService, "reconcileStale">;
  notificationService: Pick<NotificationService, "purgeAllExpiredHelpRequestNotifications">;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch" | "retryPending">;
}

export interface GlobalHelpMaintenanceSummary {
  expiredRequests: number;
  reconciledSessions: number;
  lifecycleNotifications: number;
  failedLifecycleNotifications: number;
  purgedInvitations: number;
  emailRetry: { attempted: number; emailed: number };
}

/**
 * Repairs only the signed-in user's stale state. This makes time-sensitive
 * correctness request-driven while the daily cron remains a global backstop.
 */
export async function reconcileHelpForOwner(
  app: HelpMaintenanceDependencies,
  ownerId: string
): Promise<HelpOwnerMaintenanceSummary> {
  const [expired, reconciled] = await Promise.all([
    app.helpRequestService.expireStaleForLearner(ownerId),
    app.helpSessionService.reconcileStaleForOwner(ownerId)
  ]);
  const notifications = await dispatchHelpLifecycleNotifications(
    app.notificationDispatcher,
    expired,
    reconciled
  );

  return {
    expiredRequests: expired.length,
    reconciledSessions: reconciled.length,
    failedNotifications: notifications.filter((result) => result.status === "rejected").length
  };
}

/** Cleanup must never make an otherwise healthy user-facing read or action fail. */
export async function reconcileHelpForOwnerBestEffort(
  app: HelpMaintenanceDependencies,
  ownerId: string
): Promise<HelpOwnerMaintenanceSummary | null> {
  try {
    return await reconcileHelpForOwner(app, ownerId);
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "help.owner.reconciliation.failed",
        ownerId,
        reason: error instanceof Error ? error.message : String(error)
      })
    );
    return null;
  }
}

/** Daily global backstop, shared with the existing teacher-notification cron. */
export async function runGlobalHelpMaintenance(
  app: GlobalHelpMaintenanceDependencies
): Promise<GlobalHelpMaintenanceSummary> {
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

  return {
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
  };
}

export function dispatchHelpLifecycleNotifications(
  dispatcher: Pick<NotificationDispatcher, "dispatch">,
  expired: readonly ReconciledHelpConversation[],
  reconciled: readonly ReconciledHelpConversation[]
) {
  return Promise.allSettled([
    ...expired.map((entry) =>
      dispatcher.dispatch({
        ownerId: entry.learnerId,
        kind: NotificationKind.HELP_REQUEST_EXPIRED,
        title: `No one picked up your ${questionTitle(entry.questionSlug)} request`,
        body: "Nobody was available this time. Your teacher can still walk you through it.",
        href: `/dsa-questions/${entry.questionSlug}`,
        subjectId: entry.id
      })
    ),
    ...reconciled.map((entry) =>
      dispatcher.dispatch({
        ownerId: entry.learnerId,
        kind: NotificationKind.HELP_REQUEST_RESOLVED,
        title: `Your ${questionTitle(entry.questionSlug)} conversation ended`,
        body: "The Trailmate room reached its time limit.",
        href: `/dsa-questions/${entry.questionSlug}`,
        subjectId: entry.id
      })
    )
  ]);
}

function questionTitle(slug: string): string {
  return findQuestion(slug)?.question.title ?? slug;
}
