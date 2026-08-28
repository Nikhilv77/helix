import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { HelpRequestError } from "@/server/help/help-request.types";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { NotificationKind } from "@/server/notifications/notification.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const logger = new Logger("HelpRequestAction");

const actionSchema = z.object({
  action: z.enum(["claim", "decline", "release", "resolve"])
});

const FAILURE_STATUS: Record<string, { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: "That request no longer exists." },
  ALREADY_CLAIMED: { status: 409, message: "This request has already been accepted." },
  NOT_QUALIFIED: {
    status: 403,
    message:
      "Your profile does not show enough relevant problem-solving evidence for this request yet."
  },
  HELPER_UNAVAILABLE: {
    status: 409,
    message: "Resume, withdraw, or hand back your current Trailmate session first."
  },
  SESSION_ALREADY_STARTED: {
    status: 409,
    message: "This conversation has already started and cannot be handed back."
  },
  NOT_THE_HELPER: { status: 403, message: "That request is not yours to change." },
  REQUEST_EXPIRED: { status: 409, message: "That request has expired." },
  SELF_HELP: { status: 400, message: "You cannot answer your own request." }
};

/**
 * A helper acting on one request.
 *
 * Claiming is the interesting one: two helpers pressing the button at the same
 * moment both reach `claim`, and the status-guarded UPDATE underneath means
 * exactly one wins. The loser gets a 409 that says so plainly rather than a
 * silent no-op that leaves them believing they are on the hook.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const helperId = authenticatedOwnerId(userId);

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "A valid request id is required");
    }
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Expected claim, decline, release or resolve");
    }

    const app = getAppContainer();
    const service = app.helpRequestService;

    const updated =
      parsed.data.action === "claim"
        ? await service.claim(id, helperId)
        : parsed.data.action === "decline"
          ? await service.decline(id, helperId)
          : parsed.data.action === "release"
            ? await service.release(id, helperId)
            : await service.resolve(id, helperId);

    // Telling the learner is the point of the transition, but it must not be
    // able to fail it — the state change is already committed.
    if (parsed.data.action === "claim" || parsed.data.action === "resolve") {
      const claimed = parsed.data.action === "claim";
      const title = findQuestion(updated.questionSlug)?.question.title ?? updated.questionSlug;

      after(async () => {
        try {
          const profiles = await app.helpHistoryService.participants([updated.learnerId, helperId]);
          const learnerName = profiles.get(updated.learnerId)?.label ?? "Your peer";
          const helperName = profiles.get(helperId)?.label ?? "Your Trailmate";
          const deliveries = [
            app.notificationDispatcher.dispatch({
              ownerId: updated.learnerId,
              kind: claimed
                ? NotificationKind.HELP_REQUEST_CLAIMED
                : NotificationKind.HELP_REQUEST_RESOLVED,
              title: claimed
                ? `${helperName} accepted your ${title} request`
                : `Your session with ${helperName} is complete`,
              body: claimed
                ? `${helperName} is ready to meet you in the private Trailmate room.`
                : `You can review this conversation anytime from Trailmate.`,
              href: claimed
                ? `/help?request=${updated.id}&join=1`
                : `/dsa-questions/${updated.questionSlug}`,
              subjectId: updated.id
            })
          ];
          if (!claimed) {
            deliveries.push(
              app.notificationDispatcher.dispatch({
                ownerId: helperId,
                kind: NotificationKind.HELP_REQUEST_RESOLVED,
                title: `Your session with ${learnerName} is complete`,
                body: `Thanks for supporting ${learnerName} with ${title}.`,
                href: "/help",
                subjectId: updated.id
              })
            );
          }
          await Promise.allSettled(deliveries);
        } catch (error) {
          logger.error(
            JSON.stringify({
              event: "help.transition.notification.failed",
              requestId: updated.id,
              action: parsed.data.action,
              reason: error instanceof Error ? error.message : String(error)
            })
          );
        }
      });
    }

    return apiSuccess({ id: updated.id, status: updated.status });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

function translate(error: unknown): unknown {
  if (!(error instanceof HelpRequestError)) return error;

  const mapped = FAILURE_STATUS[error.reason] ?? {
    status: 409,
    message: "That request cannot change right now."
  };

  return new ApiRouteError(mapped.status, `HELP_${error.reason}`, mapped.message);
}
