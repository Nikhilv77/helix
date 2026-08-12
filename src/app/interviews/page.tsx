import { InterviewsView } from "@/components/workspace/interviews-view";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Interviews",
  "Start a Trailgrad interview and review the evidence your previous rounds produced."
);

/** Starting rounds, competency evidence and history — moved off Home. */
export default async function InterviewsPage() {
  const interviewService = getAppContainer().interviewService;
  const { ownerId, profile: candidateProfile } = await requireOnboardedProfile();

  try {
    const [quota, sessions, profile, insights] = await Promise.all([
      interviewService.quota(ownerId),
      interviewService.history(ownerId),
      Promise.resolve(candidateProfile),
      interviewService.insights(ownerId)
    ]);
    return (
      <InterviewsView quota={quota} sessions={sessions} profile={profile} insights={insights} />
    );
  } catch {
    return (
      <InterviewsView
        quota={{ used: 0, limit: 2 }}
        sessions={[]}
        profile={candidateProfile}
        insights={{
          readinessScore: null,
          completedSessions: 0,
          sessionsThisWeek: 0,
          answeredQuestions: 0,
          competencyMap: [],
          strongest: null,
          recommendedFocus: null
        }}
        historyAvailable={false}
      />
    );
  }
}
