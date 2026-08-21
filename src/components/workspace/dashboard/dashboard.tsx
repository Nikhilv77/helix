import { DocumentTitle } from "@/components/document-title";
import { MayaWelcome } from "./maya-welcome";
import { MayaWelcomeLoading } from "@/components/workspace/shared/loading/skeletons";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile, Role } from "@/lib/shared/types";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import { SessionCards } from "./session-cards";

interface DashboardProps {
  profile: CandidateProfile;
  showMayaWelcome?: boolean;
  /** User-specific roadmap loaded from persisted progress state. */
  frontendRoadmap?: FrontendRoadmapHome | null;
  /** Seeded DSA plan fallback used only if the user roadmap cannot load. */
  frontendPlan?: FrontendDsaPlan | null;
}

/**
 * Home is the preparation plan and nothing else.
 *
 * It previously also carried the Maya hero, the resume roadmap, the generated
 * session plan, the competency map and interview history. Those surfaces still
 * exist — Progress and Reports own the evidence views, Practice owns starting a
 * round, and the sidebar owns the primary "Start interview" action — so
 * repeating them here only competed with the plan for attention.
 */
export function Dashboard({
  profile,
  showMayaWelcome = false,
  frontendRoadmap = null,
  frontendPlan = null
}: DashboardProps) {
  const practiceHref = buildPracticeHref(
    profile.targetRole,
    profile.level,
    profile.focusAreas[0] ?? null
  );

  if (showMayaWelcome) {
    return (
      <>
        <DocumentTitle title="Home" />
        <MayaWelcome
          profile={profile}
          practiceHref={practiceHref}
          frontendRoadmap={frontendRoadmap}
          frontendPlan={frontendPlan}
        />
        <MayaWelcomeLoading />
      </>
    );
  }

  return (
    <div className="pb-10">
      <DocumentTitle title="Home" />
      <SessionCards
        roadmap={frontendRoadmap}
        fallbackPlan={frontendPlan}
        firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
        targetRole={profile.targetRole}
      />
    </div>
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
