import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import { AiMlStoryOverview } from "@/features/practice/ai-ml/ui/ai-ml-story-overview";
import { AiMlStoryWorkspace } from "@/features/practice/ai-ml/ui/ai-ml-story-workspace";
import {
  storyDisciplineForRole,
  type StoryDiscipline
} from "@/features/practice/story-tracks/domain/story-disciplines";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedOwner, requireOnboardedProfile } from "@/server/auth/onboarding-guard";

type TrackParams = Promise<{ track: string }>;

/** Track overview shared by every story-practice discipline. */
export async function StoryTrackPage({
  discipline,
  params,
  searchParams
}: {
  discipline: StoryDiscipline;
  params: TrackParams;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  if (storyDisciplineForRole(profile.targetRole) !== discipline) redirect("/practice");
  const { track } = await params;
  if (!isAiMlPracticeTrack(track)) notFound();
  if (track === "architecture-design") redirect("/practice/architecture-design");
  const session = await getAppContainer().aiMlStoryPracticeService.session(
    ownerId,
    track,
    profile,
    discipline
  );
  const query = await searchParams;
  const selected =
    session.blocks.find((block) => block.id === query.block) ??
    session.blocks.find((block) => block.isCurrent) ??
    session.blocks[0];
  if (!selected) notFound();
  return (
    <main className="practice-page mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Practice
      </Link>
      <AiMlStoryOverview session={session} selected={selected} />
    </main>
  );
}

/** One question inside a discipline's track. */
export async function StoryTrackQuestionPage({
  discipline,
  params
}: {
  discipline: StoryDiscipline;
  params: Promise<{ track: string; questionId: string }>;
}) {
  const { ownerId, targetRole } = await requireOnboardedOwner();
  if (storyDisciplineForRole(targetRole) !== discipline) redirect("/practice");
  const { track, questionId } = await params;
  if (!isAiMlPracticeTrack(track)) notFound();
  if (track === "architecture-design") redirect("/practice/architecture-design");
  if (discipline === "ai-ml" && /^ai-ml-(?:core|applied)-[1-8]$/.test(questionId)) {
    // Preserve URLs from the original eight-question AI/ML cohort.
    const legacy = await getAppContainer().aiMlPracticeService.session(ownerId, track);
    const original = legacy.questions.find((question) => question.id === questionId);
    if (original) redirect(`/practice/ai-ml/${track}/questions/${original.databaseId}`);
  }
  const service = getAppContainer().aiMlStoryPracticeService;
  let workspace = await service.questionWorkspace(ownerId, track, questionId, discipline);
  if (!workspace) {
    // A direct link can arrive before the first visit publishes the cohort.
    await service.session(ownerId, track, undefined, discipline);
    workspace = await service.questionWorkspace(ownerId, track, questionId, discipline);
  }
  if (!workspace) notFound();
  const { block, question } = workspace;
  return (
    <main className="practice-question-page w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <AiMlStoryWorkspace
        key={questionId}
        discipline={discipline}
        track={track}
        block={block}
        question={question}
      />
    </main>
  );
}
