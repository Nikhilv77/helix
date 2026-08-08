import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { InterviewsView } from "@/components/workspace/interviews-view";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Interviews",
  "Start a Trailgrad interview and review the evidence your previous rounds produced."
);

/** Starting rounds, competency evidence and history — moved off Home. */
export default async function InterviewsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const interviewService = getAppContainer().interviewService;
  const ownerId = authenticatedOwnerId(userId);

  try {
    const [quota, sessions, profile, insights] = await Promise.all([
      interviewService.quota(ownerId),
      interviewService.history(ownerId),
      getAppContainer().profileService.get(ownerId),
      interviewService.insights(ownerId)
    ]);
    return (
      <InterviewsView quota={quota} sessions={sessions} profile={profile} insights={insights} />
    );
  } catch {
    const profile = await getAppContainer().profileService.get(ownerId);
    return (
      <InterviewsView
        quota={{ used: 0, limit: 2 }}
        sessions={[]}
        profile={profile}
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
