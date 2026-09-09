import type { NextRequest } from "next/server";
import { appliedEngineeringAssessmentStartInputSchema } from "@/features/practice/applied-engineering/domain/assessment-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, appliedEngineeringOwner, parseAppliedEngineeringJson } from "../../_shared";
export async function POST(r: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseAppliedEngineeringJson(
      r,
      appliedEngineeringAssessmentStartInputSchema
    );
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-assessment-start",
        ttlMs: 30000,
        code: "APPLIED_ENGINEERING_ASSESSMENT_START_IN_PROGRESS",
        message: "This Applied Engineering assessment is already starting."
      },
      `${ownerId}:${input.assessmentId}`
    );
    return apiSuccess({
      assessment: await app.appliedEngineeringAssessmentService.start(ownerId, input, {
        allowLocked: app.config.nodeEnv === "development"
      })
    });
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
