import type { DashboardOverviewData } from "@/features/dashboard/contracts/dashboard-overview";
import { buildCandidateAnalytics } from "@/features/analytics/server/candidate-analytics-loader";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";

interface LoadDashboardOverviewInput {
  ownerId: string;
  profile?: CandidateProfile;
  now: number;
}

/** Read the prepared projection; load the full profile only if it must be rebuilt. */
export async function loadDashboardOverview({
  ownerId,
  profile,
  now
}: LoadDashboardOverviewInput): Promise<DashboardOverviewData> {
  const analytics = await getAppContainer().candidateAnalyticsSnapshotStore.readSummary(
    ownerId,
    () => buildCandidateAnalytics(ownerId, profile, now)
  );
  return analytics.dashboard;
}
