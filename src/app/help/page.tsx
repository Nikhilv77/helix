import { HelpHub } from "@/components/workspace/help/help-hub";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Help",
  "Review the help you have received, the people you have helped, and focused requests you can answer."
);

export default async function HelpPage() {
  const { ownerId } = await requireOnboardedProfile();
  const service = getAppContainer().helpHistoryService;
  const [overview, history] = await Promise.all([
    service.overview(ownerId),
    service.history({ ownerId, side: "received", filter: "all" })
  ]);

  return <HelpHub initialOverview={overview} initialHistory={history} />;
}
