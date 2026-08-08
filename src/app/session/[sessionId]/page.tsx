import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { SessionDetail } from "@/components/workspace/session-detail";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice Session",
  "Review a planned Trailgrad practice session from your personalized interview roadmap."
);

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { sessionId } = await params;
  const curriculum = await getAppContainer().profileService.curriculum(
    authenticatedOwnerId(userId)
  );
  const session = curriculum?.sessions.find((item) => item.id === sessionId);
  if (!session) notFound();

  return <SessionDetail session={session} />;
}
