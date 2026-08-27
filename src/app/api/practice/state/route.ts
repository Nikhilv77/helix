import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { NON_DSA_PRACTICE_SESSION_KEYS } from "@/lib/practice/prep-practice";
import { PREP_STATE_RETRY_COUNT_MAX } from "@/lib/practice/prep-state-save-queue";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { practiceTelemetry } from "@/server/practice/practice-telemetry";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

const stateSchema = z
  .object({
    sessionKey: z.enum(NON_DSA_PRACTICE_SESSION_KEYS),
    questionId: z.string().trim().min(1).max(180),
    retryCount: z.number().int().min(0).max(PREP_STATE_RETRY_COUNT_MAX).default(0),
    draftAnswer: z.string().max(20_000).optional(),
    revealedHintCount: z.number().int().min(0).max(20).optional(),
    note: z.string().max(20_000).optional()
  })
  .refine(
    (value) =>
      value.draftAnswer !== undefined ||
      value.revealedHintCount !== undefined ||
      value.note !== undefined,
    { message: "At least one Practice state field is required" }
  );

export async function PUT(request: NextRequest) {
  const startedAt = Date.now();
  let ownerId: string | null = null;
  let sessionKey: string | null = null;
  let questionId: string | null = null;
  let retryCount = 0;
  let changedFields: string[] = [];
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const app = getAppContainer();
    if (!app.config.practiceNonDsaEnabled) {
      throw new ApiRouteError(404, "PRACTICE_DISABLED", "Practice workspace not found");
    }
    ownerId = authenticatedOwnerId(userId);
    const profile = await app.profileService.get(ownerId);
    if (!profile.onboardingCompletedAt) {
      throw new ApiRouteError(409, "ONBOARDING_REQUIRED", "Finish onboarding first.");
    }
    const parsed = stateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Practice state validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }
    sessionKey = parsed.data.sessionKey;
    questionId = parsed.data.questionId;
    retryCount = parsed.data.retryCount;
    changedFields = stateFields(parsed.data);
    await getSharedGuard(app.config).enforce(RATE_LIMIT_POLICIES.practiceState, ownerId);
    const state = {
      sessionKey: parsed.data.sessionKey,
      questionId: parsed.data.questionId,
      draftAnswer: parsed.data.draftAnswer,
      revealedHintCount: parsed.data.revealedHintCount,
      note: parsed.data.note
    };
    const result = await app.prepPracticeService.saveState(ownerId, state);
    practiceTelemetry.stateSaveSucceeded({
      ownerId,
      sessionKey,
      questionId,
      changedFields,
      retryCount,
      durationMs: Date.now() - startedAt
    });
    return apiSuccess(result);
  } catch (error) {
    practiceTelemetry.stateSaveFailed({
      ownerId,
      sessionKey,
      questionId,
      changedFields,
      retryCount,
      durationMs: Date.now() - startedAt,
      error
    });
    return apiError(error, request.nextUrl.pathname);
  }
}

function stateFields(value: z.infer<typeof stateSchema>): string[] {
  return (["draftAnswer", "revealedHintCount", "note"] as const).filter(
    (field) => value[field] !== undefined
  );
}
