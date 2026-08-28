import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";

import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { presentHelpInboxRequest } from "@/server/help/help-inbox-presenter";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { NotificationKind } from "@/server/notifications/notification.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const logger = new Logger("HelpInbox");

/**
 * How often the expiry sweep may run, regardless of traffic.
 *
 * The sweep is opportunistic rather than scheduled: this deployment has no cron,
 * and a request that expires an hour late costs nothing, while a cron costs a
 * whole piece of infrastructure to own. Throttling per instance keeps a busy
 * inbox from sweeping on every poll.
 */
const SWEEP_INTERVAL_MS = 10 * 60_000;
let lastSweptAt = 0;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const helperId = authenticatedOwnerId(userId);

    const app = getAppContainer();
    const reconciled = await app.helpSessionService.reconcileStale();

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

    sweepExpired();
    notifyReconciled(reconciled);

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

function notifyReconciled(
  reconciled: Array<{ id: string; learnerId: string; questionSlug: string }>
): void {
  if (reconciled.length === 0) return;

  after(async () => {
    const app = getAppContainer();
    await Promise.allSettled(
      reconciled.map((entry) =>
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
    );
  });
}

/**
 * Retire requests nobody claimed and tell their learners.
 *
 * Runs after the response so an inbox load never waits on it, and at most once
 * per interval per instance. Silent expiry is the failure this avoids: a
 * learner watching a request sit open forever concludes the feature is broken,
 * when in fact it timed out.
 */
function sweepExpired(): void {
  const now = Date.now();
  if (now - lastSweptAt < SWEEP_INTERVAL_MS) return;
  lastSweptAt = now;

  after(async () => {
    const app = getAppContainer();

    try {
      const expired = await app.helpRequestService.expireStaleAndReport();
      if (expired.length === 0) return;

      await Promise.all(
        expired.map((entry) =>
          app.notificationDispatcher.dispatch({
            ownerId: entry.learnerId,
            kind: NotificationKind.HELP_REQUEST_EXPIRED,
            title: `No one picked up your ${
              findQuestion(entry.questionSlug)?.question.title ?? entry.questionSlug
            } request`,
            body: "Nobody was available this time. Maya can still walk you through it.",
            href: `/dsa-questions/${entry.questionSlug}`,
            subjectId: entry.id
          })
        )
      );

      logger.log(JSON.stringify({ event: "help.sweep.expired", count: expired.length }));
    } catch (error) {
      logger.error(
        JSON.stringify({
          event: "help.sweep.failed",
          reason: error instanceof Error ? error.message : String(error)
        })
      );
    }
  });
}
