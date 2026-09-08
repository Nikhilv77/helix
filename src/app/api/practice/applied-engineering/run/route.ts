import type { NextRequest } from "next/server";
import { appliedEngineeringRunInputSchema } from "@/lib/practice/applied-engineering/practice-contracts";
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
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.codeExecution);
    const input = await parseAppliedEngineeringJson(r, appliedEngineeringRunInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "applied-engineering-code-run",
        ttlMs: 60000,
        code: "APPLIED_ENGINEERING_RUN_IN_PROGRESS",
        message: "A code run is already in progress for this question."
      },
      `${ownerId}:${input.questionId}`
    );
    return apiSuccess({ run: await app.appliedEngineeringPracticeService.runCode(ownerId, input) });
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
