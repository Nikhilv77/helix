import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { reconcileHelpForOwnerBestEffort } from "@/features/peer-help/server/help-maintenance";

const MAINTENANCE_INTERVAL_MS = 60_000;
const nextMaintenanceAt = new Map<string, number>();
/** Presence is "seen in the last few minutes"; a write a minute is plenty. */
const PRESENCE_INTERVAL_MS = 60_000;
const nextPresenceAt = new Map<string, number>();

function schedulePresence(ownerId: string, app: ReturnType<typeof getAppContainer>) {
  const now = Date.now();
  if ((nextPresenceAt.get(ownerId) ?? 0) > now) return;
  nextPresenceAt.set(ownerId, now + PRESENCE_INTERVAL_MS);
  if (nextPresenceAt.size > 4_096) {
    for (const [candidate, dueAt] of nextPresenceAt) {
      if (dueAt <= now) nextPresenceAt.delete(candidate);
    }
  }
  after(async () => {
    // Presence only improves who gets invited first; it must never fail a poll.
    await app.helpHistoryService.touchPresence(ownerId).catch(() => undefined);
  });
}

function scheduleOwnerMaintenance(ownerId: string, app: ReturnType<typeof getAppContainer>) {
  const now = Date.now();
  if ((nextMaintenanceAt.get(ownerId) ?? 0) > now) return;
  nextMaintenanceAt.set(ownerId, now + MAINTENANCE_INTERVAL_MS);
  if (nextMaintenanceAt.size > 1_024) {
    for (const [candidate, dueAt] of nextMaintenanceAt) {
      if (dueAt <= now) nextMaintenanceAt.delete(candidate);
    }
  }
  after(async () => {
    await reconcileHelpForOwnerBestEffort(app, ownerId);
  });
}

/** Tiny change detector; full Trailmate data is fetched only when this moves. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const ownerId = authenticatedOwnerId(userId);
    const app = getAppContainer();
    const { version, needsMaintenance } =
      await app.helpHistoryService.pollingStatusWithMaintenance(ownerId);
    if (needsMaintenance) scheduleOwnerMaintenance(ownerId, app);
    // This poll only runs while a Trailgrad tab is visible, which is exactly
    // the signal "could answer a help request right now".
    schedulePresence(ownerId, app);
    return apiSuccess({ version });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
