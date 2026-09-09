import { DocumentTitle } from "@/components/document-title";
import { CoachingReadinessSection } from "./coaching-readiness-section";
import { ContinuationSection } from "./continuation-section";
import { SummariesSection } from "./summaries-section";
import { WeeklyDirectionSection } from "./weekly-direction-section";
import type { DashboardOverviewData } from "@/features/dashboard/contracts/dashboard-overview";

interface DashboardProps {
  overviewData: DashboardOverviewData;
}

export function DashboardOverview({ overviewData }: DashboardProps) {
  return (
    <main className="min-h-screen w-full overflow-hidden bg-black text-cream">
      <DocumentTitle title="Overview" />
      <div className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pt-11">
        <CoachingReadinessSection
          data={{ coaching: overviewData.coaching, readiness: overviewData.readiness }}
        />
        <WeeklyDirectionSection data={overviewData.direction} />
        <ContinuationSection data={overviewData.continuation} />
        <SummariesSection data={overviewData.explore} />
      </div>
    </main>
  );
}
