import type { NextRequest } from "next/server";
import { appliedEngineeringContinueInputSchema } from "@/lib/practice/applied-engineering/assessment-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, appliedEngineeringOwner, parseAppliedEngineeringJson } from "../_shared";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(r: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseAppliedEngineeringJson(r, appliedEngineeringContinueInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-continue",
        ttlMs: 300000,
        code: "APPLIED_ENGINEERING_CONTINUATION_IN_PROGRESS",
        message: "The next Applied Engineering incident is already being prepared."
      },
      ownerId
    );
    return apiSuccess(await app.appliedEngineeringContinuationService.continue(ownerId, input));
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
