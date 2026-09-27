"use client";

import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";
import { APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE } from "@/features/practice/applied-engineering/ui/applied-engineering-experience";
import {
  StoryPracticeOverview,
  type StoryPracticeOverviewExperience
} from "@/features/practice/shared/ui/story-practice-overview";
import type { StoryAssessmentSummary } from "@/features/practice/story-tracks/server/story-assessment.service";
import { StoryAssessmentCard } from "@/features/practice/story-tracks/ui/story-assessment-card";
import type {
  StoryPracticeBlockView,
  StoryPracticeHistoryListView,
  StoryPracticeLibraryEntryView
} from "@/features/practice/shared/ui/view-contracts";
import type { AiMlStorySession } from "../server/ai-ml-story-practice.service";
import {
  storyDiscipline,
  storyDisciplinePaths,
  storyTrackHref
} from "@/features/practice/story-tracks/domain/story-disciplines";
import Link from "next/link";
import { LinkPendingIcon } from "@/components/workspace/shared/back-link-icon";

export function AiMlStoryOverview({
  session,
  selected,
  assessment = null
}: {
  session: AiMlStorySession;
  selected: StoryPracticeBlockView;
  /** The selected path's written assessment; null when it has none. */
  assessment?: StoryAssessmentSummary | null;
}) {
  const routeBase = storyTrackHref(session.discipline, session.track);
  const label = session.track === "core-technical" ? "Core Technical" : "Applied Engineering";
  // The same overview as Core Technical and Applied Engineering. Its assessment
  // slot always receives the story-track card (or nothing), so the Node.js
  // assessment settings inherited here are never used.
  const experience: StoryPracticeOverviewExperience = {
    ...APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE,
    slug: session.track,
    label,
    routeBase: routeBase as StoryPracticeOverviewExperience["routeBase"],
    subjectNoun: "path",
    environmentLabel: null,
    startUnstartedPath: undefined,
    historyStatusFromProgress: true,
    coachSteps: ["Read the evidence", "Explain your decision", "Check what would change it"],
    libraryDescription: "Open a path to see every question and its saved progress.",
    libraryHint:
      "Every path is available now; solved answers, learned stages, and drafts stay in your account.",
    intro: {
      routeBase,
      subjectNoun: "path",
      label,
      description: storyDiscipline(session.discipline).overviewDescription,
      script: TEACHER_VOICE_LINES.storyTrackIntro
    }
  };
  const entries: StoryPracticeLibraryEntryView[] = session.blocks.map((block) => ({
    key: block.story.key,
    version: 1,
    title: block.story.title,
    expectedMinutes: block.story.expectedMinutes,
    difficulties: [block.story.difficulty],
    topicKeys: [block.story.primaryTopicKey, ...block.story.secondaryTopicKeys],
    mechanismKeys: block.story.mechanismKeys,
    questions: block.questions.map((question) => ({
      order: question.order,
      title:
        block.story.stages.find((stage) => stage.order === question.order)?.title ??
        `Question ${question.order}`,
      format: question.question.format
    }))
  }));
  const history: StoryPracticeHistoryListView = session.blocks.map((block) => ({
    id: block.id,
    ordinal: block.ordinal,
    isCurrent: block.isCurrent,
    status: block.status,
    story: {
      key: block.story.key,
      title: block.story.title,
      primaryTopicKey: block.story.primaryTopicKey,
      secondaryTopicKeys: block.story.secondaryTopicKeys,
      difficulty: block.story.difficulty,
      stages: block.story.stages
    },
    completedQuestionCount: block.questions.filter((question) => question.status === "COMPLETED")
      .length,
    learnedQuestionCount: block.questions.filter((question) => question.status === "LEARNED")
      .length,
    questions: block.questions.map(({ id, order, status }) => ({ id, order, status })),
    assessment: null
  }));
  const ordered = [...history].sort((left, right) => left.ordinal - right.ordinal);
  const position = ordered.findIndex((item) => item.id === selected.id);
  const navigation =
    position === -1
      ? null
      : {
          selected: ordered[position]!,
          previousBlockId: ordered[position - 1]?.id ?? null,
          nextBlockId: ordered[position + 1]?.id ?? null,
          totalBlocks: ordered.length
        };

  return (
    <StoryPracticeOverview
      block={selected}
      history={navigation}
      storyLibrary={entries}
      storyHistory={history}
      experience={experience}
      assessmentContent={
        assessment ? (
          <StoryAssessmentCard
            summary={assessment}
            block={selected}
            label={label}
            track={session.track}
            routeBase={routeBase}
          />
        ) : !storyDisciplinePaths(session.discipline, session.track).some(
            (path) => path.key === selected.id
          ) ? (
          <PersonalPathAssessmentNote
            href={`${routeBase}?block=${encodeURIComponent(
              storyDiscipline(session.discipline).paths(session.track)[0]?.key ?? ""
            )}`}
          />
        ) : (
          // `false`, not null: null would fall back to the Node.js assessment.
          false
        )
      }
    />
  );
}

/** In the assessment slot of a personal path, which has none of its own. */
function PersonalPathAssessmentNote({ href }: { href: string }) {
  return (
    <aside
      aria-label="Path assessment"
      className="flex flex-wrap items-center justify-between gap-4 rounded-[1.15rem] border border-white/[0.075] bg-[#0e1011] px-5 py-4"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
          Path assessment
        </p>
        <p className="mt-1.5 text-[14px] leading-6 text-cream/65">
          This personal path has no assessment. The core paths each end with one.
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] px-4 text-[13px] font-semibold text-cream/80 transition hover:bg-white/[0.05] hover:text-cream"
      >
        Go to the core paths
        <LinkPendingIcon direction="forward" size={14} />
      </Link>
    </aside>
  );
}
