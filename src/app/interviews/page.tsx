import { InterviewsView } from "@/components/workspace/interviews/interviews-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Interviews",
  "Start a Trailgrad interview and review the evidence your previous rounds produced."
);

/** Starting rounds, competency evidence and history — moved off Home. */
export default async function InterviewsPage() {
  const app = getAppContainer();
  const interviewService = app.interviewService;
  const { ownerId, profile: candidateProfile } = await requireOnboardedProfile();

  try {
    const [quota, sessions, personalizedPlan, roadmap] = await Promise.all([
      interviewService.quota(ownerId),
      interviewService.history(ownerId),
      app.personalizedInterviewPlanningService.activePlan(ownerId).catch(() => null),
      app.frontendRoadmapService.home(ownerId).catch(() => null)
    ]);
    return (
      <InterviewsView
        quota={quota}
        sessions={sessions}
        profile={candidateProfile}
        personalizedPlan={personalizedPlan}
        roadmap={roadmap}
      />
    );
  } catch {
    return (
      <InterviewsView
        quota={{ used: 0, limit: 2 }}
        sessions={[]}
        profile={candidateProfile}
        personalizedPlan={null}
        roadmap={null}
      />
    );
  }
}
