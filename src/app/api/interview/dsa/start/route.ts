import type { NextRequest } from "next/server";
import { allQuestionSlugs, findQuestion, isEnriched } from "@/features/practice/dsa/domain/dsa";
import { OPERATION_DSA_SLUGS } from "@/features/practice/dsa/domain/dsa-code-templates";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import {
  attachInterviewOwnerCookie,
  resolveInterviewOwner
} from "@/features/interviews/server/owner";
import { selectDsaInterviewPair } from "@/features/interviews/server/dsa-session-selection";
import { buildDsaInterviewPlan } from "@/features/interviews/server/dsa-design-round";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import type { PlannedQuestion } from "@/features/interviews/server/types";

export const dynamic = "force-dynamic";

const MIN_SOLVED = 10;
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
      const [profile, completed, performance] = await Promise.all([
        app.profileService.get(ownerId),
        app.frontendRoadmapService.completedDsaQuestions(ownerId),
        app.personalizedPerformanceStore.refresh(ownerId)
      ]);
      // The gate counts only function-based problems the coding round can draw on.
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
      // Unseen problems must be fully written up and runnable in the workspace.
      const unseenQuestions = allQuestionSlugs()
        .map((slug) => findQuestion(slug)?.question)
        .filter((question): question is NonNullable<typeof question> =>
          Boolean(
            question &&
            !OPERATION_DSA_SLUGS.has(question.slug) &&
            isEnriched(question) &&
            question.examples?.length
          )
        );
      // One problem they solved, one new problem from a pattern they know.
      const selected = selectDsaInterviewPair({
        solved: solvedFunctionQuestions,
        unseen: unseenQuestions,
        curated: fallbackQuestions,
        performance
      });
      if (selected.length !== 2) {
        throw new Error("The DSA interview requires two selected coding problems");
      }
      const plan: PlannedQuestion[] = buildDsaInterviewPlan({
        dsaQuestions: [
          findQuestion(selected[0]!.slug)!.question,
          findQuestion(selected[1]!.slug)!.question
        ]
      });
      const agenda = selected.map((item) => item.title);
      const context = [
        "This is a coding-only DSA interview with two function-based algorithm problems. The first is one the candidate solved in practice; the second is usually new to them, from a pattern they have practised.",
        `Selected problems: ${selected.map((item) => `${item.title} (${item.difficulty}, ${item.primaryPattern})`).join("; ")}.`,
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
          templateTitle: "DSA Interview",
          dsaQuestionSlugs: selected.map((item) => item.slug),
          durationMinutes: 35,
          questionCount: 2
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
