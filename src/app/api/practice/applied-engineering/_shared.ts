import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, type RateLimitPolicy } from "@/server/rate-limit/shared-guard";

export async function appliedEngineeringOwner(policy?: RateLimitPolicy) {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  const ownerId = authenticatedOwnerId(userId);
  const app = getAppContainer();
  const profile = await app.profileService.get(ownerId);
  requireCompletedPreparationOnboarding(profile);
  if (policy) await getSharedGuard(app.config).enforce(policy, ownerId);
  return { ownerId, app, profile };
}

export async function requireAppliedEngineeringEligibility(
  app: ReturnType<typeof getAppContainer>,
  profile: Parameters<
    ReturnType<typeof getAppContainer>["appliedEngineeringEligibilityService"]["forProfile"]
  >[0]
) {
  const eligibility = await app.appliedEngineeringEligibilityService.forProfile(profile);
  if (!eligibility.available)
    throw new ApiRouteError(
      eligibility.reason === "RUNNER_UNAVAILABLE" ? 503 : 409,
      `APPLIED_ENGINEERING_${eligibility.reason}`,
      eligibility.message
    );
  return eligibility;
}

export async function parseAppliedEngineeringJson<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    throw new ApiRouteError(
      400,
      "APPLIED_ENGINEERING_INVALID_REQUEST",
      "That Applied Engineering request is invalid.",
      { messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }
    );
  return parsed.data;
}

export { apiError };
