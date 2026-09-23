import { notFound, redirect } from "next/navigation";
import { isAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import { AiMlStoryWorkspace } from "@/features/practice/ai-ml/ui/ai-ml-story-workspace";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { getAppContainer } from "@/server/app-container";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "AI/ML Practice Question",
  "A question in your AI/ML practice path."
);

export default async function AiMlPracticeQuestionPage({
  params
}: {
  params: Promise<{ track: string; questionId: string }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  if (profile.targetRole !== "ai-ml") redirect("/practice");
  const { track, questionId } = await params;
  if (!isAiMlPracticeTrack(track)) notFound();
  if (track === "architecture-design") redirect("/practice/architecture-design");
  const session = await getAppContainer().aiMlStoryPracticeService.session(ownerId, track);
  // Preserve URLs from the original eight-question AI/ML cohort.
  if (questionId.startsWith("ai-ml-")) {
    const legacy = await getAppContainer().aiMlPracticeService.session(ownerId, track);
    const original = legacy.questions.find((question) => question.id === questionId);
    if (original) {
      redirect(`/practice/ai-ml/${track}/questions/${original.databaseId}`);
    }
  }
  const block = session.blocks.find((item) =>
    item.questions.some((question) => question.id === questionId)
  );
  const question = block?.questions.find((item) => item.id === questionId);
  if (!block || !question) notFound();
  return (
    <main className="practice-question-page w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <AiMlStoryWorkspace key={questionId} track={track} block={block} question={question} />
    </main>
  );
}
