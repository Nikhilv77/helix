import type { NextRequest } from "next/server";

import { getAppContainer } from "@/server/app-container";
import { runGlobalHelpMaintenance } from "@/features/peer-help/server/help-maintenance";
import { Logger } from "@/server/common/logger";
import { recoverDirtySnapshots } from "@/features/analytics/server/recover-dirty-snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const logger = new Logger("DailyMaintenanceCron");

/** One daily fallback for inactive-user cleanup and durable interview work. */
export async function GET(request: NextRequest) {
  const app = getAppContainer();
  const secret = app.config.cronSecret;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // The same secured function can be invoked repeatedly during a deployment
  // backfill without running help and interview maintenance each time.
  if (request.nextUrl.searchParams.get("snapshotsOnly") === "1") {
    const recovery = await recoverDirtySnapshots(4);
    return Response.json(
      { success: recovery.failed === 0, data: recovery },
      {
        status: recovery.failed ? 503 : 200
      }
    );
  }

  const [maintenance, interviewEvaluations, interviewRetention] = await Promise.allSettled([
    runGlobalHelpMaintenance(app),
    app.interviewEvaluationRecoveryService.runBatch(5),
    app.interviewOperationsService.enforceRetention()
  ]);
  const snapshotRecovery = await Promise.resolve()
    .then(() => recoverDirtySnapshots(4, { includeMissing: false, includeDayRollover: false }))
    .then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    );

  const failures = [
    failedJob("maintenance", maintenance),
    failedJob("interviewEvaluations", interviewEvaluations),
    failedJob("interviewRetention", interviewRetention),
    failedJob("snapshotRecovery", snapshotRecovery),
    snapshotRecovery.status === "fulfilled" && snapshotRecovery.value.failed > 0
      ? "snapshotRecovery"
      : null
  ].filter((job): job is string => job !== null);

  return Response.json(
    {
      success: failures.length === 0,
      data: {
        maintenance: maintenance.status === "fulfilled" ? maintenance.value : null,
        interviewEvaluations:
          interviewEvaluations.status === "fulfilled" ? interviewEvaluations.value : null,
        interviewRetention:
          interviewRetention.status === "fulfilled" ? interviewRetention.value : null,
        snapshotRecovery: snapshotRecovery.status === "fulfilled" ? snapshotRecovery.value : null
      },
      ...(failures.length ? { failedJobs: failures } : {})
    },
    { status: failures.length ? 503 : 200 }
  );
}

function failedJob(job: string, result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") return null;
  logger.error({
    event: "daily_maintenance_job_failed",
    job,
    reason: result.reason instanceof Error ? result.reason.message : String(result.reason)
  });
  return job;
}
