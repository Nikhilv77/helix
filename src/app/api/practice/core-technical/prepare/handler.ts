import type { NextRequest } from "next/server";
import { coreTechnicalPrepareInputSchema } from "@/features/practice/core-technical/domain/practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  getSharedGuard,
  RATE_LIMIT_POLICIES,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import {
  coreTechnicalMutationOwner,
  parseCoreTechnicalJson,
  requireCoreTechnicalLaunchEligibility
} from "../_shared";


export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app, profile } = await coreTechnicalMutationOwner(
      RATE_LIMIT_POLICIES.answerEvaluation
    );
    await requireCoreTechnicalLaunchEligibility(app, profile);
    const input = await parseCoreTechnicalJson(request, coreTechnicalPrepareInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "core-technical-prepare",
        ttlMs: 300_000,
        code: "CORE_TECHNICAL_PREPARATION_IN_PROGRESS",
        message: "This Core Technical block is already being prepared."
      },
      ownerId
    );
    return apiSuccess(await app.coreTechnicalPreparationService.prepare(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
