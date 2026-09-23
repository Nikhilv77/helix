import type { NextRequest } from "next/server";
import {
  TECHNICAL_DEEP_DIVE_ID,
  TECHNICAL_PROJECTS_DURATION_MINUTES,
  TECHNICAL_PROJECTS_QUESTION_COUNT,
  TECHNICAL_PROJECTS_TITLE
} from "@/features/interviews/domain/technical-deep-dive";
import {
  buildTechnicalProjectsPlan,
  selectGroundedProjectSource,
  selectTechnicalProjectMcqs
} from "@/features/interviews/server/technical-projects-round";
import {
  attachInterviewOwnerCookie,
  resolveInterviewOwner
} from "@/features/interviews/server/owner";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    const { ownerId } = owner;
    if (!ownerId.startsWith("user:")) {
      throw new ApiRouteError(
        401,
        "AUTH_REQUIRED",
        "Sign in to start your Core Technical & Projects interview."
      );
    }

    const existing = await app.interviewService.findOwnedActiveByTemplate(
      ownerId,
      TECHNICAL_DEEP_DIVE_ID
    );
    if (existing) return activeResponse(existing, owner, app.config);

    const guard = getSharedGuard(app.config);
    const lease = await guard.acquire(
      {
        namespace: "interview-create",
        ttlMs: 65_000,
        code: "INTERVIEW_CREATION_IN_PROGRESS",
        message: "An interview is already being prepared for you."
      },
      ownerId
    );

    try {
      const active = await app.interviewService.findOwnedActiveByTemplate(
        ownerId,
        TECHNICAL_DEEP_DIVE_ID
      );
      if (active) return activeResponse(active, owner, app.config);

      await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, ownerId);
      const [profile, activePlan] = await Promise.all([
        app.profileService.get(ownerId),
        app.personalizedInterviewPlanningService.activePlan(ownerId)
      ]);
      const coreBlueprint = activePlan.sessions.find(
        (session) => session.kind === "core-technical"
      );
      const appliedBlueprint = activePlan.sessions.find(
        (session) => session.kind === "applied-engineering"
      );
      if (!coreBlueprint || !appliedBlueprint) {
        throw new ApiRouteError(
          409,
          "TECHNICAL_PROJECTS_NOT_READY",
          "Your Core Technical and Applied Engineering interview path is not ready yet."
        );
      }

      const resume = profile.resume;
      const kit = resume
        ? await app.resumeInterviewKitService.ensure({
            ownerId,
            resume,
            targetRole: profile.targetRole ?? "frontend",
            level: profile.level ?? "0-2"
          })
        : null;
      const mcqs = selectTechnicalProjectMcqs({
        kit,
        coreBlueprint,
        level: profile.level,
        targetRole: profile.targetRole
      });
      const project = selectGroundedProjectSource({ profile, coreBlueprint, appliedBlueprint });
      const plan = buildTechnicalProjectsPlan({
        coreBlueprint,
        appliedBlueprint,
        mcqs,
        project,
        codingTask: kit?.codingTask,
        targetRole: profile.targetRole
      });
      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "frontend",
          level: profile.level ?? "0-2",
          roundType: "technical",
          intensity: "realistic",
          context: [
            "This is a Core Technical & Projects interview with three technical checks followed by one grounded project deep dive.",
            `Project source: ${project.name}.`,
            profile.context
          ]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 1_200),
          agenda: [
            "Three mechanism-level technical decisions",
            "Project context and personal ownership",
            "End-to-end technical mechanism",
            "Failure diagnosis and verification",
            "One project-grounded coding task"
          ],
          templateId: TECHNICAL_DEEP_DIVE_ID,
          templateTitle: TECHNICAL_PROJECTS_TITLE,
          durationMinutes: TECHNICAL_PROJECTS_DURATION_MINUTES,
          personalizedPlanId: activePlan.id,
          personalizedBlueprint: coreBlueprint,
          technicalDeepDive: {
            kind: TECHNICAL_DEEP_DIVE_ID,
            version: 3,
            coreBlueprintId: coreBlueprint.id,
            appliedBlueprintId: appliedBlueprint.id,
            project: {
              sourceKind: project.sourceKind,
              sourceId: project.sourceId,
              name: project.name,
              roleLabel: project.roleLabel
            }
          },
          questionCount: TECHNICAL_PROJECTS_QUESTION_COUNT
        },
        ownerId,
        Date.now(),
        plan
      );

      return attachInterviewOwnerCookie(
        apiSuccess({
          sessionId: result.state.id,
          questionCount: result.state.plan.length,
          utterance: result.utterance
        }),
        owner,
        app.config
      );
    } finally {
      await lease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function activeResponse(
  state: {
    id: string;
    plan: unknown[];
    turns: Array<{ speaker: string; action?: string; text: string }>;
  },
  owner: Awaited<ReturnType<typeof resolveInterviewOwner>>,
  config: ReturnType<typeof getAppContainer>["config"]
) {
  return attachInterviewOwnerCookie(
    apiSuccess({
      sessionId: state.id,
      questionCount: state.plan.length,
      utterance: state.turns.find((turn) => turn.speaker === "agent" && turn.action === "intro")
        ?.text
    }),
    owner,
    config
  );
}
