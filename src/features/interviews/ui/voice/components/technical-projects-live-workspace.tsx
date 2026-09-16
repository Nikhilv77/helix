"use client";

import type { ComponentProps } from "react";
import { BlockAssessmentReviewWorkspace } from "./block-assessment-review-workspace";
import type { InterviewStageDef } from "./interview-question-panel";

export const TECHNICAL_PROJECTS_STAGES: InterviewStageDef[] = [
  { id: "rapid", label: "Technical", caption: "Three mechanism checks" },
  { id: "project", label: "Project", caption: "Context, ownership and technical trace" },
  { id: "scenario", label: "Pressure-test", caption: "Failure, verification and trade-offs" }
];

type Props = Omit<
  ComponentProps<typeof BlockAssessmentReviewWorkspace>,
  "stages" | "anchorLabel" | "grade"
>;

/** Shared spoken/MCQ surface for the permanent Claire-led technical round. */
export function TechnicalProjectsLiveWorkspace(props: Props) {
  return (
    <BlockAssessmentReviewWorkspace
      {...props}
      grade={null}
      stages={TECHNICAL_PROJECTS_STAGES}
      anchorLabel="Project context"
    />
  );
}
