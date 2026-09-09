import type { NextRequest } from "next/server";
import { coreTechnicalSaveDraftInputSchema } from "@/features/practice/core-technical/domain/practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../_shared";


export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseCoreTechnicalJson(request, coreTechnicalSaveDraftInputSchema);
    return apiSuccess({ question: await app.coreTechnicalPracticeService.saveDraft(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
