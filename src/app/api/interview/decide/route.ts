import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authorizeInterviewSession } from "@/server/interview/session-access";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The single home of the interview decision logic.
 *
 * Phase 2's LiveKit agent calls this after every user turn and speaks the
 * `utterance` it gets back. The agent does not own any state — everything it
 * needs is derived here from the session id.
 */
const decideSchema = z.object({
  sessionId: z.string().uuid(),
  turnId: z.string().uuid(),
  userAnswer: z.string().trim().min(1).max(8000),
  /** Milliseconds from session start. Voice fills these from real audio timings. */
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const parsed = decideSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    const access = await authorizeInterviewSession(
      request,
      app.config,
      parsed.data.sessionId,
      "answer"
    );
    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.answerEvaluation, parsed.data.sessionId);
    const lease = await guard.acquire(
      {
        namespace: "answer-evaluate",
        ttlMs: 65_000,
        code: "ANSWER_EVALUATION_IN_PROGRESS",
        message: "The previous answer is still being evaluated."
      },
      parsed.data.sessionId
    );

    try {
      const now = Date.now();
      const existing =
        access.kind === "owner"
          ? await app.interviewService.getOwnedActive(access.ownerId, parsed.data.sessionId)
          : await app.interviewService.get(parsed.data.sessionId);
      const defaultEnd = Math.max(0, now - existing.startedAt);

      const answer = {
        text: parsed.data.userAnswer,
        startMs: parsed.data.startMs ?? defaultEnd,
        endMs: parsed.data.endMs ?? defaultEnd
      };
      const { response } =
        access.kind === "owner"
          ? await app.interviewService.answerOwned(
              access.ownerId,
              parsed.data.sessionId,
              answer,
              now,
              parsed.data.turnId
            )
          : await app.interviewService.answer(
              parsed.data.sessionId,
              answer,
              now,
              parsed.data.turnId
            );

      return apiSuccess(response);
    } finally {
      await lease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
