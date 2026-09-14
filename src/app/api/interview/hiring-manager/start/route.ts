import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  attachInterviewOwnerCookie,
  resolveInterviewOwner
} from "@/features/interviews/server/owner";
import {
  buildHiringManagerPlan,
  hiringManagerRoundContext
} from "@/features/interviews/server/hiring-manager-round";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

/** Starts the permanent hiring-manager/final-behavioural round. */
export async function POST(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, owner.ownerId);
    const creationLease = await guard.acquire(
      {
        namespace: "interview-create",
        ttlMs: 65_000,
        code: "INTERVIEW_CREATION_IN_PROGRESS",
        message: "An interview is already being prepared for you."
      },
      owner.ownerId
    );

    try {
      const profile = await app.profileService.get(owner.ownerId);
      const personalization = {
        resume: profile.resume,
        targetRole: profile.targetRole,
        targetCompany: profile.targetCompany
      };
      const plan = buildHiringManagerPlan(personalization);
      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "frontend",
          level: profile.level ?? "0-2",
          roundType: "hiring-manager",
          intensity: "realistic",
          context: hiringManagerRoundContext(personalization),
          agenda: plan.map((question) => question.text),
          templateId: "hiring-manager-final",
          templateTitle: "Hiring Manager & Final Behavioural",
          // Reuse the mature resume/behavioural room and evidence evaluator.
          resumeRound: true
        },
        owner.ownerId,
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
