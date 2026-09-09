import type { NextRequest } from "next/server";
import { coreTechnicalRunInputSchema } from "@/features/practice/core-technical/domain/practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getSharedGuard, RATE_LIMIT_POLICIES, type SharedLease } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.codeExecution);
    const input = await parseCoreTechnicalJson(request, coreTechnicalRunInputSchema);
    lease = await getSharedGuard(app.config).acquire({
      namespace: "core-technical-code-run",
      ttlMs: 60_000,
      code: "CORE_TECHNICAL_RUN_IN_PROGRESS",
      message: "A code run is already in progress for this question."
    }, `${ownerId}:${input.questionId}`);
    return apiSuccess({ run: await app.coreTechnicalPracticeService.runCode(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
