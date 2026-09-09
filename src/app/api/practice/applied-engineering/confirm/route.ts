import type { NextRequest } from "next/server";
import { appliedEngineeringFocusConfirmationSchema } from "@/features/practice/applied-engineering/server/focus.service";
import { apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import {
  apiError,
  appliedEngineeringOwner,
  parseAppliedEngineeringJson,
  requireAppliedEngineeringEligibility
} from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const { ownerId, app, profile } = await appliedEngineeringOwner(
      RATE_LIMIT_POLICIES.practiceState
    );
    await requireAppliedEngineeringEligibility(app, profile);
    const input = await parseAppliedEngineeringJson(
      request,
      appliedEngineeringFocusConfirmationSchema
    );
    return apiSuccess({
      focus: await app.appliedEngineeringPreparationService.confirm(ownerId, input)
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
