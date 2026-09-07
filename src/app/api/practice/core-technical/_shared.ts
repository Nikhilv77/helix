import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer, type AppContainer } from "@/server/app-container";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, type RateLimitPolicy } from "@/server/rate-limit/shared-guard";

export async function coreTechnicalOwner(): Promise<{
  ownerId: string;
  app: AppContainer;
  profile: CandidateProfile;
}> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  const ownerId = authenticatedOwnerId(userId);
  const app = getAppContainer();
  const profile = await app.profileService.get(ownerId);
  requireCompletedPreparationOnboarding(profile);
  return { ownerId, app, profile };
}

/** Prevents direct mutation calls from bypassing the fail-closed launch card and page. */
export async function requireCoreTechnicalLaunchEligibility(
  app: AppContainer,
  profile: CandidateProfile
) {
  const eligibility = await app.coreTechnicalEligibilityService.forProfile(profile);
  if (!eligibility.available) {
    throw new ApiRouteError(
      eligibility.reason === "RUNNER_UNAVAILABLE" ? 503 : 409,
      `CORE_TECHNICAL_${eligibility.reason}`,
      eligibility.message
    );
  }
  return eligibility;
}

export async function coreTechnicalMutationOwner(policy: RateLimitPolicy) {
  const context = await coreTechnicalOwner();
  await getSharedGuard(context.app.config).enforce(policy, context.ownerId);
  return context;
}

export async function parseCoreTechnicalJson<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiRouteError(
      400,
      "CORE_TECHNICAL_INVALID_REQUEST",
      "That Core Technical request is invalid.",
      {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      }
    );
  }
  return parsed.data;
}
