import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { runGlobalHelpMaintenance } from "@/features/peer-help/server/help-maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One Hobby-compatible daily function for teacher notifications and maintenance. */
export async function GET(request: NextRequest) {
  const app = getAppContainer();
  const secret = app.config.cronSecret;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [teacherNotifications, maintenance] = await Promise.all([
    app.teacherNotificationService.dispatchDaily(),
    runGlobalHelpMaintenance(app)
  ]);

  return Response.json({ success: true, data: { teacherNotifications, maintenance } });
}
