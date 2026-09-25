"use client";

import { StoryPracticeQuestionWorkspace } from "@/features/practice/shared/ui/story-practice-question-workspace";
import type {
  AppliedEngineeringPublicQuestion
} from "@/features/practice/applied-engineering/server/practice.service";
import type { StoryPracticeQuestionBlockView } from "@/features/practice/shared/ui/view-contracts";
import { appliedEngineeringQuestionView } from "./applied-engineering-adapter";
import { APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE } from "./applied-engineering-experience";

export function AppliedEngineeringQuestionWorkspace({
  block,
  initialQuestion,
  stageTitle
}: {
  block: StoryPracticeQuestionBlockView;
  initialQuestion: AppliedEngineeringPublicQuestion;
  stageTitle: string;
}) {
  return (
    <StoryPracticeQuestionWorkspace
      block={block}
      initialQuestion={appliedEngineeringQuestionView(initialQuestion)}
      stageTitle={stageTitle}
      experience={APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE}
    />
  );
}
