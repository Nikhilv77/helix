"use client";

import {
  StoryPracticeQuestionWorkspace,
  type StoryPracticeQuestionWorkspaceProps,
  type StoryPracticeWorkspaceExperience
} from "@/features/practice/shared/ui/story-practice-question-workspace";
import type { StoryPracticeQuestionView } from "@/features/practice/shared/ui/view-contracts";

export type { StoryPracticeWorkspaceExperience };

export const CORE_TECHNICAL_WORKSPACE_EXPERIENCE: StoryPracticeWorkspaceExperience = {
  slug: "core-technical",
  label: "Core Technical",
  apiBase: "/api/practice/core-technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "practice path",
  environmentLabel: "JavaScript · Node.js 22",
  capabilities: { runCode: true },
  textAnswerPlaceholder: "Explain what is happening, how you know, and what you would change…",
  feedbackReasoningLabel: "Mechanism",
  responseLabel: () => null,
  responseGuidance: () => null,
  adaptQuestion: (question) => question as StoryPracticeQuestionView
};

export function CoreTechnicalQuestionWorkspace({
  experience = CORE_TECHNICAL_WORKSPACE_EXPERIENCE,
  ...props
}: Omit<StoryPracticeQuestionWorkspaceProps, "experience"> & {
  experience?: StoryPracticeWorkspaceExperience;
}) {
  return <StoryPracticeQuestionWorkspace {...props} experience={experience} />;
}
