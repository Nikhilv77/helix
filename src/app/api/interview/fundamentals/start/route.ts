import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { resolveOwnerId } from "@/server/interview/owner";
import {
  buildFundamentalsPlan,
  fundamentalsRoundContext
} from "@/server/interview/fundamentals-round";

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
    const ownerId = await resolveOwnerId(request, app.config);
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
        templateId: "computer-fundamentals",
        templateTitle: "Computer Fundamentals",
        fundamentalsRound: true
      },
      ownerId,
      Date.now(),
      plan
    );

    return apiSuccess({
      sessionId: result.state.id,
      questionCount: result.state.plan.length,
      utterance: result.utterance
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
