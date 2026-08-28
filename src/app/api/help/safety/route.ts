import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { HelpRequestError } from "@/server/help/help-request.types";
import { REPORT_DETAIL_LIMIT } from "@/server/help/help-safety.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const logger = new Logger("HelpSafety");

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("unblock"), userId: z.string().min(1).max(200) }),
  z.object({
    action: z.literal("report"),
    requestId: z.string().uuid(),
    reason: z.enum(["HARASSMENT", "SPAM", "OFF_TOPIC", "SOLUTION_DUMPING", "OTHER"]),
    detail: z.string().max(REPORT_DETAIL_LIMIT).optional()
  })
]);

const FAILURE_STATUS: Record<string, { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: "That request no longer exists." },
  NOT_THE_HELPER: { status: 403, message: "You were not part of that conversation." },
  ILLEGAL_TRANSITION: { status: 400, message: "That is not something you can do." }
};

/**
 * Blocking and reporting.
 *
 * Block and report derive the other person's id from the request the two of
 * them share, because an endpoint accepting "who to report" is one anybody can
 * point at anybody. Unblock can safely accept an id: it only deletes the
 * caller's own row and grants no access to the target.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const ownerId = authenticatedOwnerId(userId);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiRouteError(400, "BAD_REQUEST", "Invalid payload");

    const app = getAppContainer();
    const safety = app.helpSafetyService;

    if (parsed.data.action === "unblock") {
      await safety.unblock(ownerId, parsed.data.userId);
      return apiSuccess({ unblocked: true });
    }

    // Its own quota is intentional: exhausting "Ask a mate" must never remove
    // the ability to end and report an unsafe conversation.
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.helpSafety, ownerId);

    if (parsed.data.action === "block") {
      await safety.blockForRequest(parsed.data.requestId, ownerId);
      return apiSuccess({ blocked: true });
    }

    const report = await safety.report({
      requestId: parsed.data.requestId,
      reporterId: ownerId,
      reason: parsed.data.reason,
      detail: parsed.data.detail
    });

    // Loud on purpose: a report is the one event here worth waking somebody for.
    logger.error(
      JSON.stringify({
        event: "help.report.filed",
        reportId: report.id,
        requestId: parsed.data.requestId,
        reason: parsed.data.reason
      })
    );

    return apiSuccess({ reported: true, id: report.id });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

function translate(error: unknown): unknown {
  if (!(error instanceof HelpRequestError)) return error;

  const mapped = FAILURE_STATUS[error.reason] ?? {
    status: 409,
    message: "That could not be done right now."
  };

  return new ApiRouteError(mapped.status, `HELP_${error.reason}`, mapped.message);
}
