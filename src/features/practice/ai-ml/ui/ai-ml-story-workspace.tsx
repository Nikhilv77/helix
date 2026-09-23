"use client";

import {
  StoryPracticeQuestionWorkspace,
  type StoryPracticeWorkspaceExperience
} from "@/features/practice/shared/ui/story-practice-question-workspace";
import type {
  StoryPracticeBlockView,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import type { PersistedAiMlPracticeTrack } from "../domain/ai-ml-practice";

export function AiMlStoryWorkspace({
  track,
  block,
  question
}: {
  track: PersistedAiMlPracticeTrack;
  block: StoryPracticeBlockView;
  question: StoryPracticeQuestionView;
}) {
  const experience: StoryPracticeWorkspaceExperience = {
    slug: track,
    label: track === "core-technical" ? "AI/ML Core Technical" : "AI/ML Applied Engineering",
    apiBase: "/api/practice/ai-ml",
    routeBase: `/practice/ai-ml/${track}`,
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
