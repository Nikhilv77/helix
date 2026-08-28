import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const readSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).strict(),
  z.object({ all: z.literal(true) }).strict()
]);

const EMAIL_RETRY_INTERVAL_MS = 60_000;
let lastEmailRetryAt = 0;

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const app = getAppContainer();
    await app.notificationService.purgeExpiredHelpRequestNotifications(ownerId);

    const [items, unread, helpEnabled, teacherEnabled] = await Promise.all([
      app.notificationService.list(ownerId),
      app.notificationService.unreadCount(ownerId),
      app.notificationService.helpNotificationsEnabled(ownerId),
      app.notificationService.teacherNotificationsEnabled(ownerId)
    ]);

    retryPendingEmail();

    return apiSuccess({
      unread,
      helpNotificationsEnabled: helpEnabled,
      teacherNotificationsEnabled: teacherEnabled,
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        body: item.body,
        href: item.href,
        read: item.readAt !== null,
        createdAt: item.createdAt.getTime()
      }))
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

/** Opportunistic retry: bounded and leased, so every app instance may offer. */
function retryPendingEmail(): void {
  const now = Date.now();
  if (now - lastEmailRetryAt < EMAIL_RETRY_INTERVAL_MS) return;
  lastEmailRetryAt = now;

  after(() =>
    getAppContainer()
      .notificationDispatcher.retryPending()
      .catch(() => undefined)
  );
}

/** Marks one notification, or the whole inbox, as read. */
export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = readSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Invalid payload");
    }

    const service = getAppContainer().notificationService;

    if ("all" in parsed.data) {
      return apiSuccess({ marked: await service.markAllRead(ownerId) });
    }

    // Scoped by owner inside the service, so ids copied from somebody else's
    // inbox match nothing rather than mutating their rows.
    return apiSuccess({ marked: await service.markManyRead(ownerId, parsed.data.ids) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}
