import type { NextRequest } from "next/server";
import { coreTechnicalAssessmentFinalizeInputSchema } from "@/features/practice/core-technical/domain/assessment-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getSharedGuard, RATE_LIMIT_POLICIES, type SharedLease } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseCoreTechnicalJson(request, coreTechnicalAssessmentFinalizeInputSchema);
    lease = await getSharedGuard(app.config).acquire({
      namespace: "core-technical-assessment-finalize",
      ttlMs: 120_000,
      code: "CORE_TECHNICAL_ASSESSMENT_FINALIZING",
      message: "This Core Technical assessment is already being finalized."
    }, `${ownerId}:${input.assessmentId}`);
    return apiSuccess({ assessment: await app.coreTechnicalAssessmentService.finalize(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
