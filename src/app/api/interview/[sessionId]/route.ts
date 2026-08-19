import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { currentQuestion } from "@/server/interview/state-machine";
import type { InterviewState } from "@/server/interview/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> | { sessionId: string } };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const state = await getAppContainer().interviewService.get(requireUuid(sessionId));
    return apiSuccess(serialise(state));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

/** Ends the session early — the "End interview" button. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const state = await getAppContainer().interviewService.end(requireUuid(sessionId));
    return apiSuccess(serialise(state));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

function serialise(state: InterviewState) {
  const question = currentQuestion(state);

  return {
    sessionId: state.id,
    phase: state.phase,
    questionIndex: state.questionIndex,
    questionCount: state.plan.length,
    followUpCount: state.followUpCount,
    startedAt: state.startedAt,
    setup: state.setup,
    evidence: state.evidence ?? null,
    turns: state.turns,
    currentQuestion: question
      ? {
          text: question.text,
          evidenceAnchor: question.evidenceAnchor?.trim() || null,
          kind: question.kind ?? "conversation",
          competency: question.competency ?? null,
          language: question.language || null,
          codeTask: question.codeTask || null,
          codeSnippet: question.codeSnippet || null
        }
      : null
  };
}

function requireUuid(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }

  throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
    messages: ["sessionId must be a UUID"]
  });
}
