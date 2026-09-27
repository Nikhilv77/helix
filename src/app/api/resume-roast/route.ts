import { auth } from "@clerk/nextjs/server";
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import {
  encodeResumeRoastStreamEvent,
  resumeRoastResultEvents,
  validateResumeRoastStreamEvent
} from "@/features/resume-roast/application/stream";
import { ResumeRoastTargetSchema } from "@/features/resume-roast/contracts/resume-roast";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import {
  ResumeRoastCancelledError,
  ResumeRoastInvalidResponseError,
  ResumeRoastProviderRateLimitedError,
  ResumeRoastTimeoutError
} from "@/features/resume-roast/server/resume-roast.service";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { scheduleCandidateAnalyticsRefresh } from "@/features/analytics/server/refresh-candidate-analytics";
import {
  loadResumeRoastPageData,
  refreshResumeRoastPageData
} from "@/features/resume-roast/server/resume-roast-page-data";
import { Logger } from "@/server/common/logger";

export const dynamic = "force-dynamic";
// The generation keeps running after a disconnect (see POST), inside this
// limit. RESUME_ROAST_GENERATION_BUDGET_MS leaves room to persist the result.
export const maxDuration = 60;

const logger = new Logger("ResumeRoastRoute");
const statusQuerySchema = z.string().uuid();

const createSchema = z.object({ target: ResumeRoastTargetSchema }).strict();
const deleteSchema = z.object({ roastId: z.string().uuid() }).strict();
const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-store, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no"
};

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    // `?roastId=` follows a roast started elsewhere: a reload, or another tab.
    const roastId = request.nextUrl.searchParams.get("roastId");
    if (roastId !== null) {
      const parsed = statusQuerySchema.safeParse(roastId);
      if (!parsed.success) throw new ApiRouteError(400, "BAD_REQUEST", "Unknown Resume Roast.");
      const response = apiSuccess(
        await getAppContainer().resumeRoastService.generationState(ownerId, parsed.data)
      );
      response.headers.set("cache-control", "no-store");
      return response;
    }
    const response = apiSuccess((await loadResumeRoastPageData(ownerId)).state);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return resumeRoastApiError(error, request.nextUrl.pathname);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Resume Roast target validation failed.");
    }

    const app = getAppContainer();
    const prepared = await app.resumeRoastService.prepare(ownerId, parsed.data.target, {
      // Only a new generation spends the allowance; following one is free.
      beforeGenerate: () =>
        getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.resumeRoastGeneration, ownerId)
    });
    if (prepared.kind === "joined") {
      // 202: accepted, but it's someone else's stream; the client polls GET.
      const joined = apiSuccess({ inProgress: prepared.inProgress });
      joined.headers.set("cache-control", "no-store");
      return new Response(joined.body, { status: 202, headers: joined.headers });
    }

    // Deliberately not tied to the request signal: a refresh or closed tab
    // must still end in a saved roast that the reloaded page picks up.
    const generation = app.resumeRoastService.finishClaim(ownerId, prepared);
    after(async () => {
      await generation.catch(() => undefined);
      try {
        await refreshResumeRoastPageData(ownerId);
      } catch (error) {
        logger.warn({
          event: "resume_roast_page_refresh_failed",
          reason: error instanceof Error ? error.name : "unknown"
        });
      }
    });
    return roastStream(prepared, generation, request.signal);
  } catch (error) {
    return resumeRoastApiError(error, request.nextUrl.pathname);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ownerId = await requireOwner();
    const parsed = deleteSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiRouteError(400, "BAD_REQUEST", "Resume Roast deletion failed.");

    const deleted = await getAppContainer().resumeRoastService.delete(ownerId, parsed.data.roastId);
    if (deleted) scheduleCandidateAnalyticsRefresh(ownerId);
    const response = apiSuccess({ deleted });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return resumeRoastApiError(error, request.nextUrl.pathname);
  }
}

type RoastService = ReturnType<typeof getAppContainer>["resumeRoastService"];
type PreparedRoast = Extract<Awaited<ReturnType<RoastService["prepare"]>>, { kind: "claimed" }>;
type FinishedRoast = Awaited<ReturnType<RoastService["finishClaim"]>>;

/**
 * Streams the running generation to this browser while it stays connected.
 * A disconnect only stops the stream; the generation itself carries on.
 */
function roastStream(
  prepared: PreparedRoast,
  generation: Promise<FinishedRoast>,
  requestSignal: AbortSignal
): Response {
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          streamController.close();
        } catch {
          // A browser-side cancel closes the controller first. There is no
          // client left to notify, and surfacing that internal state is unsafe.
        }
      };
      const enqueue = (event: Parameters<typeof encodeResumeRoastStreamEvent>[0]) => {
        if (closed || requestSignal.aborted) return;
        streamController.enqueue(
          encoder.encode(encodeResumeRoastStreamEvent(validateResumeRoastStreamEvent(event)))
        );
      };
      requestSignal.addEventListener("abort", close, { once: true });

      enqueue({ type: "session", roastId: prepared.roastId, replayed: false, target: prepared.target });
      void generation
        .then((roast) => {
          for (const event of resumeRoastResultEvents({
            roastId: roast.id,
            replayed: false,
            target: roast.target,
            result: roast.result
          }).slice(1))
            enqueue(event);
        })
        .catch((error: unknown) => {
          enqueue({
            type: "error",
            code:
              error instanceof ResumeRoastCancelledError
                ? "cancelled"
                : error instanceof ResumeRoastProviderRateLimitedError
                  ? "rate-limited"
                  : error instanceof ResumeRoastTimeoutError
                    ? "timeout"
                    : error instanceof ResumeRoastInvalidResponseError
                      ? "invalid-response"
                      : "generation-failed",
            retryable: !(error instanceof ResumeRoastCancelledError)
          });
        })
        .finally(() => {
          requestSignal.removeEventListener("abort", close);
          close();
        });
    },
    cancel() {
      closed = true;
    }
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function resumeRoastApiError(error: unknown, path: string): Response {
  // Avoid generic API logging of provider errors, which can retain private
  // model context. Expected route errors retain their normal HTTP semantics.
  return apiError(
    error instanceof ApiRouteError
      ? error
      : new ApiRouteError(
          503,
          "RESUME_ROAST_UNAVAILABLE",
          "Resume Roast is temporarily unavailable."
        ),
    path
  );
}
