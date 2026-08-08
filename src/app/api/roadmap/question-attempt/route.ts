import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

const attemptSchema = z.object({
  action: z.enum(["open", "submit", "complete", "skip"]),
  dsaQuestionSlug: z.string().trim().min(1).max(140),
  answer: z.string().trim().max(10_000).optional(),
  score: z.number().min(0).max(1).optional(),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000)
    .optional()
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = attemptSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Question attempt validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    // The page revalidates itself after a successful write, so it does not need
    // the roadmap echoed back — skipping that read is a third of the response
    // time on every "mark complete" click.
    const result = await getAppContainer().frontendRoadmapService.recordQuestionAttempt(
      authenticatedOwnerId(userId),
      parsed.data,
      { includeHome: false }
    );
    if (!result.recorded) {
      throw new ApiRouteError(409, "FRONTEND_ROADMAP_REQUIRED", "Frontend roadmap is not active.");
    }

    return apiSuccess({ recorded: true });
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
