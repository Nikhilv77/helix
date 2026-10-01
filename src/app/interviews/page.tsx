import { InterviewsView } from "@/features/interviews/ui/history/interviews-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import {
  buildInterviewsHomeForOwner,
  currentInterviewQuota,
  nextInterviewSessionAt
} from "@/features/interviews/server/load-interviews-home";
import { redirect } from "next/navigation";
import { buildReportsPageData } from "@/features/reports/server/reports-page-data";
import type { InterviewReportFamily } from "@/features/interviews/domain/evaluation-profile";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 30;
export const maxDuration = 60;
export const metadata = privatePageMetadata(
  "Interviews",
  "Start a Trailgrad interview and review the evidence your previous rounds produced."
);

/** Read one prepared owner-scoped entry snapshot on a warm visit. */
export default async function InterviewsPage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const ownerId = authenticatedOwnerId(userId);
  const snapshots = getAppContainer().workspacePageSnapshotStore;
  // Scores come from the Reports snapshot so both pages show the same numbers.
  // A missing score is not worth failing the page over.
  const [data, reports] = await Promise.all([
    snapshots.readOrBuild(ownerId, "interviews", () => buildInterviewsHomeForOwner(ownerId)),
    snapshots
      .readOrBuild(ownerId, "reports", () => buildReportsPageData(ownerId))
      .catch(() => null)
  ]);
  const latestScores: Partial<Record<InterviewReportFamily, number>> = {};
  for (const family of reports?.reports.families ?? []) {
    if (family.latestScore !== null) latestScores[family.family] = family.latestScore;
  }

  return (
    <InterviewsView
      quota={currentInterviewQuota(data)}
      nextSessionAt={nextInterviewSessionAt(data)}
      sessions={data.sessions}
      firstName={data.firstName}
      roadmapSessions={data.roadmapSessions}
      latestScores={latestScores}
    />
  );
}
