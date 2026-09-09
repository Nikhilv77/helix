import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { apiError } from "@/server/http/api-response";
import type { RateLimitPolicy } from "@/server/rate-limit/shared-guard";
import { createStoryPracticeRouteAccess } from "@/features/practice/shared/server/route-kit";

const routeAccess = createStoryPracticeRouteAccess({
  errorPrefix: "ARCHITECTURE_DESIGN",
  label: "Architecture & Design",
  getApp: getAppContainer,
  requireOnboarding: requireCompletedPreparationOnboarding,
  eligibility: (app, profile) => app.architectureDesign.eligibility.forProfile(profile)
});

export function architectureDesignOwner(policy?: RateLimitPolicy) {
  return routeAccess.owner(policy);
}

export function requireArchitectureDesignEligibility(
  app: ReturnType<typeof getAppContainer>,
  profile: CandidateProfile
) {
  return routeAccess.requireEligibility(app, profile);
}

export function parseArchitectureDesignJson<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema
): Promise<z.output<TSchema>> {
  return routeAccess.parseJson(request, schema);
}

export { apiError };
