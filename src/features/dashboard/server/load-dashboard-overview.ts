import { buildDashboardOverview } from "@/features/dashboard/application/build-dashboard-overview";
import type { DashboardOverviewData } from "@/features/dashboard/contracts/dashboard-overview";
import { mergeDashboardPractice } from "@/lib/practice/core-technical/workspace-analytics";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";

interface LoadDashboardOverviewInput {
  ownerId: string;
  profile: CandidateProfile;
  now: number;
}

/** Loads independently degradable Dashboard sources and builds one serializable view model. */
export async function loadDashboardOverview({
  ownerId,
  profile,
  now
}: LoadDashboardOverviewInput): Promise<DashboardOverviewData> {
  const container = getAppContainer();
  const coreRoundsPromise = container.coreTechnicalWorkspaceAnalyticsService
    .rounds(ownerId)
    .catch(() => ({ history: [], reports: [] }));
  const [reports, practice, corePractice, trailmate] = await Promise.all([
    coreRoundsPromise.then((core) =>
      container.interviewService.reportsOverview(ownerId, 50, now, core.reports).catch(() => null)
    ),
    container.progressService.dashboard(ownerId).catch(() => null),
    container.coreTechnicalWorkspaceAnalyticsService.practice(ownerId, 126).catch(() => null),
    container.helpHistoryService.dashboardOverview(ownerId).catch(() => null)
  ]);
  const combinedPractice = corePractice ? mergeDashboardPractice(practice, corePractice) : practice;

  return buildDashboardOverview(profile, reports, combinedPractice, now, trailmate);
}
