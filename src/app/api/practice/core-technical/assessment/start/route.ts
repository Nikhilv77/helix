import type { NextRequest } from "next/server";
import { coreTechnicalAssessmentStartInputSchema } from "@/features/practice/core-technical/domain/assessment-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  getSharedGuard,
  RATE_LIMIT_POLICIES,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseCoreTechnicalJson(request, coreTechnicalAssessmentStartInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "core-technical-assessment-start",
        ttlMs: 30_000,
        code: "CORE_TECHNICAL_ASSESSMENT_START_IN_PROGRESS",
        message: "This Core Technical assessment is already starting."
      },
      `${ownerId}:${input.assessmentId}`
    );
    return apiSuccess({
      assessment: await app.coreTechnicalAssessmentService.start(ownerId, input, {
        allowLocked: app.config.nodeEnv === "development"
      })
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
