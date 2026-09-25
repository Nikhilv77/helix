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
    return apiSuccess({ version });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
