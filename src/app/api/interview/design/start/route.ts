import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  attachInterviewOwnerCookie,
  resolveInterviewOwner
} from "@/features/interviews/server/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import {
  buildSystemDesignPlan,
  rankDsaDesignScenarioWithFallback
} from "@/features/interviews/server/dsa-design-round";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    const { ownerId } = owner;
    const guard = getSharedGuard(app.config);
    const existing = await app.interviewService.findOwnedActiveByTemplate(ownerId, "system-design");
    if (existing) return activeResponse(existing, owner, app.config);

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
      const active = await app.interviewService.findOwnedActiveByTemplate(ownerId, "system-design");
      if (active) return activeResponse(active, owner, app.config);

      await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, ownerId);
      const [profile, history] = await Promise.all([
        app.profileService.get(ownerId),
        app.interviewService.history(ownerId, 50).catch(() => [])
      ]);
      const recentScenarioKeys = history
        .filter((item) => item.status === "completed")
        .map((item) => item.setup.dsaDesignRound?.designScenarioKey)
        .filter((key): key is string => Boolean(key));
      const focus = await app.architectureDesign.focus.confirm(ownerId, {
        path: "role-aligned"
      });
      const selection = rankDsaDesignScenarioWithFallback(
        app.architectureDesign.ranking,
        focus,
        recentScenarioKeys
      );
      const artifact = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
        (candidate) => candidate.scenario.key === selection.selectedScenario.scenarioKey
      );
      if (!artifact) throw new Error("Selected System Design scenario is unavailable");

      const plan = buildSystemDesignPlan({ designArtifact: artifact });
      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "backend",
          level: profile.level ?? "0-2",
          roundType: "technical",
          intensity: "realistic",
          context: `This is a dedicated candidate-led System Design interview. Scenario: ${artifact.scenario.title}.`,
          agenda: [
            "Discover requirements and scale",
            "Build the architecture",
            "Deep-dive one boundary",
            "Pressure-test changing constraints",
            "Defend trade-offs and risks"
          ],
          templateId: "system-design",
          templateTitle: "System Design Interview",
          durationMinutes: 45,
          questionCount: 5,
          dsaDesignRound: {
            kind: "dsa-design-round",
            version: 1,
            designScenarioKey: artifact.scenario.key,
            designScenarioVersion: selection.selectedScenario.scenarioVersion,
            designScenarioTitle: artifact.scenario.title,
            designDifficulty: selection.selectedScenario.difficulty
          }
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
      await creationLease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function activeResponse(
  active: {
    id: string;
    plan: unknown[];
    turns: Array<{ speaker: string; action?: string; text: string }>;
  },
  owner: Awaited<ReturnType<typeof resolveInterviewOwner>>,
  config: ReturnType<typeof getAppContainer>["config"]
) {
  return attachInterviewOwnerCookie(
    apiSuccess({
      sessionId: active.id,
      questionCount: active.plan.length,
      utterance: active.turns.find((turn) => turn.speaker === "agent" && turn.action === "intro")
        ?.text
    }),
    owner,
    config
  );
}
