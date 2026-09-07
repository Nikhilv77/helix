import type { NextRequest } from "next/server";
import { coreTechnicalContinueInputSchema } from "@/lib/practice/core-technical/assessment-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getSharedGuard, RATE_LIMIT_POLICIES, type SharedLease } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseCoreTechnicalJson(request, coreTechnicalContinueInputSchema);
    lease = await getSharedGuard(app.config).acquire({
      namespace: "core-technical-continue",
      ttlMs: 300_000,
      code: "CORE_TECHNICAL_CONTINUATION_IN_PROGRESS",
      message: "The next Core Technical story is already being prepared."
    }, ownerId);
    return apiSuccess(await app.coreTechnicalContinuationService.continue(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
