import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { attachInterviewOwnerCookie, resolveInterviewOwner } from "@/server/interview/owner";
import {
  buildFundamentalsPlan,
  fundamentalsRoundContext
} from "@/server/interview/fundamentals-round";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Starts the computer fundamentals round.
 *
 * The plan comes entirely from the authored bank, so this route never calls a
 * model — not on the first round, not on any later one.
 */
export async function POST(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    const { ownerId } = owner;
    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, ownerId);
    const creationLease = await guard.acquire(
      {
        namespace: "interview-create",
        ttlMs: 65_000,
        code: "INTERVIEW_CREATION_IN_PROGRESS",
        message: "An interview is already being prepared for you."
      },
      ownerId
    );

    try {
      const profile = await app.profileService.get(ownerId);
      const plan = buildFundamentalsPlan(profile.level ?? null);

      if (!plan.length) {
        throw new ApiRouteError(
          503,
          "FUNDAMENTALS_BANK_EMPTY",
          "The fundamentals question bank is not available.",
          {}
        );
      }

      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "frontend",
          level: profile.level ?? "0-2",
          roundType: "technical",
          intensity: "realistic",
          context: fundamentalsRoundContext(profile.level ?? null),
          agenda: plan.map((question) => question.text),
          templateId: "applied-engineering",
          templateTitle: "Computer Fundamentals",
          fundamentalsRound: true
        },
        ownerId,
        Date.now(),
        plan
      );

      return attachInterviewOwnerCookie(
        apiSuccess({
          sessionId: result.state.id,
          questionCount: result.state.plan.length,
          utterance: result.utterance
        }),
        owner,
        app.config
      );
    } finally {
      await creationLease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
