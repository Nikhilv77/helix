import type { NextRequest } from "next/server";
import { findQuestion } from "@/lib/dsa/dsa";
import { OPERATION_DSA_SLUGS } from "@/lib/dsa/dsa-code-templates";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { attachInterviewOwnerCookie, resolveInterviewOwner } from "@/server/interview/owner";
import { selectDsaInterviewQuestions } from "@/server/interview/dsa-session-selection";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      const [profile, completed, performance] = await Promise.all([
        app.profileService.get(ownerId),
        app.frontendRoadmapService.completedDsaQuestions(ownerId),
        app.personalizedPerformanceStore.refresh(ownerId)
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
        count: QUESTION_COUNT
      });
      const agenda = selected.map((item) => {
        const question = findQuestion(item.slug)?.question;
        return `${item.title}: ${question?.problemStatement ?? "Discuss the solution, trade-offs, and edge cases."}`;
      });
      const context = [
        "This is a DSA coding interview focused on important function-based algorithm problems. Prefer problems the candidate has already solved in practice; use a curated fallback only when needed.",
        `Selected solved problems: ${selected.map((item) => `${item.title} (${item.difficulty}, ${item.primaryPattern})`).join("; ")}.`,
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
          templateId: "frontend-dsa",
          templateTitle: "DSA practice interview",
          dsaQuestionSlugs: selected.map((item) => item.slug),
          questionCount: QUESTION_COUNT
        },
        ownerId
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
