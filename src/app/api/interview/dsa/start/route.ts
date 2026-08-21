import type { NextRequest } from "next/server";
import { findQuestion } from "@/lib/dsa/dsa";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { resolveOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_SOLVED = 10;
const QUESTION_COUNT = 3 as const;
const CLASS_BASED_DSA_SLUGS = new Set([
  "design-browser-history",
  "lru-cache",
  "min-stack",
  "implement-queue-using-stacks",
  "implement-stack-using-queues",
  "design-circular-queue",
  "online-stock-span",
  "time-based-key-value-store",
  "find-median-from-data-stream",
  "implement-trie-prefix-tree",
  "design-add-and-search-words-data-structure"
]);
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
    const ownerId = await resolveOwnerId(request, app.config);
    const profile = await app.profileService.get(ownerId);
    const completed = await app.frontendRoadmapService.completedDsaQuestions(ownerId);

    if (completed.length < MIN_SOLVED) {
      throw new ApiRouteError(
        409,
        "DSA_INTERVIEW_NOT_READY",
        `Solve at least ${MIN_SOLVED} DSA practice questions before starting an interview.`,
        { completed: completed.length, required: MIN_SOLVED }
      );
    }

    const solvedFunctionQuestions = completed.filter((item) => !CLASS_BASED_DSA_SLUGS.has(item.slug));
    const fallbackQuestions = IMPORTANT_FUNCTION_QUESTION_SLUGS
      .map((slug) => findQuestion(slug)?.question)
      .filter((question): question is NonNullable<typeof question> => Boolean(question))
      .filter((question) => !solvedFunctionQuestions.some((item) => item.slug === question.slug));
    const selected = shuffle([...solvedFunctionQuestions, ...fallbackQuestions]).slice(0, QUESTION_COUNT);
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
        role: "frontend",
        level: profile.level ?? "0-2",
        roundType: "technical",
        intensity: "realistic",
        context,
        agenda,
        templateTitle: "DSA practice interview",
        dsaQuestionSlugs: selected.map((item) => item.slug),
        questionCount: QUESTION_COUNT
      },
      ownerId
    );

    return apiSuccess({
      sessionId: result.state.id,
      questionCount: result.state.plan.length,
      utterance: result.utterance
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}
