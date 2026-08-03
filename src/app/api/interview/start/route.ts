import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { resolveOwnerId } from "@/server/interview/owner";
import { INTENSITIES, LEVELS, ROLES, ROUND_TYPES } from "@/server/interview/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const setupSchema = z.object({
  role: z.enum(ROLES),
  level: z.enum(LEVELS),
  roundType: z.enum(ROUND_TYPES),
  intensity: z.enum(INTENSITIES),
  context: z.string().trim().min(10, "Tell me a little about what you've worked on").max(1200),
  agenda: z.array(z.string().trim().min(3).max(200)).max(6).optional(),
  templateId: z.string().trim().max(60).optional(),
  templateTitle: z.string().trim().max(80).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    const ownerId = await resolveOwnerId(request, app.config);
    const { state, utterance } = await app.interviewService.start(parsed.data, ownerId);

    return apiSuccess({
      sessionId: state.id,
      phase: state.phase,
      questionCount: state.plan.length,
      questionIndex: state.questionIndex,
      startedAt: state.startedAt,
      utterance
    });
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
