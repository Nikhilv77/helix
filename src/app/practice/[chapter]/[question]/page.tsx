import { notFound } from "next/navigation";
import { PrepQuestionWorkspace } from "@/components/workspace/practice/prep-question-workspace";
import { isNonDsaPracticeSessionKey } from "@/lib/practice/prep-practice";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice question",
  "A personalized Trailgrad question workspace with saved progress."
);

export default async function PrepPracticeQuestionPage({
  params
}: {
  params: Promise<{ chapter: string; question: string }>;
}) {
  const { ownerId } = await requireOnboardedProfile();
  const { chapter, question } = await params;
  if (!isNonDsaPracticeSessionKey(chapter)) notFound();
  const app = getAppContainer();
  if (!app.config.practiceNonDsaEnabled) notFound();

  await app.practiceRoadmapService.home(ownerId).catch(() => null);
  const detail = await app.prepPracticeService.question(ownerId, chapter, question);
  if (!detail) notFound();

  return <PrepQuestionWorkspace key={`${chapter}:${question}`} question={detail} />;
}
