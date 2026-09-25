import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authorizeInterviewSession } from "@/features/interviews/server/session-access";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { refreshPracticeHome } from "@/features/practice/shared/server/refresh-practice-home";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const skipSchema = z.object({
  sessionId: z.string().uuid(),
  turnId: z.string().uuid(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative()
});

/** Records an explicit zero for the active transfer-code prompt and advances once. */
export async function POST(request: NextRequest) {
  try {
    const parsed = skipSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    const access = await authorizeInterviewSession(
      request,
      app.config,
      parsed.data.sessionId,
      "answer"
    );
    if (access.kind !== "owner") {
      throw new ApiRouteError(
        403,
        "ASSESSMENT_SKIP_FORBIDDEN",
        "Only the assessment candidate can skip a coding problem."
      );
    }

    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.answerEvaluation, parsed.data.sessionId);
    const result = await app.interviewService.skipBlockAssessmentCodeOwned(
      access.ownerId,
      parsed.data.sessionId,
      { startMs: parsed.data.startMs, endMs: parsed.data.endMs },
      Date.now(),
      parsed.data.turnId
    );

    if (result.response.phase === "done") {
      after(async () => {
        await Promise.allSettled([
          app.dsaBlockAssessmentFinalizationService.finalizeOwned(
            access.ownerId,
            parsed.data.sessionId
          ),
          app.coreTechnicalAssessmentService.finalizeInterviewOwned(
            access.ownerId,
            parsed.data.sessionId
          )
        ]);
        if (access.ownerId.startsWith("user:")) await refreshPracticeHome(access.ownerId);
      });
    }
    return apiSuccess(result.response);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
