import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProgressView } from "@/components/workspace/progress-view";
import type { ProgressInterview } from "@/lib/progress";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Progress",
  "How far you are through your preparation path, measured from what you have actually practised."
);

const EMPTY_INTERVIEW: ProgressInterview = {
  readinessScore: null,
  completedSessions: 0,
  sessionsThisWeek: 0,
  answeredQuestions: 0,
  competencies: [],
  strongest: null,
  focus: null
};

/** Practice progress and interview evidence, on one page. */
export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const container = getAppContainer();

  const [profile, insights] = await Promise.all([
    container.profileService.get(ownerId),
    // Interview evidence is a bonus panel here, not the point of the page — a
    // failure to read it should not cost the user their practice numbers.
    container.interviewService.insights(ownerId).catch(() => null)
  ]);

  const interview: ProgressInterview = insights
    ? {
        readinessScore: insights.readinessScore,
        completedSessions: insights.completedSessions,
        sessionsThisWeek: insights.sessionsThisWeek,
        answeredQuestions: insights.answeredQuestions,
        competencies: insights.competencyMap,
        strongest: insights.strongest,
        focus: insights.recommendedFocus
      }
    : EMPTY_INTERVIEW;

  const overview = await container.progressService.overview(ownerId, interview);

  return (
    <ProgressView
      overview={overview}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
    />
  );
}
