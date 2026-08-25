import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { resolveOwnerId } from "@/server/interview/owner";
import {
  INTENSITIES,
  LEVELS,
  ROLES,
  ROUND_TYPES,
  type InterviewSetup,
  type Role
} from "@/server/interview/types";
import type { RoleFamily, SessionBlueprint } from "@/lib/interviews/personalized-plan";

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
  templateTitle: z.string().trim().max(80).optional(),
  planId: z.string().uuid().optional(),
  blueprintId: z.string().uuid().optional(),
  questionCount: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional()
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
    const { blueprintId, planId, ...requestedSetup } = parsed.data;
    if (blueprintId && !ownerId.startsWith("user:")) {
      throw new ApiRouteError(
        401,
        "AUTH_REQUIRED",
        "Sign in to launch a personalized interview session."
      );
    }
    if (planId && !blueprintId) {
      throw new ApiRouteError(
        400,
        "BLUEPRINT_REQUIRED",
        "A plan ID can only be used with an interview blueprint."
      );
    }

    let setup: InterviewSetup = requestedSetup;
    if (blueprintId) {
      const selection = await app.personalizedInterviewPlanningService.blueprint(
        ownerId,
        blueprintId,
        planId
      );
      setup = blueprintSetup(
        requestedSetup,
        selection.plan.id,
        selection.blueprint,
        selection.plan.sourceSnapshot.targetRole.family
      );
    }
    const { state, utterance } = await app.interviewService.start(setup, ownerId);

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

function blueprintSetup(
  requested: InterviewSetup,
  planId: string,
  blueprint: SessionBlueprint,
  roleFamily: RoleFamily
): InterviewSetup {
  return {
    ...requested,
    role: interviewRole(roleFamily),
    roundType: roleFamily === "product" ? "hiring-manager" : "technical",
    agenda: blueprintAgenda(blueprint),
    templateId: blueprint.id,
    templateTitle: blueprint.title,
    durationMinutes: blueprint.durationMinutes,
    personalizedPlanId: planId,
    personalizedBlueprint: blueprint,
    questionCount: blueprintQuestionCount(blueprint)
  };
}

function blueprintQuestionCount(
  blueprint: SessionBlueprint
): Exclude<InterviewSetup["questionCount"], undefined> {
  const requested = blueprint.structure.reduce((total, stage) => total + stage.questionCount, 0);
  return Math.max(3, Math.min(8, requested)) as Exclude<InterviewSetup["questionCount"], undefined>;
}

function blueprintAgenda(blueprint: SessionBlueprint): string[] {
  return [
    `Session goal: ${blueprint.rationale}`,
    ...blueprint.topics.map(
      (topic) => `${topic.label}: ${topic.objectives[0] ?? "Test practical depth and trade-offs"}`
    )
  ].map((item) => item.slice(0, 200));
}

function interviewRole(family: RoleFamily): Role {
  if (family === "frontend" || family === "backend" || family === "fullstack") return family;
  if (family === "data" || family === "ai-ml") return family;
  if (family === "product") return "pm";
  if (family === "mobile") return "frontend";
  return "backend";
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
