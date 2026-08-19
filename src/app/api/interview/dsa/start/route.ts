import type { NextRequest } from "next/server";
import { findQuestion } from "@/lib/dsa";
import { getAppContainer } from "@/server/app-container";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { resolveOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_SOLVED = 10;
const QUESTION_COUNT = 3 as const;

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

    const selected = shuffle(completed).slice(0, QUESTION_COUNT);
    const agenda = selected.map((item) => {
      const question = findQuestion(item.slug)?.question;
      return `${item.title}: ${question?.problemStatement ?? "Discuss the solution, trade-offs, and edge cases."}`;
    });
    const context = [
      "This is a DSA coding interview based only on problems the candidate has already solved in practice.",
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
