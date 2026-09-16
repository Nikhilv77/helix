import type { NextRequest } from "next/server";
import { findQuestion } from "@/features/practice/dsa/domain/dsa";
import { OPERATION_DSA_SLUGS } from "@/features/practice/dsa/domain/dsa-code-templates";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  attachInterviewOwnerCookie,
  resolveInterviewOwner
} from "@/features/interviews/server/owner";
import { selectDsaInterviewQuestions } from "@/features/interviews/server/dsa-session-selection";
import {
  buildDsaDesignPlan,
  rankDsaDesignScenarioWithFallback
} from "@/features/interviews/server/dsa-design-round";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import type { PlannedQuestion } from "@/features/interviews/server/types";

export const dynamic = "force-dynamic";

const MIN_SOLVED = 10;
const QUESTION_COUNT = 3 as const;
const IMPORTANT_FUNCTION_QUESTION_SLUGS = [
  "two-sum",
  "longest-substring-without-repeating-characters",
  "3sum",
  "merge-intervals",
  "binary-search",
  "valid-parentheses",
  "reverse-linked-list",
  "maximum-depth-of-binary-tree",
  "number-of-islands",
  "course-schedule",
  "maximum-subarray",
  "coin-change",
  "longest-common-subsequence"
];

export async function POST(request: NextRequest) {
  try {
    const app = getAppContainer();
    const owner = await resolveInterviewOwner(request, app.config);
    const { ownerId } = owner;
    const guard = getSharedGuard(app.config);
    const existing = await app.interviewService.findOwnedActiveByTemplate(ownerId, "dsa");
    if (existing) {
      return attachInterviewOwnerCookie(
        apiSuccess({
          sessionId: existing.id,
          questionCount: existing.plan.length,
          utterance: existing.turns.find(
            (turn) => turn.speaker === "agent" && turn.action === "intro"
          )?.text
        }),
        owner,
        app.config
      );
    }
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
      const active = await app.interviewService.findOwnedActiveByTemplate(ownerId, "dsa");
      if (active) {
        return attachInterviewOwnerCookie(
          apiSuccess({
            sessionId: active.id,
            questionCount: active.plan.length,
            utterance: active.turns.find(
              (turn) => turn.speaker === "agent" && turn.action === "intro"
            )?.text
          }),
          owner,
          app.config
        );
      }
      await guard.enforce(RATE_LIMIT_POLICIES.interviewCreation, ownerId);
      const [profile, completed, performance, history] = await Promise.all([
        app.profileService.get(ownerId),
        app.frontendRoadmapService.completedDsaQuestions(ownerId),
        app.personalizedPerformanceStore.refresh(ownerId),
        app.interviewService.history(ownerId, 50).catch(() => [])
      ]);
      // The gate counts what the round can actually draw on. Design problems are
      // solved in the workspace but never asked in a spoken round, so counting
      // them would let a candidate through to an interview of unseen problems.
      const solvedFunctionQuestions = completed.filter(
        (item) => !OPERATION_DSA_SLUGS.has(item.slug)
      );

      if (solvedFunctionQuestions.length < MIN_SOLVED) {
        throw new ApiRouteError(
          409,
          "DSA_INTERVIEW_NOT_READY",
          `Solve at least ${MIN_SOLVED} DSA practice questions before starting an interview.`,
          { completed: solvedFunctionQuestions.length, required: MIN_SOLVED }
        );
      }

      const fallbackQuestions = IMPORTANT_FUNCTION_QUESTION_SLUGS.map(
        (slug) => findQuestion(slug)?.question
      )
        .filter((question): question is NonNullable<typeof question> => Boolean(question))
        .filter((question) => !solvedFunctionQuestions.some((item) => item.slug === question.slug));
      // Problems the candidate has actually solved come first. The curated list
      // only tops the round up when they have not solved enough of them, so a
      // round is never filled with unseen problems while solved ones are left out.
      const selected = selectDsaInterviewQuestions({
        solved: solvedFunctionQuestions,
        fallback: fallbackQuestions,
        performance,
        count:
          profile.targetRole === "backend" || profile.targetRole === "fullstack"
            ? 2
            : QUESTION_COUNT
      });
      // Setup is public session metadata. Keep it to labels so unreached
      // problem statements and design prompts remain server-side.
      const dsaAgenda = selected.map((item) => item.title);
      const supportsDesign = profile.targetRole === "backend" || profile.targetRole === "fullstack";
      let plan: PlannedQuestion[] | undefined;
      let dsaDesignRound:
        | {
            kind: "dsa-design-round";
            version: 1;
            designScenarioKey: string;
            designScenarioVersion: number;
            designScenarioTitle: string;
            designDifficulty: "guided" | "standard" | "stretch";
          }
        | undefined;
      let designTitle = "";
      if (supportsDesign && selected.length === 2) {
        const recentScenarioKeys = history
          .filter((item) => item.status === "completed")
          .map((item) => item.setup.dsaDesignRound?.designScenarioKey)
          .filter((key): key is string => Boolean(key));
        const focus = await app.architectureDesign.focus.confirm(ownerId, { path: "role-aligned" });
        const selection = rankDsaDesignScenarioWithFallback(
          app.architectureDesign.ranking,
          focus,
          recentScenarioKeys
        );
        const artifact = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
          (candidate) => candidate.scenario.key === selection.selectedScenario.scenarioKey
        );
        if (!artifact) throw new Error("Selected Architecture & Design scenario is unavailable");
        plan = buildDsaDesignPlan({
          dsaQuestions: [
            findQuestion(selected[0]!.slug)!.question,
            findQuestion(selected[1]!.slug)!.question
          ],
          designArtifact: artifact
        });
        designTitle = artifact.scenario.title;
        dsaDesignRound = {
          kind: "dsa-design-round",
          version: 1,
          designScenarioKey: artifact.scenario.key,
          designScenarioVersion: selection.selectedScenario.scenarioVersion,
          designScenarioTitle: artifact.scenario.title,
          designDifficulty: selection.selectedScenario.difficulty
        };
      } else {
        // Non-backend/full-stack roles retain the existing safe DSA-only round
        // until a reviewed, role-compatible design catalogue exists.
        plan = undefined;
      }
      const agenda =
        supportsDesign && plan && designTitle
          ? [...dsaAgenda, `Design scenario: ${designTitle}`]
          : dsaAgenda;
      const context = [
        supportsDesign && plan
          ? "This is a DSA & Design interview. Start with two important function-based algorithm problems, then use one reviewed system-design scenario. Prefer problems the candidate has already solved in practice; use a curated fallback only when needed."
          : "This is a DSA coding interview focused on important function-based algorithm problems. Prefer problems the candidate has already solved in practice; use a curated fallback only when needed.",
        `Selected solved problems: ${selected.map((item) => `${item.title} (${item.difficulty}, ${item.primaryPattern})`).join("; ")}.`,
        designTitle ? `Design scenario: ${designTitle}.` : "",
        "Ask the candidate to explain the approach, complexity, correctness, and edge cases. Treat this as a real conversation: ask one question at a time, challenge assumptions when useful, and do not repeat generic acknowledgements.",
        profile.context
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 1200);

      const result = await app.interviewService.start(
        {
          role: profile.targetRole ?? "frontend",
          level: profile.level ?? "0-2",
          roundType: "technical",
          intensity: "realistic",
          context,
          agenda,
          templateId: "dsa",
          templateTitle:
            supportsDesign && plan ? "DSA & Design interview" : "DSA practice interview",
          dsaQuestionSlugs: selected.map((item) => item.slug),
          durationMinutes: supportsDesign && plan ? 40 : 15,
          questionCount: (plan?.length ?? QUESTION_COUNT) as 3 | 5,
          dsaDesignRound
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
