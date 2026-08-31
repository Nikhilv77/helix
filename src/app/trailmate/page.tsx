import { HelpHub } from "@/components/workspace/help/help-hub";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Trailmate",
  "See the peers you have supported, the people who supported you, and community contributors."
);

export default async function HelpPage() {
  const { ownerId } = await requireOnboardedProfile();
  const service = getAppContainer().helpHistoryService;
  const [overview, receivedHistory, givenHistory] = await Promise.all([
    service.overview(ownerId),
    service.history({ ownerId, side: "received", filter: "resolved" }),
    service.history({ ownerId, side: "given", filter: "resolved" })
  ]);

  return (
    <HelpHub
      initialOverview={overview}
      initialReceivedHistory={receivedHistory}
      initialGivenHistory={givenHistory}
    />
  );
}
