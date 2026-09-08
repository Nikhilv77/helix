import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer, type AppContainer } from "@/server/app-container";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { apiError } from "@/server/http/api-response";
import type { RateLimitPolicy } from "@/server/rate-limit/shared-guard";
import { createStoryPracticeRouteAccess } from "@/server/story-practice/route-kit";

const routeAccess = createStoryPracticeRouteAccess({
  errorPrefix: "CORE_TECHNICAL",
  label: "Core Technical",
  getApp: getAppContainer,
  requireOnboarding: requireCompletedPreparationOnboarding,
  eligibility: (app, profile) => app.coreTechnicalEligibilityService.forProfile(profile)
});

export function coreTechnicalOwner(): Promise<{
  ownerId: string;
  app: AppContainer;
  profile: CandidateProfile;
}> {
  return routeAccess.owner();
}

/** Prevents direct mutation calls from bypassing the fail-closed launch card and page. */
export function requireCoreTechnicalLaunchEligibility(
  app: AppContainer,
  profile: CandidateProfile
) {
  return routeAccess.requireEligibility(app, profile);
}

export function coreTechnicalMutationOwner(policy: RateLimitPolicy) {
  return routeAccess.owner(policy);
}

export function parseCoreTechnicalJson<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema
): Promise<z.output<TSchema>> {
  return routeAccess.parseJson(request, schema);
}

export { apiError };
