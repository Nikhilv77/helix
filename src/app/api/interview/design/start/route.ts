import type { NextRequest } from "next/server";
import { practisedArchitectureScenarioKeys } from "@/features/interviews/server/practised-content";
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
import {
  ARCHITECTURE_DESIGN_CONTENT_CANDIDATES,
  ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS
} from "@/features/practice/architecture-design/domain/content-candidates";
import { systemDesignSupportsRole } from "@/features/interviews/domain/dsa-design-round";
import {
  architectureDesignTrackForRole,
  type ArchitectureDesignTrack
} from "@/features/practice/architecture-design/domain/contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";

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
      const [profile, history, practisedScenarioKeys] = await Promise.all([
        app.profileService.get(ownerId),
        app.interviewService.history(ownerId, 50).catch(() => []),
        practisedArchitectureScenarioKeys(ownerId)
      ]);
      if (!systemDesignSupportsRole(profile.targetRole)) {
        throw new ConflictErrorException(
          "SYSTEM_DESIGN_ROLE_UNSUPPORTED",
          "System Design is not available for your role yet."
        );
      }
      if (profile.targetRole === "ai-ml") {
        const eligibility = await app.architectureDesign.eligibility.forProfile(profile);
        if (!eligibility.available) {
          throw new ConflictErrorException(
            "AI_ML_DESIGN_CONTENT_UNAVAILABLE",
            "AI/ML System Design scenarios are not published in this environment yet."
          );
        }
      }
      // Prefer, in order: an interview-only scenario the learner has not met;
      // any scenario not practised (with its reference answers) and not met in
      // an interview; any scenario not met in an interview; then anything.
      const interviewScenarioKeys = history
        .filter((item) => item.status === "completed")
        .map((item) => item.setup.dsaDesignRound?.designScenarioKey)
        .filter((key): key is string => Boolean(key));
      const unseenScenarioKeys = [...interviewScenarioKeys, ...practisedScenarioKeys];
      const practicePathKeys = ARCHITECTURE_DESIGN_CONTENT_CANDIDATES.map(
        (candidate) => candidate.scenario.key
      ).filter((key) => !ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS.has(key));
      const focus = await app.architectureDesign.focus.confirm(ownerId, {
        path: "role-aligned"
      });
      const selection = rankDsaDesignScenarioWithFallback(
        app.architectureDesign.interviewRanking,
        focus,
        [...unseenScenarioKeys, ...practicePathKeys],
        unseenScenarioKeys,
        interviewScenarioKeys
      );
      const artifact = ARCHITECTURE_DESIGN_CONTENT_CANDIDATES.find(
        (candidate) => candidate.scenario.key === selection.selectedScenario.scenarioKey
      );
      if (!artifact || artifact.humanReview.status !== "approved") {
        throw new Error("Selected System Design scenario is unavailable");
      }
      const role = profile.targetRole ?? "";
      if (!(artifact.scenario.roles as readonly string[]).includes(role)) {
        throw new ConflictErrorException(
          "DESIGN_SCENARIO_ROLE_MISMATCH",
          "That design scenario does not belong to your role's path."
        );
      }

      const framing = DESIGN_FRAMING[architectureDesignTrackForRole(role)];
      const plan = buildSystemDesignPlan({ designArtifact: artifact, role });
      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "backend",
          level: profile.level ?? "0-2",
          roundType: "technical",
          intensity: "realistic",
          context: `${framing.context} Scenario: ${artifact.scenario.title}.`,
          agenda: [...framing.agenda],
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

/** How each kind of System Design round is introduced and paced. */
const DESIGN_FRAMING: Record<
  ArchitectureDesignTrack,
  { context: string; agenda: readonly string[] }
> = {
  server: {
    context: "This is a dedicated candidate-led System Design interview.",
    agenda: [
      "Discover requirements and scale",
      "Build the architecture",
      "Deep-dive one boundary",
      "Pressure-test changing constraints",
      "Defend trade-offs and risks"
    ]
  },
  frontend: {
    context:
      "This is a dedicated candidate-led frontend System Design interview: the browser client is the system under design.",
    agenda: [
      "Discover users, devices, and performance goals",
      "Sketch the client architecture",
      "Deep-dive one component's state and data flow",
      "Pressure-test changing conditions",
      "Defend trade-offs, performance, and rollout"
    ]
  },
  data: {
    context:
      "This is a dedicated candidate-led data System Design interview: the pipeline and its tables are the system under design.",
    agenda: [
      "Discover consumers, volume, and freshness goals",
      "Sketch the pipeline and table design",
      "Deep-dive one stage's state and idempotency",
      "Pressure-test changing volume and data",
      "Defend quality, cost, and migration"
    ]
  }
};
