"use client";

import { CoreTechnicalQuestionWorkspace } from "@/components/workspace/core-technical/core-technical-question-workspace";
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
    <CoreTechnicalQuestionWorkspace
      block={appliedEngineeringBlockView(block)}
      initialQuestion={appliedEngineeringQuestionView(initialQuestion)}
      stageTitle={stageTitle}
      experience={APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE}
    />
  );
}
