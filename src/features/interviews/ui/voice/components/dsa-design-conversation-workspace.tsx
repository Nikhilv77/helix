"use client";

import type { ComponentProps } from "react";
import { BlockAssessmentReviewWorkspace } from "./block-assessment-review-workspace";
import type { InterviewStageDef } from "./interview-question-panel";

export const DSA_DESIGN_STAGES: InterviewStageDef[] = [
  { id: "rapid", label: "Frame", caption: "Requirements and scale" },
  { id: "explain", label: "Design", caption: "Contracts and architecture" },
  { id: "scenario", label: "Defend", caption: "Reliability and evolution" }
];

type Props = Omit<ComponentProps<typeof BlockAssessmentReviewWorkspace>, "stages" | "anchorLabel">;

/** The spoken system-design half of the combined Claire interview. */
export function DsaDesignConversationWorkspace(props: Props) {
  return (
    <BlockAssessmentReviewWorkspace
      {...props}
      stages={DSA_DESIGN_STAGES}
      anchorLabel="Scenario context"
    />
  );
}
