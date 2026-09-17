"use client";

import type { ComponentProps } from "react";
import { BlockAssessmentReviewWorkspace } from "./block-assessment-review-workspace";
import type { InterviewStageDef } from "./interview-question-panel";
import { ResumeLiveWorkspace } from "./resume-live-workspace";

export const TECHNICAL_PROJECTS_STAGES: InterviewStageDef[] = [
  { id: "rapid", label: "Technical", caption: "Three mechanism checks" },
  { id: "project", label: "Project", caption: "Context, ownership and technical trace" },
  { id: "scenario", label: "Pressure-test", caption: "Failure and verification" },
  { id: "code", label: "Code", caption: "Implement a project rule" }
];

type ConversationProps = Omit<
  ComponentProps<typeof BlockAssessmentReviewWorkspace>,
  "stages" | "anchorLabel" | "grade"
>;

type Props = ConversationProps &
  Pick<
    ComponentProps<typeof ResumeLiveWorkspace>,
    "language" | "syntaxLanguage" | "notes" | "running" | "runResult" | "onNotesChange" | "onRun"
  >;

/** Shared spoken/MCQ surface for the permanent Claire-led technical round. */
export function TechnicalProjectsLiveWorkspace(props: Props) {
  if (props.question?.stage === "code") {
    return (
      <ResumeLiveWorkspace
        {...props}
        resume={null}
        grade={null}
        teacherName={props.interviewerName}
        stageDefinitions={TECHNICAL_PROJECTS_STAGES}
        evidenceAnchorLabel="Project context"
      />
    );
  }

  return (
    <BlockAssessmentReviewWorkspace
      {...props}
      grade={null}
      stages={TECHNICAL_PROJECTS_STAGES}
      anchorLabel="Project context"
    />
  );
}
