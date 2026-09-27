import { BackLinkIcon } from "@/components/workspace/shared/back-link-icon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { isAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import { AiMlStoryOverview } from "@/features/practice/ai-ml/ui/ai-ml-story-overview";
import { AiMlStoryWorkspace } from "@/features/practice/ai-ml/ui/ai-ml-story-workspace";
import {
  storyDiscipline,
  storyDisciplineForRole,
  storyTrackHref,
  type StoryDiscipline
} from "@/features/practice/story-tracks/domain/story-disciplines";
import { Suspense } from "react";
import { CoreTechnicalBlockAssessmentClient } from "@/features/practice/core-technical/ui/core-technical-block-assessment-client";
import { AssessmentRoomLoading } from "@/features/practice/shared/ui/assessment-room-loading";
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
  // The assessment card is optional: a failure hides it instead of the page.
  const assessment = await getAppContainer()
    .storyAssessmentService.summary(ownerId, { discipline, track, pathKey: selected.id })
    .catch(() => null);
  if (assessment?.status === "IN_PROGRESS" || assessment?.status === "FINALIZING") {
    // Grade a finished room whose report was interrupted, after the response.
    const assessmentId = assessment.assessmentId;
    after(() =>
      getAppContainer()
        .storyAssessmentService.finalizeInterviewOwned(ownerId, assessmentId)
        .then(
          () => undefined,
          () => undefined
        )
    );
  }
  return (
    <main className="practice-page mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <BackLinkIcon size={14} />
        Back to Practice
      </Link>
      <AiMlStoryOverview session={session} selected={selected} assessment={assessment} />
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

/** Full-screen assessment room for one of the learner's story paths. */
export async function StoryTrackAssessmentPage({
  discipline,
  params,
  searchParams
}: {
  discipline: StoryDiscipline;
  params: TrackParams;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  if (storyDisciplineForRole(profile.targetRole) !== discipline) redirect("/practice");
  const [{ track }, query] = await Promise.all([params, searchParams]);
  if (!isAiMlPracticeTrack(track) || track === "architecture-design") notFound();
  const trackHref = storyTrackHref(discipline, track);
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect(trackHref);
  const service = getAppContainer().storyAssessmentService;
  const scope = await service.roomScope(ownerId, sessionId);
  // Owner-scoped; a room from another discipline or track is not shown here.
  if (!scope || scope.discipline !== discipline || scope.track !== track) redirect(trackHref);
  const overviewHref = `${trackHref}?block=${encodeURIComponent(scope.pathKey)}`;
  return (
    <Suspense fallback={<AssessmentRoomLoading />}>
      <CoreTechnicalBlockAssessmentClient
        sessionId={sessionId}
        workspaceAccent={profile.workspaceAccent}
        assessmentKind="applied-engineering"
        roomOverride={{ label: storyDiscipline(discipline).label, home: overviewHref }}
      />
    </Suspense>
  );
}
