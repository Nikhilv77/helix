import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { BASELINE_SECTIONS, PREPARATION_ONBOARDING_STAGES } from "@/lib/preparation/preparation-onboarding";
import { LEVELS, ROLES } from "@/server/interview/types";
import { publicPreparationOnboardingState } from "@/server/preparation/preparation-onboarding-state";

export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("advance-target"),
    targetRole: z.enum(ROLES),
    level: z.enum(LEVELS),
    targetCompany: z.string().trim().max(100),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    nextStage: z.enum(PREPARATION_ONBOARDING_STAGES)
  }),
  z.object({ action: z.literal("start-baseline") }),
  z.object({
    action: z.literal("submit-baseline"),
    section: z.enum(BASELINE_SECTIONS),
    choiceId: z.string().trim().min(1).max(80)
  })
]);

export async function GET(request: NextRequest) {
  try {
    const ownerId = await owner();
    const state = await getAppContainer().preparationOnboardingService.state(ownerId);
    return apiSuccess({ state: publicPreparationOnboardingState(state) });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await owner();
    const body = requestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new ApiRouteError(
        400,
        "PREPARATION_ONBOARDING_INVALID",
        "That preparation step could not be saved.",
        { messages: body.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }
      );
    }

    const service = getAppContainer().preparationOnboardingService;
    if (body.data.action === "advance-target") {
      const state = await service.advanceTarget(ownerId, body.data);
      return apiSuccess({ state: publicPreparationOnboardingState(state), planReady: false });
    }
    if (body.data.action === "start-baseline") {
      const state = await service.startBaseline(ownerId);
      return apiSuccess({ state: publicPreparationOnboardingState(state), planReady: false });
    }

    const state = await service.submitBaselineAnswer(ownerId, body.data);
    // The baseline is durable before planning starts. A later page request can
    // still build a plan if this non-critical eager generation ever fails.
    const planReady = state.completedAt
      ? await getAppContainer()
          .personalizedInterviewPlanningService.activePlan(ownerId)
          .then(() => true)
          .catch(() => false)
      : false;
    return apiSuccess({ state: publicPreparationOnboardingState(state), planReady });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function owner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}
