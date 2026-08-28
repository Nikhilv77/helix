import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";
import {
  HELP_HISTORY_DEFAULT_LIMIT,
  InvalidHelpHistoryCursorError
} from "@/server/help/help-history.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  side: z.enum(["received", "given"]).default("received"),
  status: z.enum(["all", "active", "resolved", "expired", "cancelled"]).default("all"),
  cursor: z.string().max(500).nullable().default(null),
  limit: z.coerce.number().int().min(1).max(25).default(HELP_HISTORY_DEFAULT_LIMIT)
});

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = querySchema.safeParse({
      side: request.nextUrl.searchParams.get("side") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Help history filters are invalid");
    }

    return apiSuccess(
      await getAppContainer().helpHistoryService.history({
        ownerId,
        side: parsed.data.side,
        filter: parsed.data.status,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit
      })
    );
  } catch (error) {
    return apiError(
      error instanceof InvalidHelpHistoryCursorError
        ? new ApiRouteError(400, "BAD_REQUEST", "Help history cursor is invalid")
        : error,
      request.nextUrl.pathname
    );
  }
}

async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}
