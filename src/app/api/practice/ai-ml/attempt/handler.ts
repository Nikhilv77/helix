import type { NextRequest } from "next/server";
import { interactivePracticeAttemptInputSchema } from "@/features/practice/shared/domain/story-practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  getSharedGuard,
  RATE_LIMIT_POLICIES,
  type SharedLease
} from "@/server/rate-limit/shared-guard";
import { aiMlStoryOwner, parseAiMlStoryJson } from "../_shared";

export async function POST(request: NextRequest) {
  let lease: SharedLease | undefined;
  try {
    const { ownerId, app } = await aiMlStoryOwner(RATE_LIMIT_POLICIES.answerEvaluation);
    const input = await parseAiMlStoryJson(request, interactivePracticeAttemptInputSchema);
    lease = await getSharedGuard(app.config).acquire(
      {
        namespace: "ai-ml-story-attempt",
        ttlMs: 60_000,
        code: "AI_ML_ATTEMPT_IN_PROGRESS",
        message: "An answer is already being evaluated for this question."
      },
      `${ownerId}:${input.questionId}`
    );
    return apiSuccess(await app.aiMlStoryPracticeService.submitAttempt(ownerId, input));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  } finally {
    await lease?.release();
  }
}
