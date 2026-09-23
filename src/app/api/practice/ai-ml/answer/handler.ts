import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { aiMlPracticeAnswerSchema } from "@/features/practice/ai-ml/server/ai-ml-practice.service";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { requireCompletedPreparationOnboarding } from "@/server/auth/preparation-onboarding-api-guard";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  getSharedGuard,
  RATE_LIMIT_POLICIES,
  type SharedLease
} from "@/server/rate-limit/shared-guard";

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
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

    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.practiceState, ownerId);
    const parsed = aiMlPracticeAnswerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "AI_ML_PRACTICE_INVALID_REQUEST", "That answer is invalid.", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "ai-ml-practice-answer",
        ttlMs: 30_000,
        code: "AI_ML_PRACTICE_ANSWER_IN_PROGRESS",
        message: "That AI/ML answer is already being saved."
      },
      `${ownerId}:${parsed.data.questionId}`
    );

    return apiSuccess(await app.aiMlPracticeService.answer(ownerId, parsed.data));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
