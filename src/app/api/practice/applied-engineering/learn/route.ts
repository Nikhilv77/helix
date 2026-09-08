import type { NextRequest } from "next/server";
import { appliedEngineeringLearnInputSchema } from "@/lib/practice/applied-engineering/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { apiError, appliedEngineeringOwner, parseAppliedEngineeringJson } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(r: NextRequest) {
  try {
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.practiceState);
    return apiSuccess({
      question: await app.appliedEngineeringPracticeService.learn(
        ownerId,
        await parseAppliedEngineeringJson(r, appliedEngineeringLearnInputSchema)
      )
    });
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  }
}
