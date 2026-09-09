import type { NextRequest } from "next/server";
import { appliedEngineeringPrepareInputSchema } from "@/features/practice/applied-engineering/domain/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  RATE_LIMIT_POLICIES,
  getSharedGuard,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import {
  apiError,
  appliedEngineeringOwner,
  parseAppliedEngineeringJson,
  requireAppliedEngineeringEligibility
} from "../_shared";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(r: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app, profile } = await appliedEngineeringOwner(
      RATE_LIMIT_POLICIES.answerEvaluation
    );
    await requireAppliedEngineeringEligibility(app, profile);
    const input = await parseAppliedEngineeringJson(r, appliedEngineeringPrepareInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-prepare",
        ttlMs: 300000,
        code: "APPLIED_ENGINEERING_PREPARATION_IN_PROGRESS",
        message: "This Applied Engineering block is already being prepared."
      },
      ownerId
    );
    return apiSuccess(await app.appliedEngineeringPreparationService.prepare(ownerId, input));
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
