"use client";

import type { ComponentProps } from "react";
import { BlockAssessmentReviewWorkspace } from "./block-assessment-review-workspace";
import { SystemDesignCanvas } from "./system-design-canvas";
import type { InterviewStageDef } from "./interview-question-panel";

export const DSA_DESIGN_STAGES: InterviewStageDef[] = [
  {
    id: "design-frame",
    label: "Frame",
    caption: "Discover requirements",
    stageIds: ["design-frame", "rapid"]
  },
  {
    id: "design-canvas",
    label: "Design",
    caption: "Build the architecture",
    stageIds: ["design-canvas", "explain"]
  },
  { id: "design-deep-dive", label: "Deep dive", caption: "Trace one boundary" },
  { id: "design-pressure", label: "Pressure test", caption: "Adapt to change" },
  {
    id: "design-defend",
    label: "Defend",
    caption: "Trade-offs and risks",
    stageIds: ["design-defend", "scenario"]
  }
];

type Props = Omit<
  ComponentProps<typeof BlockAssessmentReviewWorkspace>,
  "stages" | "anchorLabel"
> & {
  canvasStorageKey?: string;
};

/** Candidate-led design workspace used by dedicated and legacy combined sessions. */
export function DsaDesignConversationWorkspace(props: Props) {
  const { canvasStorageKey, ...workspaceProps } = props;
  const framing = props.question?.stage === "design-frame" || props.question?.stage === "rapid";
  return (
    <BlockAssessmentReviewWorkspace
      {...workspaceProps}
      stages={DSA_DESIGN_STAGES}
      anchorLabel="Design brief"
      showEvidenceAnchor={false}
      showExpectations={false}
      questionWorkspace={
        framing ? undefined : (
          <SystemDesignCanvas storageKey={canvasStorageKey} sessionId={canvasStorageKey} />
        )
      }
    />
  );
}
