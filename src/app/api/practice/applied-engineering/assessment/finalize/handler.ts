import type { NextRequest } from "next/server";
import { appliedEngineeringAssessmentFinalizeInputSchema } from "@/features/practice/applied-engineering/domain/assessment-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, appliedEngineeringOwner, parseAppliedEngineeringJson } from "../../_shared";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(r: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseAppliedEngineeringJson(
      r,
      appliedEngineeringAssessmentFinalizeInputSchema
    );
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-assessment-finalize",
        ttlMs: 120000,
        code: "APPLIED_ENGINEERING_ASSESSMENT_FINALIZING",
        message: "This Applied Engineering assessment is already being finalized."
      },
      `${ownerId}:${input.assessmentId}`
    );
    return apiSuccess({
      assessment: await app.appliedEngineeringAssessmentService.finalize(ownerId, input)
    });
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
