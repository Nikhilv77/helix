import { z } from "zod";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { refreshPracticeHome } from "@/features/practice/shared/server/refresh-practice-home";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authorizeInterviewSession } from "@/features/interviews/server/session-access";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

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
    const lease = await guard.enforceAndAcquire(
      { policy: RATE_LIMIT_POLICIES.answerEvaluation, identity: parsed.data.sessionId },
      {
        policy: {
          namespace: "answer-evaluate",
          ttlMs: 65_000,
          code: "ANSWER_EVALUATION_IN_PROGRESS",
          message: "The previous answer is still being evaluated."
        },
        identity: parsed.data.sessionId
      }
    );

    try {
      const now = Date.now();
      // The service reads the session once, checks the live proposal, and
      // fills omitted timing from the session start.
      const answer = {
        text: parsed.data.userAnswer,
        startMs: parsed.data.startMs,
        endMs: parsed.data.endMs
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
              parsed.data.submissionSource,
              { requireLiveProposal: true }
            )
          : await app.interviewService.answer(
              parsed.data.sessionId,
              answer,
              now,
              parsed.data.turnId,
              parsed.data.liveProposal,
              parsed.data.submissionSource,
              { requireLiveProposal: true }
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
          if (access.kind === "owner" && access.ownerId.startsWith("user:")) {
            await refreshPracticeHome(access.ownerId);
          }
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
