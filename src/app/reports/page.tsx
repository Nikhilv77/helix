import { ReportsView } from "@/features/reports/ui/reports-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { buildReportsPageData } from "@/features/reports/server/reports-page-data";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { redirect } from "next/navigation";
import { after } from "next/server";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 30;
export const maxDuration = 60;
/** A normal rebuild takes well under a second next to the database. */
const REPORTS_FRESH_WAIT_MS = 2_000;
export const metadata = privatePageMetadata(
  "Reports",
  "Every Trailgrad interview round you have run, scored and compared side by side."
);

/** Every round, scored and compared — the cross-round view of your reports. */
export default async function ReportsPage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const ownerId = authenticatedOwnerId(userId);
  const container = getAppContainer();
  const now = Date.now();
  // People open Reports straight after a round. Waiting briefly for the
  // rebuild keeps the round they just finished from being missing.
  const page = await container.workspacePageSnapshotStore.readOrBuild(
    ownerId,
    "reports",
    () => buildReportsPageData(ownerId, now),
    { waitForFreshMs: REPORTS_FRESH_WAIT_MS }
  );
  // Grades that failed at the end of a round retry on a delay, and nothing
  // else may run them before the daily cron. Opening Reports is the moment
  // someone wants them, so work the queue after this response.
  after(() =>
    container.interviewEvaluationRecoveryService.runBatch(5).then(
      () => undefined,
      () => undefined
    )
  );
  const quota = {
    used: Math.min(
      page.quotaLimit,
      page.quotaStartedAt.filter((startedAt) => startedAt >= now - 86_400_000).length
    ),
    limit: page.quotaLimit
  };

  return <ReportsView overview={page.reports} quota={quota} candidate={page.candidate} />;
}
