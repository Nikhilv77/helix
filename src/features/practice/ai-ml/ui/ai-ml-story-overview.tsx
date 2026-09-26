"use client";

import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";
import type {
  StoryPracticeLibraryExperience,
  StoryPracticeIntroExperience
} from "@/features/practice/shared/ui/contracts";
import { StoryPracticeIntro } from "@/features/practice/shared/ui/story-practice-intro";
import { StoryPracticePathLibrary } from "@/features/practice/shared/ui/story-practice-overview";
import type {
  StoryPracticeBlockView,
  StoryPracticeHistoryListView,
  StoryPracticeLibraryEntryView
} from "@/features/practice/shared/ui/view-contracts";
import type { AiMlStorySession } from "../server/ai-ml-story-practice.service";
import {
  storyDiscipline,
  storyTrackHref
} from "@/features/practice/story-tracks/domain/story-disciplines";

export function AiMlStoryOverview({
  session,
  selected
}: {
  session: AiMlStorySession;
  selected: StoryPracticeBlockView;
}) {
  const routeBase = storyTrackHref(session.discipline, session.track);
  const label = session.track === "core-technical" ? "Core Technical" : "Applied Engineering";
  const experience: StoryPracticeLibraryExperience & { intro: StoryPracticeIntroExperience } = {
    slug: session.track,
    label,
    routeBase,
    subjectNoun: "path",
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
  const terminalCount = selected.questions.filter(
    (question) => question.status !== "ACTIVE"
  ).length;

  return (
    <section className="mx-auto w-full max-w-[68rem]">
      <StoryPracticeIntro
        block={selected}
        terminalCount={terminalCount}
        experience={experience.intro}
        hidePathEyebrow
      />
      <StoryPracticePathLibrary
        entries={entries}
        history={history}
        selectedBlockId={selected.id}
        selectedBlock={selected}
        experience={experience}
      />
    </section>
  );
}
