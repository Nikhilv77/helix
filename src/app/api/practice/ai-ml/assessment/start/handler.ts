import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { aiMlStoryOwner, parseAiMlStoryJson } from "../../_shared";
import { storyAssessmentStartInputSchema } from "../_schemas";

/** Starts or resumes the assessment room for one finished story path. */
export async function POST(request: NextRequest) {
  try {
    const { ownerId, app, discipline } = await aiMlStoryOwner(RATE_LIMIT_POLICIES.practiceState);
    const input = await parseAiMlStoryJson(request, storyAssessmentStartInputSchema);
    return apiSuccess(await app.storyAssessmentService.startOrResume(ownerId, { discipline, ...input }));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
