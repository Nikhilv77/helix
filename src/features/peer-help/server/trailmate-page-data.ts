import type { HelpHistoryPage, HelpOverview } from "@/features/peer-help/contracts/help-history";
import { getAppContainer } from "@/server/app-container";

export interface TrailmatePageData {
  overview: HelpOverview;
  receivedHistory: HelpHistoryPage;
  givenHistory: HelpHistoryPage;
}

export async function buildTrailmatePageData(ownerId: string) {
  const service = getAppContainer().helpHistoryService;
  const [overview, receivedHistory, givenHistory] = await Promise.all([
    service.overview(ownerId),
    service.history({ ownerId, side: "received", filter: "resolved" }),
    service.history({ ownerId, side: "given", filter: "resolved" })
  ]);
  return {
    cacheable: true,
    expiresAt: new Date(Date.now() + (overview.activeConversation ? 10_000 : 45_000)),
    data: { overview, receivedHistory, givenHistory } satisfies TrailmatePageData
  };
}
