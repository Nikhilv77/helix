import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { DsaBlockAssessmentPreparationError } from "@/server/dsa/dsa-block-assessment-preparation.service";
import { DsaBlockAssessmentRuntimeError } from "@/server/dsa/dsa-block-assessment-runtime.service";
import { attachInterviewOwnerCookie, resolveInterviewOwner } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const startSchema = z.object({ blockId: z.string().uuid() });

/** Starts (or resumes) the one frozen assessment attached to the current DSA block. */
export async function POST(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    const parsed = startSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "A valid DSA block ID is required.");
    }
    if (app.config.nodeEnv === "development") {
      await app.dsaPracticeBlockStore.refreshReadiness(owner.ownerId, {
        allowIncomplete: true
      });
      await app.dsaBlockAssessmentPreparationService.prepareCurrent(owner.ownerId, {
        allowSyntheticEvidence: true
      });
    }
    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, owner.ownerId);
    const lease = await guard.acquire(
      {
        namespace: "dsa-block-assessment-start",
        ttlMs: 65_000,
        code: "DSA_BLOCK_ASSESSMENT_START_IN_PROGRESS",
        message: "Your block assessment is already being prepared."
      },
      owner.ownerId
    );
    try {
      const result = await app.dsaBlockAssessmentRuntimeService.startOrResume(
        owner.ownerId,
        parsed.data.blockId
      );
      return attachInterviewOwnerCookie(
        apiSuccess({ sessionId: result.sessionId, created: result.created }),
        owner,
        app.config
      );
    } finally {
      await lease.release();
    }
  } catch (error) {
    return apiError(startError(error), request.nextUrl.pathname);
  }
}

function startError(error: unknown): unknown {
  if (error instanceof DsaBlockAssessmentPreparationError) {
    const status =
      error.code === "BLOCK_NOT_FOUND"
        ? 404
        : error.code === "TRANSFER_QUESTIONS_UNAVAILABLE"
          ? 422
          : 409;
    return new ApiRouteError(status, error.code, error.message);
  }
  if (error instanceof DsaBlockAssessmentRuntimeError) {
    const status =
      error.code === "BLOCK_NOT_FOUND" ? 404 : error.code === "ASSESSMENT_NOT_READY" ? 409 : 422;
    return new ApiRouteError(status, error.code, error.message);
  }
  return error;
}
