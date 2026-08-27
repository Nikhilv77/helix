import { DocumentTitle } from "@/components/document-title";
import { MayaWelcome } from "./maya-welcome";
import { MayaWelcomeLoading } from "./maya-welcome-loading";
import { DashboardFirstRow } from "./dashboard-first-row";
import type { DashboardOverviewData } from "@/lib/dashboard/dashboard-overview";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile, Role } from "@/lib/shared/types";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";

interface DashboardProps {
  profile: CandidateProfile;
  showMayaWelcome?: boolean;
  frontendRoadmap?: FrontendRoadmapHome | null;
  frontendPlan?: FrontendDsaPlan | null;
  overviewData?: DashboardOverviewData;
}

export function Dashboard({
  profile,
  showMayaWelcome = false,
  frontendRoadmap = null,
  frontendPlan = null,
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
        />
        <MayaWelcomeLoading />
      </>
    );
  }

  if (!overviewData) return null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[84rem] px-4 pb-20 pt-7 text-cream sm:px-6 sm:pt-9 lg:px-8 lg:pt-11">
      <DocumentTitle title="Overview" />
      <DashboardFirstRow data={overviewData} />
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
