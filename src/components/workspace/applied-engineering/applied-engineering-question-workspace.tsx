"use client";

import { StoryPracticeQuestionWorkspace } from "@/components/workspace/story-practice/story-practice-question-workspace";
import type {
  AppliedEngineeringPublicBlock,
  AppliedEngineeringPublicQuestion
} from "@/server/applied-engineering/practice.service";
import {
  appliedEngineeringBlockView,
  appliedEngineeringQuestionView
} from "./applied-engineering-adapter";
import { APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE } from "./applied-engineering-experience";

export function AppliedEngineeringQuestionWorkspace({
  block,
  initialQuestion,
  stageTitle
}: {
  block: AppliedEngineeringPublicBlock;
  initialQuestion: AppliedEngineeringPublicQuestion;
  stageTitle: string;
}) {
  return (
    <StoryPracticeQuestionWorkspace
      block={appliedEngineeringBlockView(block)}
      initialQuestion={appliedEngineeringQuestionView(initialQuestion)}
      stageTitle={stageTitle}
      experience={APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE}
    />
  );
}
