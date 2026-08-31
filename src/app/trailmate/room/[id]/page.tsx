import { privatePageMetadata } from "@/lib/shared/seo";
import { HelpRoom } from "@/components/workspace/help/help-room";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { safePeerHelpReturnTo } from "@/lib/help/help-room-navigation";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Trailmate room",
  "A private voice and live-code room for a focused Trailmate session."
);

export default async function HelpRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireOnboardedProfile();
  const { id } = await params;
  const { from } = await searchParams;
  return <HelpRoom requestId={id} returnTo={safePeerHelpReturnTo(from)} />;
}
