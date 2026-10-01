import { DocumentTitle } from "@/components/document-title";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import { InterviewReportDashboard } from "./interview-report-dashboard";
import { ReportsAutoRefresh } from "./reports-auto-refresh";

/** End-of-round grading finishes well inside this. */
const GRADING_WINDOW_MS = 3 * 60_000;

/** The latest completed round reads first; cross-round context follows within it. */
export function ReportsView({
  overview,
  candidate,
  quota
}: {
  overview: ReportsOverview;
  quota: { used: number; limit: number };
  candidate: { name: string; discipline: string };
}) {
  const report = overview.latestCompletedReport ?? null;
  // Only a round that just ended is still being graded. An older answer left
  // unscored will not change, so the page must not wait for it.
  const scoresPending = Boolean(
    report &&
      Date.now() - report.updatedAt < GRADING_WINDOW_MS &&
      report.competencies.some(
        (item) => item.answered && item.technicalEvaluation?.source === "evaluation-unavailable"
      )
  );
  return (
    <div className="reports-page mx-auto flex min-h-screen w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      <DocumentTitle title="Reports" />
      <ReportsAutoRefresh pending={scoresPending} />
      <InterviewReportDashboard
        report={report}
        overview={overview}
        candidate={candidate}
        quota={quota}
      />
    </div>
  );
}
