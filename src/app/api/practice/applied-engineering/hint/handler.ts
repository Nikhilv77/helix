import type { NextRequest } from "next/server";
import { appliedEngineeringRevealHintInputSchema } from "@/features/practice/applied-engineering/domain/practice-contracts";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { apiError, appliedEngineeringOwner, parseAppliedEngineeringJson } from "../_shared";
export async function POST(r: NextRequest) {
  try {
    const { ownerId, app } = await appliedEngineeringOwner(RATE_LIMIT_POLICIES.practiceState);
    return apiSuccess({
      question: await app.appliedEngineeringPracticeService.revealHint(
        ownerId,
        await parseAppliedEngineeringJson(r, appliedEngineeringRevealHintInputSchema)
      )
    });
  } catch (e) {
    return apiError(e, r.nextUrl.pathname);
  }
}
