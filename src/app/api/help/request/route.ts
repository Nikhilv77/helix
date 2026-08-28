import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { HelpRequestError } from "@/server/help/help-request.types";
import { NotificationKind } from "@/server/notifications/notification.service";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const logger = new Logger("HelpRequest");

/**
 * How many helpers hear about one request.
 *
 * Notifying everyone who ever solved a problem is how a helper pool learns to
 * ignore the notifications. The best few get asked; if none of them accept, a
 * later re-fan can widen it.
 */
const HELPERS_TO_NOTIFY = 3;

const selectionSchema = z
  .object({
    startLineNumber: z.number().int().min(1).max(1_000_000),
    startColumn: z.number().int().min(1).max(1_000_000),
    endLineNumber: z.number().int().min(1).max(1_000_000),
    endColumn: z.number().int().min(1).max(1_000_000)
  })
  .strict();

const testCaseSchema = z
  .object({
    index: z.number().int().min(0).max(10_000),
    input: z.string().max(500),
    expectedOutput: z.string().max(500),
    actualOutput: z.string().max(500),
    passed: z.boolean(),
    error: z.string().max(500).nullable()
  })
  .strict();

const openSchema = z.object({
  slug: z.string().min(1).max(140),
  language: z.enum(["python", "javascript", "cpp", "java"]),
  code: z
    .string()
    .max(40_000)
    .refine((value) => value.trim().length > 0, "Write an attempt before asking a mate"),
  testOutput: z.string().max(20_000).nullable().optional(),
  failingTests: z.number().int().min(0).max(10_000).nullable().optional(),
  runStatus: z.string().max(160).nullable().optional(),
  tests: z.array(testCaseSchema).max(10).nullable().optional(),
  selection: selectionSchema.nullable().optional(),
  hintsUsed: z.number().int().min(0).max(100).default(0),
  timeSpentMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000)
    .default(0)
});

/** How a failed lifecycle call maps onto the wire. */
const FAILURE_STATUS: Record<string, { status: number; message: string }> = {
  ALREADY_LIVE: { status: 409, message: "You already have an open request for this problem." },
  ENGAGEMENT_ACTIVE: {
    status: 409,
    message: "Finish, withdraw, or hand back your current Trailmate session first."
  },
  NOT_FOUND: { status: 404, message: "That Trailmate request no longer exists." },
  NOT_THE_LEARNER: { status: 403, message: "That request is not yours to cancel." }
};

export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = openSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Trailmate request payload is invalid", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const detail = findQuestion(parsed.data.slug);
    if (!detail) throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found");
    const question = detail.question;

    // Asking for a human is cheap for the learner and expensive for whoever
    // answers, so it is throttled like any other outbound-effect endpoint.
    const app = getAppContainer();
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.helpRequest, ownerId);

    const helpers = await app.helperMatchingService.findHelpers(
      question.slug,
      ownerId,
      parsed.data.language,
      HELPERS_TO_NOTIFY
    );
    if (helpers.length === 0) {
      throw new ApiRouteError(
        409,
        "HELP_NO_AVAILABLE_HELPERS",
        "No Trailmates are available right now, so your invitation was not sent."
      );
    }

    const context = {
      code: parsed.data.code,
      language: parsed.data.language,
      testOutput: parsed.data.testOutput ?? null,
      failingTests: parsed.data.failingTests ?? null,
      runStatus: parsed.data.runStatus ?? null,
      tests: parsed.data.tests ?? null,
      selection: parsed.data.selection ?? null,
      hintsUsed: parsed.data.hintsUsed,
      timeSpentMs: parsed.data.timeSpentMs
    };

    const helpRequest = await app.helpRequestService.open({
      learnerId: ownerId,
      questionSlug: parsed.data.slug,
      language: parsed.data.language,
      context
    });

    // Help invitations are in-app-only database writes. Await them so the UI
    // never says "delivered" when no invitation row was actually recorded.
    const learner = await app.helpHistoryService.participant(ownerId);
    const failing = context.failingTests;
    const body =
      failing === null
        ? `They are working in ${parsed.data.language} and shared their current code.`
        : `They are working in ${parsed.data.language} with ${failing} failing ${
            failing === 1 ? "test" : "tests"
          }.`;
    const deliveries = await Promise.allSettled(
      helpers.map((helper) =>
        app.notificationDispatcher.dispatch({
          ownerId: helper.ownerId,
          kind: NotificationKind.HELP_REQUEST_OPENED,
          title: `${learner.label} asked for a mate for ${question.title}`,
          body,
          href: `/help?request=${helpRequest.id}`,
          subjectId: helpRequest.id
        })
      )
    );
    const invitationsSent = deliveries.filter(
      (delivery) => delivery.status === "fulfilled" && delivery.value.recorded
    ).length;
    const failed = deliveries.filter((delivery) => delivery.status === "rejected").length;

    if (failed > 0) {
      logger.error(
        JSON.stringify({
          event: "help.request.fanout.partial_failure",
          requestId: helpRequest.id,
          failed,
          invitationsSent
        })
      );
    }

    if (invitationsSent === 0) {
      await app.helpRequestService.cancel(helpRequest.id, ownerId).catch((error) => {
        logger.error(
          JSON.stringify({
            event: "help.request.unrouted_cancel.failed",
            requestId: helpRequest.id,
            reason: error instanceof Error ? error.message : String(error)
          })
        );
      });
      throw new ApiRouteError(
        503,
        "HELP_INVITATION_NOT_SENT",
        "We could not send a Trailmate invitation. Your request was not left waiting; please try again."
      );
    }

    // AI enrichment is useful context, never a prerequisite for reaching a
    // human. Schedule it only after at least one invitation is durably routed,
    // so a cancelled unroutable request does not produce background work.
    after(async () => {
      try {
        const summary = await app.stuckSummaryService.summarize(question, context);
        await app.helpRequestService.attachSummary(helpRequest.id, JSON.stringify(summary));

        await app.conciergeNotifier.notify({
          requestId: helpRequest.id,
          learnerName: learner.label,
          questionTitle: question.title,
          questionSlug: question.slug,
          language: parsed.data.language,
          difficulty: question.difficulty,
          summary,
          timeSpentMs: context.timeSpentMs,
          hintsUsed: context.hintsUsed
        });
      } catch (error) {
        // A request that never got summarised is still a request worth having.
        logger.error(
          JSON.stringify({
            event: "help.request.enrichment.failed",
            requestId: helpRequest.id,
            reason: error instanceof Error ? error.message : String(error)
          })
        );
      }
    });

    return apiSuccess({
      id: helpRequest.id,
      status: helpRequest.status,
      createdAt: helpRequest.createdAt.getTime(),
      invitationsSent,
      cooldownMs: RATE_LIMIT_POLICIES.helpRequest.windowMs
    });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

/** The learner's own live request for a question, so the UI can resume its state. */
export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const slug = request.nextUrl.searchParams.get("slug") ?? "";
    const language = request.nextUrl.searchParams.get("language") ?? "javascript";
    if (!slug || !findQuestion(slug)) {
      throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found");
    }
    if (!openSchema.shape.language.safeParse(language).success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Programming language is invalid");
    }

    const app = getAppContainer();
    const [live, helperCount, pendingRating] = await Promise.all([
      app.helpRequestService.liveForLearner(ownerId, slug),
      app.helperMatchingService.countHelpers(slug, ownerId, language),
      app.helpSessionService.pendingRatingForLearner(ownerId, slug)
    ]);
    const helper = live?.helperId ? await app.helpHistoryService.participant(live.helperId) : null;

    // helperCount is who *could* answer, not who will. Describe the pool without
    // promising that one of them is online or will accept.
    return apiSuccess({
      id: live?.id ?? null,
      status: live?.status ?? null,
      helper,
      createdAt: live?.createdAt.getTime() ?? null,
      helperCount,
      ratingRequestId: live ? null : (pendingRating?.requestId ?? null)
    });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "A valid request id is required");
    }

    const cancelled = await getAppContainer().helpRequestService.cancel(id, ownerId);
    return apiSuccess({ id: cancelled.id, status: cancelled.status });
  } catch (error) {
    return apiError(translate(error), request.nextUrl.pathname);
  }
}

async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}

/** Lifecycle failures carry a reason, not an HTTP status. This bridges the two. */
function translate(error: unknown): unknown {
  if (!(error instanceof HelpRequestError)) return error;

  const mapped = FAILURE_STATUS[error.reason] ?? {
    status: 409,
    message: "That Trailmate request cannot change right now."
  };

  return new ApiRouteError(mapped.status, `HELP_${error.reason}`, mapped.message);
}
