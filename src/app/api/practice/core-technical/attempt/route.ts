import type { NextRequest } from "next/server";
import { coreTechnicalAttemptInputSchema } from "@/lib/practice/core-technical/practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getSharedGuard, RATE_LIMIT_POLICIES, type SharedLease } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseCoreTechnicalJson(request, coreTechnicalAttemptInputSchema);
    lease = await getSharedGuard(app.config).acquire({
      namespace: "core-technical-attempt",
      ttlMs: 60_000,
      code: "CORE_TECHNICAL_ATTEMPT_IN_PROGRESS",
      message: "An attempt is already being evaluated for this question."
    }, `${ownerId}:${input.questionId}`);
    return apiSuccess(await app.coreTechnicalPracticeService.submitAttempt(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
