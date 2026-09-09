import type { NextRequest } from "next/server";
import { coreTechnicalFocusConfirmationSchema } from "@/features/practice/core-technical/server/focus.service";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import {
  coreTechnicalMutationOwner,
  parseCoreTechnicalJson,
  requireCoreTechnicalLaunchEligibility
} from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app, profile } = await coreTechnicalMutationOwner(
      RATE_LIMIT_POLICIES.practiceState
    );
    await requireCoreTechnicalLaunchEligibility(app, profile);
    const input = await parseCoreTechnicalJson(request, coreTechnicalFocusConfirmationSchema);
    return apiSuccess({ focus: await app.coreTechnicalPreparationService.confirm(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
