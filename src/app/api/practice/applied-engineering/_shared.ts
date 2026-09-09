import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { apiError } from "@/server/http/api-response";
import type { RateLimitPolicy } from "@/server/rate-limit/shared-guard";
import { createStoryPracticeRouteAccess } from "@/features/practice/shared/server/route-kit";

const routeAccess = createStoryPracticeRouteAccess({
  errorPrefix: "APPLIED_ENGINEERING",
  label: "Applied Engineering",
  getApp: getAppContainer,
  requireOnboarding: requireCompletedPreparationOnboarding,
  eligibility: (app, profile) => app.appliedEngineeringEligibilityService.forProfile(profile)
});

export function appliedEngineeringOwner(policy?: RateLimitPolicy) {
  return routeAccess.owner(policy);
}

export function requireAppliedEngineeringEligibility(
  app: ReturnType<typeof getAppContainer>,
  profile: CandidateProfile
) {
  return routeAccess.requireEligibility(app, profile);
}

export function parseAppliedEngineeringJson<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema
): Promise<z.output<TSchema>> {
  return routeAccess.parseJson(request, schema);
}

export { apiError };
