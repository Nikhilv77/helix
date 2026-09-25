import { ProgressView } from "@/features/progress/ui/progress-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { buildCandidateAnalytics } from "@/features/analytics/server/candidate-analytics-loader";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 30;
export const maxDuration = 60;
export const metadata = privatePageMetadata(
  "Progress",
  "How far you are through your preparation path, measured from what you have actually practised."
);

/** Practice progress and interview evidence, on one page. */
export default async function ProgressPage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const ownerId = authenticatedOwnerId(userId);
  const analytics = await getAppContainer().candidateAnalyticsSnapshotStore.readSummary(
    ownerId,
    () => buildCandidateAnalytics(ownerId)
  );

  return (
    <ProgressView
      overview={analytics.progressBriefing}
      firstName={analytics.progressPage.firstName}
      starterQuestions={analytics.progressPage.starterQuestions}
    />
  );
}
