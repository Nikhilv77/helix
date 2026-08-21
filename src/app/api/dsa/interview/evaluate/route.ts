import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const submissionSchema = z.object({
  slug: z.string().trim().min(1).max(140),
  approach: z.string().trim().min(10).max(4_000),
  code: z.string().trim().min(10).max(20_000),
  timeComplexity: z.string().trim().min(1).max(80),
  spaceComplexity: z.string().trim().min(1).max(80),
  hintsUsed: z.number().int().min(0).max(10)
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = submissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Submission validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const found = findQuestion(parsed.data.slug);
    if (!found) throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found");

    const evaluation = await getAppContainer().dsaInterviewEvaluator.evaluate(
      found.question,
      parsed.data
    );
    return apiSuccess(evaluation);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
