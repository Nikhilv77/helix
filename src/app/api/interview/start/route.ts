import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { attachInterviewOwnerCookie, resolveInterviewOwner } from "@/features/interviews/server/owner";
import {
  INTENSITIES,
  LEVELS,
  ROLES,
  ROUND_TYPES,
  type InterviewSetup,
  type Role
} from "@/features/interviews/server/types";
import type { RoleFamily, SessionBlueprint } from "@/features/interviews/domain/personalized-plan";
import { TECHNICAL_DEEP_DIVE_ID } from "@/features/interviews/domain/technical-deep-dive";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import {
  buildTechnicalDeepDiveBlueprint,
  technicalDeepDiveQuestionSources
} from "@/features/interviews/server/technical-deep-dive";

export const dynamic = "force-dynamic";

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
  technicalDeepDive: z
    .object({
      kind: z.literal(TECHNICAL_DEEP_DIVE_ID),
      coreBlueprintId: z.string().uuid(),
      appliedBlueprintId: z.string().uuid()
    })
    .strict()
    .optional(),
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
    const owner = await resolveInterviewOwner(request, app.config);
    const { ownerId } = owner;
    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, ownerId);
    const creationLease = await guard.acquire(
      {
        namespace: "interview-create",
        ttlMs: 65_000,
        code: "INTERVIEW_CREATION_IN_PROGRESS",
        message: "An interview is already being prepared for you."
      },
      ownerId
    );

    try {
      const { blueprintId, planId, technicalDeepDive, ...requestedSetup } = parsed.data;
      if ((blueprintId || technicalDeepDive) && !ownerId.startsWith("user:")) {
        throw new ApiRouteError(
          401,
          "AUTH_REQUIRED",
          "Sign in to launch a personalized interview session."
        );
      }
      if (blueprintId && technicalDeepDive) {
        throw new ApiRouteError(
          400,
          "BLUEPRINT_SELECTION_CONFLICT",
          "Choose either one interview blueprint or the Technical Deep Dive."
        );
      }
      if (planId && !blueprintId && !technicalDeepDive) {
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
      if (technicalDeepDive) {
        const selection =
          await app.personalizedInterviewPlanningService.technicalDeepDiveBlueprints(
            ownerId,
            technicalDeepDive.coreBlueprintId,
            technicalDeepDive.appliedBlueprintId,
            planId
          );
        const combinedBlueprint = buildTechnicalDeepDiveBlueprint(
          selection.coreBlueprint,
          selection.appliedBlueprint
        );
        setup = blueprintSetup(
          requestedSetup,
          selection.plan.id,
          combinedBlueprint,
          selection.plan.sourceSnapshot.targetRole.family,
          {
            kind: TECHNICAL_DEEP_DIVE_ID,
            coreBlueprintId: selection.coreBlueprint.id,
            appliedBlueprintId: selection.appliedBlueprint.id,
            questionSources: technicalDeepDiveQuestionSources(
              selection.coreBlueprint,
              selection.appliedBlueprint
            )
          }
        );
      }
      const { state, utterance } = await app.interviewService.start(setup, ownerId);

      return attachInterviewOwnerCookie(
        apiSuccess({
          sessionId: state.id,
          phase: state.phase,
          questionCount: state.plan.length,
          questionIndex: state.questionIndex,
          startedAt: state.startedAt,
          utterance
        }),
        owner,
        app.config
      );
    } finally {
      await creationLease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function blueprintSetup(
  requested: InterviewSetup,
  planId: string,
  blueprint: SessionBlueprint,
  roleFamily: RoleFamily,
  technicalDeepDive?: InterviewSetup["technicalDeepDive"]
): InterviewSetup {
  return {
    ...requested,
    role: interviewRole(roleFamily),
    roundType: roleFamily === "product" ? "hiring-manager" : "technical",
    agenda: blueprintAgenda(blueprint),
    templateId: technicalDeepDive ? TECHNICAL_DEEP_DIVE_ID : blueprint.id,
    templateTitle: blueprint.title,
    durationMinutes: blueprint.durationMinutes,
    personalizedPlanId: planId,
    personalizedBlueprint: blueprint,
    ...(technicalDeepDive ? { technicalDeepDive } : {}),
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
