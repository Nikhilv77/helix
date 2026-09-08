import type { NextRequest } from "next/server";
import { appliedEngineeringAttemptInputSchema } from "@/lib/practice/applied-engineering/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { apiError, appliedEngineeringOwner, parseAppliedEngineeringJson } from "../_shared";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(r: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseAppliedEngineeringJson(r, appliedEngineeringAttemptInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-attempt",
        ttlMs: 60000,
        code: "APPLIED_ENGINEERING_ATTEMPT_IN_PROGRESS",
        message: "An attempt is already being evaluated for this question."
      },
      `${ownerId}:${input.questionId}`
    );
    return apiSuccess(await app.appliedEngineeringPracticeService.submitAttempt(ownerId, input));
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
