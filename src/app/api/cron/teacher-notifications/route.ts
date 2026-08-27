import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Once-daily, bounded teacher recommendations. */
export async function GET(request: NextRequest) {
  const app = getAppContainer();
  const secret = app.config.cronSecret;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await app.teacherNotificationService.dispatchDaily();
  return Response.json({ success: true, data: summary });
}
