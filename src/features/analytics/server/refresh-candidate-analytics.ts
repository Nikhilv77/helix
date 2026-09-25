import { after } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";

const logger = new Logger("CandidateAnalyticsRefresh");

export function scheduleCandidateAnalyticsRefresh(ownerId: string): void {
  after(() => refreshCandidateAnalytics(ownerId));
}

export async function refreshCandidateAnalytics(ownerId: string): Promise<void> {
  try {
    const app = getAppContainer();
    // Source-table triggers already mark changed analytics dirty. A second
    // version bump here can invalidate a concurrent Home/Progress
    // rebuild and make the request repeat all of its source reads.
    const { buildCandidateAnalytics } = await import("./candidate-analytics-loader");
    await app.candidateAnalyticsSnapshotStore.readSummary(
      ownerId,
      () => buildCandidateAnalytics(ownerId),
      { requireFresh: true }
    );
  } catch (error) {
    logger.error({
      event: "candidate.analytics_refresh_failed",
      ownerId,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}
