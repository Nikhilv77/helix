import { DocumentTitle } from "@/components/document-title";
import type { ReportsOverview } from "@/lib/reports/reports";
import { InterviewReportDashboard } from "./interview-report-dashboard";

/** The latest completed round reads first; cross-round context follows within it. */
export function ReportsView({
  overview,
  candidate,
  quota
}: {
  overview: ReportsOverview;
  quota: { used: number; limit: number };
  firstName: string;
  candidate: { name: string; discipline: string };
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[84rem] flex-col px-4 pb-20 pt-6 text-cream sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      <DocumentTitle title="Reports" />
      <InterviewReportDashboard
        report={overview.latestCompletedReport ?? null}
        overview={overview}
        candidate={candidate}
        quota={quota}
      />
    </div>
  );
}
