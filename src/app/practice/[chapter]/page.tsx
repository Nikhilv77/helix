import { notFound } from "next/navigation";
import { ChapterSession } from "@/components/workspace/chapter-session";
import { briefBeats, buildChapterBrief } from "@/lib/chapter-brief";
import { findQuestion } from "@/lib/dsa";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ chapter: string }> }) {
  const { chapter } = await params;
  const plan = await getAppContainer()
    .dsaService.frontendPlan()
    .catch(() => null);
  const found = plan?.chapters.find((item) => item.id === chapter);
  return privatePageMetadata(
    found?.title ?? "Practice session",
    found?.whyItMatters ?? "A guided DSA session with Maya."
  );
}

/**
 * One chapter, taken as a session: Maya briefs the pattern, then the user
 * works the questions. The briefing comes from the shared question bank; the
 * progress beside it is this user's own roadmap state.
 */
export default async function ChapterSessionPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { ownerId } = await requireOnboardedProfile();
  const container = getAppContainer();

  const { chapter } = await params;
  const [plan, detail] = await Promise.all([
    container.dsaService.frontendPlan().catch(() => null),
    // A missing roadmap must not break the session page — the briefing still
    // works, it just cannot show progress.
    container.frontendRoadmapService.chapterDetail(ownerId, chapter).catch(() => null)
  ]);

  const planChapter = plan?.chapters.find((item) => item.id === chapter);
  if (!planChapter) notFound();

  // The teaching layer lives on the full question records, not the plan's
  // trimmed ones, so resolve each slug back to the bank.
  const questions = planChapter.questions
    .map((question) => findQuestion(question.slug)?.question)
    .filter((question): question is NonNullable<typeof question> => Boolean(question));

  const brief = buildChapterBrief(chapter, questions);
  if (!brief) notFound();

  // Keyed by chapter so switching sessions restarts the briefing at beat one
  // rather than inheriting the previous chapter's step and phase.
  return (
    <ChapterSession key={chapter} brief={brief} beats={briefBeats(brief)} detail={detail} />
  );
}
