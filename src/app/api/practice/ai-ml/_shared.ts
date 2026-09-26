import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { storyDisciplineForRole } from "@/features/practice/story-tracks/domain/story-disciplines";
import { requireCompletedPreparationOnboardingState } from "@/server/auth/preparation-onboarding-api-guard";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { getSharedGuard, type RateLimitPolicy } from "@/server/rate-limit/shared-guard";
import { profileAndRateLimit } from "@/features/practice/shared/server/route-kit";

export async function aiMlStoryOwner(policy: RateLimitPolicy) {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  const ownerId = authenticatedOwnerId(userId);
  const app = getAppContainer();
  const state = await profileAndRateLimit(
    app.profileService.workspaceShellState(ownerId),
    getSharedGuard(app.config).enforce(policy, ownerId)
  );
  requireCompletedPreparationOnboardingState(state);
  // Frontend, data, and AI/ML story practice share these handlers; each
  // question is owner-scoped, and its session records the discipline.
  if (!storyDisciplineForRole(state.targetRole)) {
    throw new ApiRouteError(
      409,
      "AI_ML_PRACTICE_ROLE_REQUIRED",
      "Story practice requires an AI/ML, frontend, or data target role."
    );
  }
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
