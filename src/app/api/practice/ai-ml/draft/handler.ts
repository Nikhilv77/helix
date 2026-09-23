import type { NextRequest } from "next/server";
import { interactivePracticeSaveDraftInputSchema } from "@/features/practice/shared/domain/story-practice-contracts";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { aiMlStoryOwner, parseAiMlStoryJson } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const { ownerId, app } = await aiMlStoryOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseAiMlStoryJson(request, interactivePracticeSaveDraftInputSchema);
    return apiSuccess({ question: await app.aiMlStoryPracticeService.saveDraft(ownerId, input) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
