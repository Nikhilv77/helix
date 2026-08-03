import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";

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
    const now = Date.now();
    const existing = app.interviewService.get(parsed.data.sessionId);
    const defaultEnd = Math.max(0, now - existing.startedAt);

    const { state, decision } = await app.interviewService.answer(
      parsed.data.sessionId,
      {
        text: parsed.data.userAnswer,
        startMs: parsed.data.startMs ?? defaultEnd,
        endMs: parsed.data.endMs ?? defaultEnd
      },
      now
    );

    return apiSuccess({
      action: decision.action,
      utterance: decision.utterance,
      missing: decision.missing,
      forcedBy: decision.forcedBy,
      phase: state.phase,
      questionIndex: state.questionIndex,
      questionCount: state.plan.length,
      followUpCount: state.followUpCount,
      elapsedMs: Math.max(0, now - state.startedAt)
    });
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
