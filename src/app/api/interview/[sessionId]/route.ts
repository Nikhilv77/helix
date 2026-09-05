import type { NextRequest } from "next/server";
import { after } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { currentQuestion } from "@/server/interview/state-machine";
import { roundCaps, type InterviewState } from "@/server/interview/types";
import { findFundamentalsQuestion } from "@/lib/fundamentals/fundamentals";
import { authorizeInterviewSession } from "@/server/interview/session-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> | { sessionId: string } };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const id = requireUuid(sessionId);
    const app = getAppContainer();
    const access = await authorizeInterviewSession(request, app.config, id, "read");
    const state =
      access.kind === "owner"
        ? await app.interviewService.getOwnedActive(access.ownerId, id)
        : await app.interviewService.get(id);
    return apiSuccess(serialise(state));
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

/** Ends the session early — the "End interview" button. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const id = requireUuid(sessionId);
    const app = getAppContainer();
    const access = await authorizeInterviewSession(request, app.config, id, "end");
    const state =
      access.kind === "owner"
        ? await app.interviewService.endOwned(access.ownerId, id)
        : await app.interviewService.end(id);
    after(() =>
      (access.kind === "owner"
        ? app.dsaBlockAssessmentFinalizationService.finalizeOwned(access.ownerId, id)
        : app.dsaBlockAssessmentFinalizationService.finalizeBySession(id)
      ).catch(() => null)
    );
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
    /** This round's own time budget, which is longer for a resume round. */
    hardCapMs: roundCaps(state.setup).hardCapMs,
    setup: state.setup,
    // Stage labels only, so the workspace can draw the round's shape without
    // learning anything about the questions it has not reached yet.
    stages: state.plan.map((question) => question.stage ?? null),
    /**
     * The concept card for the question just finished. Resolved here rather
     * than in the browser, because the bank it comes from also holds the
     * answer keys.
     */
    answeredConcept: answeredConcept(state),
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
          codeSnippet: question.codeSnippet || null,
          // This is deliberately the public render contract only. The saved
          // assessment snapshot's answer keys, rationales, hints and hidden
          // runner material never leave the server before completion.
          dsaTransferQuestion: question.dsaTransferQuestion ?? null,
          stage: question.stage ?? null,
          skill: question.skill || null,
          // `answerIndex` stays on the server. Grading happens there, so the
          // browser never receives the correct option.
          options: question.options?.length ? question.options : null,
          answerFormat: question.answerFormat ?? null,
          expects: question.mustHit?.length ? question.mustHit : null,
          maxFollowUps: question.maxFollowUps ?? null
        }
      : null
  };
}

/** The teaching card for the last completed question, or null before the first. */
function answeredConcept(state: InterviewState) {
  const previous = state.plan[state.questionIndex - 1];
  if (!previous?.sourceSlug) return null;

  const question = findFundamentalsQuestion(previous.sourceSlug);
  if (!question) return null;

  return {
    areaTitle: question.areaTitle,
    explanation: question.explanation,
    title: question.concept.title,
    summary: question.concept.summary,
    points: question.concept.points
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
