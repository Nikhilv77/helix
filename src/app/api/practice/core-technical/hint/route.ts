import type { NextRequest } from "next/server";
import { coreTechnicalRevealHintInputSchema } from "@/lib/practice/core-technical/practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { coreTechnicalMutationOwner, parseCoreTechnicalJson } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await coreTechnicalMutationOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseCoreTechnicalJson(request, coreTechnicalRevealHintInputSchema);
    return apiSuccess({ question: await app.coreTechnicalPracticeService.revealHint(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
