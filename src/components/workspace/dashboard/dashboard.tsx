import { DocumentTitle } from "@/components/document-title";
import { MayaWelcome } from "./maya-welcome";
import { MayaWelcomeLoading } from "./maya-welcome-loading";
import { DashboardFirstRow } from "./dashboard-first-row";
import { DashboardSecondRow } from "./dashboard-second-row";
import { DashboardThirdRow } from "./dashboard-third-row";
import { DashboardFourthRow } from "./dashboard-fourth-row";
import type { DashboardOverviewData } from "@/lib/dashboard/dashboard-overview";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile, Role } from "@/lib/shared/types";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import type { PracticeRoadmapSession } from "@/lib/practice/practice-roadmap";

interface DashboardProps {
  profile: CandidateProfile;
  showMayaWelcome?: boolean;
  frontendRoadmap?: FrontendRoadmapHome | null;
  frontendPlan?: FrontendDsaPlan | null;
  /** The candidate's own Practice sessions, for the welcome preview. */
  practiceSessions?: PracticeRoadmapSession[] | null;
  overviewData?: DashboardOverviewData;
}

export function Dashboard({
  profile,
  showMayaWelcome = false,
  frontendRoadmap = null,
  frontendPlan = null,
  practiceSessions = null,
  overviewData
}: DashboardProps) {
  if (showMayaWelcome) {
    return (
      <>
        <DocumentTitle title="Home" />
        <MayaWelcome
          profile={profile}
          practiceHref={buildPracticeHref(
            profile.targetRole,
            profile.level,
            profile.focusAreas[0] ?? null
          )}
          frontendRoadmap={frontendRoadmap}
          frontendPlan={frontendPlan}
          practiceSessions={practiceSessions}
        />
        <MayaWelcomeLoading />
      </>
    );
  }

  if (!overviewData) return null;

  return (
    <main className="min-h-screen w-full overflow-hidden bg-black text-cream">
      <DocumentTitle title="Overview" />
      <div className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pt-11">
        <DashboardFirstRow
          data={{ coaching: overviewData.coaching, readiness: overviewData.readiness }}
        />
        <DashboardFourthRow data={overviewData.direction} />
        <DashboardSecondRow data={overviewData.continuation} />
        <DashboardThirdRow data={overviewData.explore} />
      </div>
    </main>
  );
}

function buildPracticeHref(
  role: Role | null,
  level: CandidateProfile["level"],
  focus: string | null
): string {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (level) params.set("level", level);
  if (focus) params.set("focus", focus);
  const query = params.toString();
  return query ? `/interview?${query}` : "/interview";
}
