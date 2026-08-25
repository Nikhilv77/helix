import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { attachInterviewOwnerCookie, resolveInterviewOwner } from "@/server/interview/owner";
import { buildResumePlan, resumeRoundContext } from "@/server/interview/resume-round";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Starts the staged resume round.
 *
 * The plan is assembled from the kit stored with the candidate's resume, so a
 * warm profile starts this round without a single model call. Only the very
 * first round for a given resume pays for the kit, and that result is persisted.
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
      const resume = profile.resume;

      if (!resume) {
        throw new ApiRouteError(
          409,
          "RESUME_REQUIRED",
          "Upload your resume before starting a resume interview.",
          {}
        );
      }

      const kit = await app.resumeInterviewKitService.ensure({
        ownerId,
        resume,
        targetRole: profile.targetRole ?? "frontend",
        level: profile.level ?? "0-2"
      });
      const plan = buildResumePlan(kit);

      if (!plan.length) {
        throw new ApiRouteError(
          409,
          "RESUME_ROUND_UNAVAILABLE",
          "Maya could not build a round from this resume yet. Try re-uploading it.",
          {}
        );
      }

      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "frontend",
          level: profile.level ?? "0-2",
          roundType: "behavioral",
          intensity: "realistic",
          context: resumeRoundContext(resume, kit),
          agenda: plan.map((question) => question.text),
          templateId: "resume-behavioral-defense",
          templateTitle: "Resume and Behavioral Defense",
          resumeRound: true
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
