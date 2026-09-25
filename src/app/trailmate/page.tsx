import { HelpHub } from "@/features/peer-help/ui/help-hub";
import {
  buildTrailmatePageData,
  type TrailmatePageData
} from "@/features/peer-help/server/trailmate-page-data";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 10;
export const maxDuration = 60;
export const metadata = privatePageMetadata(
  "Trailmate",
  "See the peers you have supported, the people who supported you, and community contributors."
);

export default async function HelpPage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const ownerId = authenticatedOwnerId(userId);
  const app = getAppContainer();
  const [{ overview, receivedHistory, givenHistory }, activeConversation] = await Promise.all([
    app.workspacePageSnapshotStore.readOrBuild<TrailmatePageData>(ownerId, "trailmate", () =>
      buildTrailmatePageData(ownerId)
    ),
    app.helpHistoryService.activeConversation(ownerId)
  ]);

  return (
    <HelpHub
      initialOverview={{ ...overview, activeConversation }}
      initialReceivedHistory={receivedHistory}
      initialGivenHistory={givenHistory}
    />
  );
}
