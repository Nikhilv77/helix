import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import {
  BASELINE_SECTIONS,
  PREPARATION_ONBOARDING_STAGES
} from "@/features/preparation-onboarding/domain/preparation-onboarding";
import { LEVELS, ROLES } from "@/features/interviews/server/types";
import { publicPreparationOnboardingState } from "@/features/preparation-onboarding/server/preparation-onboarding-state";
import { Logger } from "@/server/common/logger";

export const dynamic = "force-dynamic";

const logger = new Logger("PreparationOnboarding");

const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("advance-target"),
      targetRole: z.enum(ROLES),
      level: z.enum(LEVELS),
      targetCompany: z.string().trim().max(100),
      targetDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      nextStage: z.enum(PREPARATION_ONBOARDING_STAGES)
    })
    .strict(),
  z.object({ action: z.literal("start-baseline") }).strict(),
  z
    .object({
      action: z.literal("submit-baseline"),
      section: z.enum(BASELINE_SECTIONS),
      choiceId: z.string().trim().min(1).max(80)
    })
    .strict()
]);

export async function GET(request: NextRequest) {
  try {
    const ownerId = await owner();
    const state = await getAppContainer().preparationOnboardingService.state(ownerId);
    return noStore(apiSuccess({ state: publicPreparationOnboardingState(state) }));
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

    const app = getAppContainer();
    const service = app.preparationOnboardingService;
    if (body.data.action === "advance-target") {
      const state = await service.advanceTarget(ownerId, body.data);
      return noStore(
        apiSuccess({ state: publicPreparationOnboardingState(state), planReady: false })
      );
    }
    if (body.data.action === "start-baseline") {
      const state = await service.startBaseline(ownerId);
      return noStore(
        apiSuccess({ state: publicPreparationOnboardingState(state), planReady: false })
      );
    }

    const state = await service.submitBaselineAnswer(ownerId, body.data);
    // The baseline is durable before planning starts. A later page request can
    // still build a plan if this non-critical eager generation ever fails.
    if (state.completedAt) {
      // The answer is already durable. Plan generation performs several reads
      // and can call an AI provider, so it must not hold the final UI response.
      after(async () => {
        try {
          await app.personalizedInterviewPlanningService.activePlan(ownerId);
        } catch (error) {
          logger.error(
            JSON.stringify({
              event: "preparation.plan.failed",
              ownerId,
              reason: error instanceof Error ? error.message : String(error)
            }),
            error
          );
        }
      });
    }
    return noStore(
      apiSuccess({ state: publicPreparationOnboardingState(state), planReady: false })
    );
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function noStore(response: Response): Response {
  response.headers.set("cache-control", "no-store");
  return response;
}

async function owner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");
  return authenticatedOwnerId(userId);
}
