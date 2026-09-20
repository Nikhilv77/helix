import { z } from "zod";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authorizeInterviewSession } from "@/features/interviews/server/session-access";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { usesGeminiLedConversation } from "@/features/interviews/domain/gemini-live-conversation";

export const dynamic = "force-dynamic";

/**
 * The single home of the interview decision logic.
 *
 * The Gemini Live browser client calls this after every user turn and speaks
 * the `utterance` it gets back. The client does not own any business state —
 * everything it needs is derived here from the session id.
 */
const decideSchema = z.object({
  sessionId: z.string().uuid(),
  turnId: z.string().uuid(),
  userAnswer: z.string().trim().min(1).max(16_000),
  /** Milliseconds from session start. Voice fills these from real audio timings. */
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional(),
  /** Browser-controlled origin; workspace is only set by the typed editor bridge. */
  submissionSource: z.enum(["voice", "workspace"]).default("voice"),
  liveProposal: z
    .object({
      action: z.enum(["clarify", "probe", "challenge", "respond", "move_on"]),
      missing: z.enum(["clarity", "structure", "specificity", "ownership", "outcome", "none"]),
      candidateIntent: z
        .enum(["answer", "decline", "end", "question-or-clarification", "other"])
        .optional(),
      reason: z.string().trim().min(1).max(200),
      acknowledgement: z.string().trim().max(120),
      line: z.string().trim().max(300),
      candidateResponse: z.string().trim().max(400).optional()
    })
    .optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const parsed = decideSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    const access = await authorizeInterviewSession(
      request,
      app.config,
      parsed.data.sessionId,
      "answer"
    );
    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.answerEvaluation, parsed.data.sessionId);
    const lease = await guard.acquire(
      {
        namespace: "answer-evaluate",
        ttlMs: 65_000,
        code: "ANSWER_EVALUATION_IN_PROGRESS",
        message: "The previous answer is still being evaluated."
      },
      parsed.data.sessionId
    );

    try {
      const now = Date.now();
      const existing =
        access.kind === "owner"
          ? await app.interviewService.getOwnedActive(access.ownerId, parsed.data.sessionId)
          : await app.interviewService.get(parsed.data.sessionId);
      if (usesGeminiLedConversation(existing.setup) && !parsed.data.liveProposal) {
        throw new ApiRouteError(
          400,
          "LIVE_PROPOSAL_REQUIRED",
          "The live interviewer must complete this turn before it can be saved."
        );
      }
      const defaultEnd = Math.max(0, now - existing.startedAt);

      const answer = {
        text: parsed.data.userAnswer,
        startMs: parsed.data.startMs ?? defaultEnd,
        endMs: parsed.data.endMs ?? defaultEnd
      };
      const answerResult =
        access.kind === "owner"
          ? await app.interviewService.answerOwned(
              access.ownerId,
              parsed.data.sessionId,
              answer,
              now,
              parsed.data.turnId,
              parsed.data.liveProposal,
              parsed.data.submissionSource
            )
          : await app.interviewService.answer(
              parsed.data.sessionId,
              answer,
              now,
              parsed.data.turnId,
              parsed.data.liveProposal,
              parsed.data.submissionSource
            );
      const { response } = answerResult;
      // Recovery runs outside the spoken-turn response. The job itself was
      // persisted with the answer, so a serverless shutdown only delays it.
      after(() => app.interviewEvaluationRecoveryService.runBatch(2));
      if (response.phase === "done") {
        after(async () => {
          await Promise.allSettled([
            access.kind === "owner"
              ? app.dsaBlockAssessmentFinalizationService.finalizeOwned(
                  access.ownerId,
                  parsed.data.sessionId
                )
              : app.dsaBlockAssessmentFinalizationService.finalizeBySession(parsed.data.sessionId),
            access.kind === "owner"
              ? app.coreTechnicalAssessmentService.finalizeInterviewOwned(
                  access.ownerId,
                  parsed.data.sessionId
                )
              : app.coreTechnicalAssessmentService.finalizeInterviewBySession(
                  parsed.data.sessionId
                ),
            access.kind === "owner"
              ? app.appliedEngineeringAssessmentService.finalizeInterviewOwned(
                  access.ownerId,
                  parsed.data.sessionId
                )
              : app.appliedEngineeringAssessmentService.finalizeInterviewBySession(
                  parsed.data.sessionId
                ),
            access.kind === "owner"
              ? app.architectureDesign.assessment.finalizeInterviewOwned(
                  access.ownerId,
                  parsed.data.sessionId
                )
              : app.architectureDesign.assessment.finalizeInterviewBySession(parsed.data.sessionId)
          ]);
        });
      }

      return apiSuccess(response);
    } finally {
      await lease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
