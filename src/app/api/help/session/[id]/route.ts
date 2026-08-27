import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { HelpRequestError } from "@/server/help/help-request.types";
import { createHelpRoomToken } from "@/server/help/help-room-token";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { NotificationKind } from "@/server/notifications/notification.service";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const logger = new Logger("HelpSessionAction");

const actionSchema = z.object({
  action: z.enum(["join", "connected", "leave", "rate", "skip_rating"]),
  rating: z.number().int().min(1).max(5).optional()
});

const FAILURE_STATUS: Record<string, { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: "That request no longer exists." },
  NOT_THE_HELPER: { status: 403, message: "You are not part of this conversation." },
  NOT_THE_LEARNER: { status: 403, message: "Only the person who asked can rate this." },
  ILLEGAL_TRANSITION: { status: 409, message: "This conversation is not open." }
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const ownerId = authenticatedOwnerId(userId);

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "A valid request id is required");
    }

    const app = getAppContainer();
    const result = await app.helpSessionService.status(id, ownerId);

    if (result.resolved) {
      const title =
        findQuestion(result.request.questionSlug)?.question.title ?? result.request.questionSlug;
      after(() =>
        app.notificationDispatcher
          .dispatch({
            ownerId: result.request.learnerId,
            kind: NotificationKind.HELP_REQUEST_RESOLVED,
            title: `Your ${title} request was closed`,
            body: "The 30-minute help conversation has ended.",
            href: `/dsa-questions/${result.request.questionSlug}`,
            subjectId: result.request.id
          })
          .catch((error) => logNotificationFailure(result.request.id, error))
      );
    }

    return apiSuccess({
      active: result.active,
      ended: result.ended,
      remainingMs: result.remainingMs
    });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

/**
 * The help call.
 *
 * Same LiveKit project as an interview, but a separate, deliberately narrow
 * token: one two-person audio room, microphone publication only, and an
 * explicitly empty agent list. A peer conversation never dispatches Maya.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const ownerId = authenticatedOwnerId(userId);

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "A valid request id is required");
    }
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiRouteError(400, "BAD_REQUEST", "Invalid action");

    const app = getAppContainer();
    const sessions = app.helpSessionService;

    if (parsed.data.action === "leave") {
      // Either party hanging up ends it for both: a one-sided call is over.
      const result = await sessions.leave(id, ownerId);

      if (result.resolved) {
        const title =
          findQuestion(result.request.questionSlug)?.question.title ?? result.request.questionSlug;
        after(() =>
          app.notificationDispatcher
            .dispatch({
              ownerId: result.request.learnerId,
              kind: NotificationKind.HELP_REQUEST_RESOLVED,
              title: `Your ${title} request was closed`,
              body: "Your help conversation has ended.",
              href: `/dsa-questions/${result.request.questionSlug}`,
              subjectId: result.request.id
            })
            .catch((error) => logNotificationFailure(result.request.id, error))
        );
      }

      return apiSuccess({ ended: result.ended });
    }

    if (parsed.data.action === "rate") {
      if (parsed.data.rating === undefined) {
        throw new ApiRouteError(400, "BAD_REQUEST", "A rating is required");
      }
      return apiSuccess({ rated: await sessions.rate(id, ownerId, parsed.data.rating) });
    }

    if (parsed.data.action === "skip_rating") {
      return apiSuccess({ skipped: await sessions.skipRating(id, ownerId) });
    }

    if (parsed.data.action === "connected") {
      return apiSuccess({ connected: await sessions.connected(id, ownerId) });
    }

    const { livekitUrl, livekitApiKey, livekitApiSecret } = app.config;
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new ApiRouteError(503, "LIVEKIT_NOT_CONFIGURED", "Voice is not configured");
    }

    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.livekitToken, ownerId);

    const access = await sessions.join(id, ownerId);

    const token = await createHelpRoomToken({
      apiKey: livekitApiKey,
      apiSecret: livekitApiSecret,
      requestId: id,
      roomName: access.session.roomName,
      seat: access.seat,
      remainingMs: access.remainingMs
    });

    return apiSuccess({
      token,
      url: livekitUrl,
      roomName: access.session.roomName,
      seat: access.seat,
      remainingMs: access.remainingMs
    });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

function logNotificationFailure(requestId: string, error: unknown): void {
  logger.error(
    JSON.stringify({
      event: "help.session.notification.failed",
      requestId,
      reason: error instanceof Error ? error.message : String(error)
    })
  );
}

function translate(error: unknown): unknown {
  if (!(error instanceof HelpRequestError)) return error;

  const mapped = FAILURE_STATUS[error.reason] ?? {
    status: 409,
    message: "That conversation cannot be joined right now."
  };

  return new ApiRouteError(mapped.status, `HELP_${error.reason}`, mapped.message);
}
