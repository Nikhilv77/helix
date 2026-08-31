import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  slug: z.string().trim().min(1).max(140),
  code: z.string().trim().min(1).max(20_000),
  language: z.enum(["javascript", "python", "cpp", "java"]),
  testsPassed: z.number().int().min(0).max(100),
  testCount: z.number().int().min(1).max(100),
  teacherId: z.string().trim().min(1).max(40).nullable().optional()
});

const cachedFeedbackSchema = z.object({
  headline: z.string().trim().min(1).max(96),
  markdown: z.string().trim().min(1).max(2_000),
  voiceScript: z.string().trim().min(1).max(900),
  followUp: z.string().trim().min(1).max(240)
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Feedback request is invalid", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }
    if (parsed.data.testsPassed !== parsed.data.testCount) {
      throw new ApiRouteError(422, "SOLUTION_NOT_ACCEPTED", "Run a passing solution before asking for feedback.");
    }

    const found = findQuestion(parsed.data.slug);
    if (!found) throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found");

    const app = getAppContainer();
    const ownerId = authenticatedOwnerId(userId);
    const guard = getSharedGuard(app.config);
    // Same question + code gets the same short debrief. This keeps repeated
    // Run presses from silently becoming repeated model calls.
    const cacheIdentity = `${ownerId}:${parsed.data.teacherId ?? "maya"}:${parsed.data.slug}:${parsed.data.language}:${createHash("sha256")
      .update(parsed.data.code)
      .digest("hex")}`;
    const cached = cachedFeedbackSchema.safeParse(
      await guard.getCached("dsa-practice-feedback", cacheIdentity)
    );
    if (cached.success) return apiSuccess(cached.data);

    await guard.enforce(RATE_LIMIT_POLICIES.answerEvaluation, ownerId);
    const feedback = await app.dsaPracticeFeedbackService.review(found.question, parsed.data);
    await guard
      .setCached("dsa-practice-feedback", cacheIdentity, feedback, 30 * 24 * 60 * 60_000)
      .catch((cacheError) => console.error("[dsa-feedback] Could not cache feedback", cacheError));
    return apiSuccess(feedback);
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}
