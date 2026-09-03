import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  encodeResumeRoastStreamEvent,
  resumeRoastResultEvents,
  validateResumeRoastStreamEvent
} from "@/lib/resume-roast/stream";
import { ResumeRoastTargetSchema } from "@/lib/resume-roast/contracts";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import {
  ResumeRoastCancelledError,
  ResumeRoastInvalidResponseError,
  ResumeRoastTimeoutError
} from "@/server/resume-roast/resume-roast.service";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const response = apiSuccess(await getAppContainer().resumeRoastService.state(ownerId));
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
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.resumeRoastGeneration, ownerId);
    const prepared = await app.resumeRoastService.prepare(ownerId, parsed.data.target);
    return roastStream(ownerId, prepared, app.resumeRoastService, request.signal);
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
    const response = apiSuccess({ deleted });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return resumeRoastApiError(error, request.nextUrl.pathname);
  }
}

type RoastService = ReturnType<typeof getAppContainer>["resumeRoastService"];
type PreparedRoast = Awaited<ReturnType<RoastService["prepare"]>>;

function roastStream(
  ownerId: string,
  prepared: PreparedRoast,
  service: RoastService,
  requestSignal: AbortSignal
): Response {
  const encoder = new TextEncoder();
  const controller = new AbortController();
  const abort = () => controller.abort();
  requestSignal.addEventListener("abort", abort, { once: true });
  // `abort` is not replayed for listeners registered after it fired. Checking
  // immediately after registration closes the prepare → stream handoff race,
  // while the listener covers every later disconnect.
  if (requestSignal.aborted) controller.abort();

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      void emitRoast(
        streamController,
        encoder,
        ownerId,
        prepared,
        service,
        controller.signal
      ).finally(() => {
        requestSignal.removeEventListener("abort", abort);
      });
    },
    cancel() {
      controller.abort();
      requestSignal.removeEventListener("abort", abort);
    }
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

async function emitRoast(
  streamController: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  ownerId: string,
  prepared: PreparedRoast,
  service: RoastService,
  signal: AbortSignal
): Promise<void> {
  const close = () => {
    try {
      streamController.close();
    } catch {
      // A browser-side cancel closes the controller first. There is no client
      // left to notify, and surfacing that internal stream state is unsafe.
    }
  };
  const enqueue = (event: Parameters<typeof encodeResumeRoastStreamEvent>[0]) => {
    if (signal.aborted) return;
    streamController.enqueue(
      encoder.encode(encodeResumeRoastStreamEvent(validateResumeRoastStreamEvent(event)))
    );
  };
  try {
    enqueue({
      type: "session",
      roastId: prepared.roastId,
      replayed: false,
      target: prepared.target
    });
    const roast = await service.finishClaim(ownerId, prepared, signal);
    for (const event of resumeRoastResultEvents({
      roastId: roast.id,
      replayed: false,
      target: roast.target,
      result: roast.result
    }).slice(1))
      enqueue(event);
    close();
  } catch (error) {
    if (!signal.aborted) {
      enqueue({
        type: "error",
        code:
          error instanceof ResumeRoastCancelledError
            ? "cancelled"
            : error instanceof ResumeRoastTimeoutError
              ? "timeout"
              : error instanceof ResumeRoastInvalidResponseError
                ? "invalid-response"
                : "generation-failed",
        retryable: !(error instanceof ResumeRoastCancelledError)
      });
      close();
    } else {
      close();
    }
  }
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
