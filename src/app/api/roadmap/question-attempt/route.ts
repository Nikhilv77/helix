import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { requireCompletedPreparationOnboardingState } from "@/server/auth/preparation-onboarding-api-guard";
import { schedulePracticeHomeRefresh } from "@/features/practice/shared/server/refresh-practice-home";
import { invalidateDsaPage } from "@/features/practice/dsa/server/cached-dsa-page";
import { timeAction } from "@/server/http/action-timing";

export const dynamic = "force-dynamic";

const attemptSchema = z.object({
  requestId: z.string().uuid(),
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
  // Name the timing by attempt kind; open, complete, and skip cost differently.
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { action?: unknown } | null;
  const kind = typeof body?.action === "string" ? body.action : "unknown";
  return timeAction(`dsa.question-attempt.${kind}`, () => handlePost(request));
}

async function handlePost(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
    const ownerId = authenticatedOwnerId(userId);
    const state = await getAppContainer().profileService.workspaceShellState(ownerId);
    requireCompletedPreparationOnboardingState(state);

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
      ownerId,
      { ...parsed.data, idempotencyKey: parsed.data.requestId },
      { includeHome: false }
    );
    if (!result.recorded) {
      throw new ApiRouteError(409, "ROADMAP_REQUIRED", "Roadmap is not active.");
    }

    if (parsed.data.action !== "open") invalidateDsaPage(ownerId);

    // An open is an activity write, not a completed practice outcome. The
    // source-table trigger still marks summaries dirty for the next reader;
    // rebuilding them now would compete with the question the user is opening.
    if (parsed.data.action !== "open") schedulePracticeHomeRefresh(ownerId);
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
