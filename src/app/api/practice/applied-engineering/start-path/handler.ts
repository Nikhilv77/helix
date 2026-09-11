import type { NextRequest } from "next/server";
import { appliedEngineeringStartPathInputSchema } from "@/features/practice/applied-engineering/domain/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import {
  getSharedGuard,
  RATE_LIMIT_POLICIES,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import {
  apiError,
  appliedEngineeringOwner,
  parseAppliedEngineeringJson,
  requireAppliedEngineeringEligibility
} from "../_shared";

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app, profile } = await appliedEngineeringOwner(
      RATE_LIMIT_POLICIES.answerEvaluation
    );
    await requireAppliedEngineeringEligibility(app, profile);
    const input = await parseAppliedEngineeringJson(
      request,
      appliedEngineeringStartPathInputSchema
    );
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-start-path",
        ttlMs: 300_000,
        code: "APPLIED_ENGINEERING_PREPARATION_IN_PROGRESS",
        message: "This Applied Engineering incident is already being prepared."
      },
      `${ownerId}:${input.storyKey}`
    );
    return apiSuccess(await app.appliedEngineeringPreparationService.startPath(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
