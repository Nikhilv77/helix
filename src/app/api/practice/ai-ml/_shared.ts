import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { getSharedGuard, type RateLimitPolicy } from "@/server/rate-limit/shared-guard";

export async function aiMlStoryOwner(policy: RateLimitPolicy) {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  const ownerId = authenticatedOwnerId(userId);
  const app = getAppContainer();
  const profile = await app.profileService.get(ownerId);
  requireCompletedPreparationOnboarding(profile);
  if (profile.targetRole !== "ai-ml") {
    throw new ApiRouteError(
      409,
      "AI_ML_PRACTICE_ROLE_REQUIRED",
      "AI/ML practice requires an AI/ML target role."
    );
  }
  await getSharedGuard(app.config).enforce(policy, ownerId);
  return { ownerId, app };
}

export async function parseAiMlStoryJson<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiRouteError(
      400,
      "AI_ML_PRACTICE_INVALID_REQUEST",
      "That AI/ML practice request is invalid.",
      {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      }
    );
  }
  return parsed.data;
}
