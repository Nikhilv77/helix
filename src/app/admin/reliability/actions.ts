"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { Logger } from "@/server/common/logger";

const logger = new Logger("AdminRetryGrading");

export type RetryGradingState = { sessionId: string; outcome: "graded" | "still-stuck" | "not-found" } | null;

/**
 * Runs the same finishing steps as ending the room: grade any queued answers,
 * then let each checkpoint track write its result. Only rooms on the stuck
 * list can be retried, and the owner comes from the database, not the form.
 */
export async function retryCheckpointGrading(
  _previous: RetryGradingState,
  formData: FormData
): Promise<RetryGradingState> {
  const app = await requireAdmin();
  const sessionId = String(formData.get("sessionId") ?? "");
  const stuck = await app.adminUsageService.stuckCheckpoints();
  const target = stuck.find((row) => row.sessionId === sessionId);
  if (!target) return { sessionId, outcome: "not-found" };

  const { ownerId } = target;
  await app.interviewEvaluationRecoveryService
    .runBatch(20, Date.now(), { sessionId })
    .catch(() => undefined);
  const results = await Promise.allSettled([
    app.dsaBlockAssessmentFinalizationService.finalizeOwned(ownerId, sessionId),
    app.coreTechnicalAssessmentService.finalizeInterviewOwned(ownerId, sessionId),
    app.appliedEngineeringAssessmentService.finalizeInterviewOwned(ownerId, sessionId),
    app.architectureDesign.assessment.finalizeInterviewOwned(ownerId, sessionId),
    app.storyAssessmentService.finalizeInterviewOwned(ownerId, sessionId)
  ]);
  const remaining = await app.adminUsageService.stuckCheckpoints();
  const graded = !remaining.some((row) => row.sessionId === sessionId);
  logger.log(
    JSON.stringify({
      event: "admin.retry_grading",
      sessionId,
      track: target.track,
      graded,
      failures: results
        .filter((result) => result.status === "rejected")
        .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)))
        .slice(0, 3)
    })
  );
  revalidatePath("/admin/reliability");
  return { sessionId, outcome: graded ? "graded" : "still-stuck" };
}
