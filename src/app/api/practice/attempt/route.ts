import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { NON_DSA_PRACTICE_SESSION_KEYS } from "@/lib/practice/prep-practice";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

const attemptSchema = z.object({
  requestId: z.string().uuid(),
  sessionKey: z.enum(NON_DSA_PRACTICE_SESSION_KEYS),
  questionId: z.string().trim().min(1).max(180),
  action: z.enum(["submit", "skip"]),
  answer: z.string().max(20_000).default(""),
  selectedOptionIndex: z.number().int().min(0).max(30).nullable().default(null),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000)
    .nullable()
    .default(null)
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const app = getAppContainer();
    if (!app.config.practiceNonDsaEnabled) {
      throw new ApiRouteError(404, "PRACTICE_DISABLED", "Practice workspace not found");
    }
    const ownerId = authenticatedOwnerId(userId);
    const profile = await app.profileService.get(ownerId);
    if (!profile.onboardingCompletedAt) {
      throw new ApiRouteError(409, "ONBOARDING_REQUIRED", "Finish onboarding first.");
    }
    const parsed = attemptSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Practice attempt validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.answerEvaluation, ownerId);
    return apiSuccess(await app.prepPracticeService.attempt(ownerId, parsed.data));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
