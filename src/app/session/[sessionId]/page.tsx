import { notFound } from "next/navigation";
import { SessionDetail } from "@/components/workspace/sessions/session-detail";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice Session",
  "Review a planned Trailgrad practice session from your personalized interview roadmap."
);

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { ownerId } = await requireOnboardedProfile();
  const { sessionId } = await params;
  const curriculum = await getAppContainer().profileService.curriculum(ownerId);
  const session = curriculum?.sessions.find((item) => item.id === sessionId);
  if (!session) notFound();

  return <SessionDetail session={session} />;
}
