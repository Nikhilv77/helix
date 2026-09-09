import type { NextRequest } from "next/server";
import { coreTechnicalLearnInputSchema } from "@/features/practice/core-technical/domain/practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseCoreTechnicalJson(request, coreTechnicalLearnInputSchema);
    return apiSuccess({ question: await app.coreTechnicalPracticeService.learn(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
