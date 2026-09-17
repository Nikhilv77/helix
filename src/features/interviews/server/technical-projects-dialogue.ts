import type { InterviewState } from "./types";

type DialogueState = Pick<InterviewState, "phase" | "plan" | "questionIndex">;

export function technicalProjectsMoveOnUtterance(
  state: DialogueState,
  acknowledgement: string
): string {
  if (state.phase === "done" || state.phase === "wrap") {
    return join(
      acknowledgement,
      "That completes the technical and project round. Thank you for walking me through the details. Your report will separate the technical calibration, project discussion, and coding evidence."
    );
  }

  const next = state.plan[state.questionIndex];
  if (!next)
    return join(acknowledgement, "That completes the round. Your report will be ready shortly.");
  const previous = state.plan[state.questionIndex - 1];
  let bridge = "";
  if (
    previous?.technicalProjectsSection === "technical-calibration" &&
    next.technicalProjectsSection === "technical-calibration"
  ) {
    bridge = "Let's take the next technical scenario.";
  } else if (
    previous?.technicalProjectsSection === "technical-calibration" &&
    next.projectAct === "context"
  ) {
    bridge =
      "That completes the technical calibration. Now I'd like to focus on one project in depth.";
  } else if (previous?.projectAct === "context" && next.projectAct === "mechanism") {
    bridge = "Let's trace the technical path in detail.";
  } else if (previous?.projectAct === "mechanism" && next.projectAct === "failure") {
    bridge = "Now let's pressure-test that path.";
  } else if (previous?.projectAct === "failure" && next.projectAct === "coding") {
    bridge = "Let's finish by turning that project understanding into code.";
  }
  return join(acknowledgement, bridge, next.text);
}

function join(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
