"use client";

import {
  StoryPracticeQuestionWorkspace,
  type StoryPracticeWorkspaceExperience
} from "@/features/practice/shared/ui/story-practice-question-workspace";
import type {
  StoryPracticeQuestionBlockView,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import type { PersistedAiMlPracticeTrack } from "../domain/ai-ml-practice";
import {
  storyDiscipline,
  storyTrackHref,
  type StoryDiscipline
} from "@/features/practice/story-tracks/domain/story-disciplines";

export function AiMlStoryWorkspace({
  discipline = "ai-ml",
  track,
  block,
  question
}: {
  discipline?: StoryDiscipline;
  track: PersistedAiMlPracticeTrack;
  block: StoryPracticeQuestionBlockView;
  question: StoryPracticeQuestionView;
}) {
  const disciplineLabel = storyDiscipline(discipline).label;
  const experience: StoryPracticeWorkspaceExperience = {
    slug: track,
    label: `${disciplineLabel} ${track === "core-technical" ? "Core Technical" : "Applied Engineering"}`,
    // Every discipline shares the story-practice API; questions are owner-scoped by id.
    apiBase: "/api/practice/ai-ml",
    routeBase: storyTrackHref(discipline, track),
    subjectNoun: "case",
    environmentLabel: null,
    answerReview: "modal",
    capabilities: { runCode: false },
    textAnswerPlaceholder:
      "Explain your diagnosis, the evidence behind it, and what you would check or change next…",
    feedbackReasoningLabel: "Reasoning",
    responseLabel: () => null,
    responseGuidance: () => null,
    adaptQuestion: (value) => value as StoryPracticeQuestionView
  };
  const stageTitle =
    block.story.stages.find((stage) => stage.order === question.order)?.title ??
    `Question ${question.order}`;
  const contextualBlock = {
    ...block,
    selection: {
      ...block.selection,
      reason: question.question.interviewConnection ?? block.selection.reason
    }
  };
  return (
    <StoryPracticeQuestionWorkspace
      block={contextualBlock}
      initialQuestion={question}
      stageTitle={stageTitle}
      experience={experience}
      structuredAnswerPrompts={[
        {
          label: "What the evidence says",
          suggestion: "Name the strongest signal in the artifact."
        },
        {
          label: "Why it happens",
          suggestion: "Explain the likely mechanism or failure boundary."
        },
        {
          label: "Next check",
          suggestion: "Describe the smallest check that would confirm your diagnosis."
        },
        { label: "Production decision", suggestion: "State the safe action and its trade-off." }
      ]}
    />
  );
}
