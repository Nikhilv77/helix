import type { DashboardOverviewData } from "@/features/dashboard/contracts/dashboard-overview";
import type { HelpDashboardOverview } from "@/lib/help/help-history";
import type { ReportsOverview } from "@/lib/reports/reports";
import type { ProgressDashboardOverview } from "@/lib/roadmap/progress";
import type { CandidateProfile } from "@/lib/shared/types";
import { buildCoaching, buildReadiness } from "./coaching-and-readiness";
import { buildContinuation } from "./continuation";
import { buildDirection } from "./direction";
import { buildExplore } from "./explore";

/** Composes the independently testable projections used by the Overview screen. */
export function buildDashboardOverview(
  profile: CandidateProfile,
  reports: ReportsOverview | null,
  practice: ProgressDashboardOverview | null,
  now = Date.now(),
  trailmate: HelpDashboardOverview | null = null
): DashboardOverviewData {
  return {
    coaching: buildCoaching(profile, reports, practice, now),
    readiness: buildReadiness(profile, reports, practice),
    continuation: buildContinuation(profile, reports, practice),
    explore: buildExplore(profile, reports, practice, trailmate),
    direction: buildDirection(profile, reports, practice, now)
  };
}
