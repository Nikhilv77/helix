import { InterviewsView } from "@/features/interviews/ui/history/interviews-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import {
  buildInterviewsHomeForOwner,
  currentInterviewQuota
} from "@/features/interviews/server/load-interviews-home";
import { redirect } from "next/navigation";

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
  const data = await getAppContainer().workspacePageSnapshotStore.readOrBuild(
    ownerId,
    "interviews",
    () => buildInterviewsHomeForOwner(ownerId)
  );

  return (
    <InterviewsView
      quota={currentInterviewQuota(data)}
      sessions={data.sessions}
      firstName={data.firstName}
      roadmapSessions={data.roadmapSessions}
    />
  );
}
