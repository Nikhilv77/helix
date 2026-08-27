import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const preferenceSchema = z
  .object({
    helpNotificationsEnabled: z.boolean().optional(),
    teacherNotificationsEnabled: z.boolean().optional()
  })
  .strict()
  .refine(
    (value) =>
      value.helpNotificationsEnabled !== undefined ||
      value.teacherNotificationsEnabled !== undefined,
    "At least one notification preference is required"
  );

/**
 * The way out.
 *
 * Being asked to help repeatedly with no way to stop is the fastest way to lose
 * a helper, so this is a first-class endpoint rather than a setting buried in a
 * profile blob. Emails carry a link to it.
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Expected a notification preference");
    }

    const ownerId = authenticatedOwnerId(userId);
    const service = getAppContainer().notificationService;
    await Promise.all([
      parsed.data.helpNotificationsEnabled === undefined
        ? Promise.resolve()
        : service.setHelpNotifications(ownerId, parsed.data.helpNotificationsEnabled),
      parsed.data.teacherNotificationsEnabled === undefined
        ? Promise.resolve()
        : service.setTeacherNotifications(ownerId, parsed.data.teacherNotificationsEnabled)
    ]);

    return apiSuccess(parsed.data);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
